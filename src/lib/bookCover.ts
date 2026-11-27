/**
 * Cover pipeline: remote reference → local image the app can actually paint.
 *
 * Two constraints decide the design:
 *
 *   1. The CSP allows no third-party image host (`img-src 'self' data: blob:` plus one
 *      reviewed YouTube host), so a provider's cover URL cannot be an `<img src>`.
 *   2. A remote URL is not durable — it can rot, and the app must work offline.
 *
 * So the cover is fetched through this origin (`/api/books/cover`, host-allow-listed),
 * re-encoded to a bounded data URL, and stored on the book. What is persisted is the
 * image, not the link; `catalog.coverUrl` is kept only as provenance.
 *
 * Decoding happens on a canvas, which keeps the stored payload small and gives a
 * predictable aspect ratio. A manual upload goes through the same encoder, so the two
 * paths produce the same shape of record.
 */

import { booksClient } from './booksClient';

/** Long edge of a stored cover. Big enough for a card, small enough for localStorage. */
const MAX_COVER_EDGE = 480;
/** JPEG quality for the re-encode. 0.82 is visually lossless at this size. */
const COVER_QUALITY = 0.82;
/** Refuse to persist anything larger than this, so one cover cannot fill the quota. */
export const MAX_COVER_DATA_URL_LENGTH = 700_000;

export type CoverResult = { ok: true; dataUrl: string } | { ok: false; reason: 'unavailable' | 'too_large' | 'decode_failed' };

/**
 * Re-encode an image element to a bounded JPEG data URL.
 *
 * Covers are drawn onto a canvas at a fixed maximum edge, preserving the source aspect
 * ratio so nothing is stretched. The short edge is never upscaled.
 */
export function encodeCoverFromImage(image: HTMLImageElement): CoverResult {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return { ok: false, reason: 'decode_failed' };

  const scale = Math.min(1, MAX_COVER_EDGE / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, reason: 'decode_failed' };
  // White matte: a transparent PNG would otherwise turn black as JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(image, 0, 0, targetW, targetH);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL('image/jpeg', COVER_QUALITY);
  } catch {
    return { ok: false, reason: 'decode_failed' };
  }
  if (!dataUrl.startsWith('data:image/')) return { ok: false, reason: 'decode_failed' };
  if (dataUrl.length > MAX_COVER_DATA_URL_LENGTH) return { ok: false, reason: 'too_large' };
  return { ok: true, dataUrl };
}

/**
 * How long an image may take before the cover is abandoned.
 *
 * Without this the promise can stay pending indefinitely: a stalled connection fires
 * neither `load` nor `error`, which would leave the form stuck on "Loading…" with no way
 * out. A missing cover is recoverable; a frozen form is not.
 */
const IMAGE_LOAD_TIMEOUT_MS = 15_000;

/** Load a `data:`/`blob:`/same-origin image URL into an element for re-encoding. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

/** Read a user-picked file as a data URL. */
function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === 'undefined') {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Fetch a provider cover through this origin and store it as a local image.
 *
 * Every failure is a value, because a missing cover is not an error the reader needs
 * to see: the book is saved with its palette colour and the cover can be added later.
 */
export async function fetchCoverAsDataUrl(remoteUrl: string): Promise<CoverResult> {
  if (!remoteUrl) return { ok: false, reason: 'unavailable' };
  const localUrl = booksClient.coverUrl(remoteUrl);
  const image = await loadImage(localUrl);
  if (!image) return { ok: false, reason: 'unavailable' };
  return encodeCoverFromImage(image);
}

/** Encode a manually uploaded cover file. Same encoder, same record shape. */
export async function readCoverFile(file: File): Promise<CoverResult> {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'decode_failed' };
  const raw = await readFileAsDataUrl(file);
  if (!raw) return { ok: false, reason: 'decode_failed' };
  const image = await loadImage(raw);
  if (!image) return { ok: false, reason: 'decode_failed' };
  return encodeCoverFromImage(image);
}

/**
 * The colour a book spine falls back to when it has no cover image.
 *
 * Derived from the title so the same book always gets the same spine colour, and a
 * library without covers still looks like a shelf rather than a grey list.
 */
export const SPINE_PALETTE = [
  '#b45309',
  '#0f766e',
  '#7c3aed',
  '#b91c1c',
  '#1d4ed8',
  '#4d7c0f',
  '#a16207',
  '#9d174d'
] as const;

export function spineColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return SPINE_PALETTE[hash % SPINE_PALETTE.length];
}

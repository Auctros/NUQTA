/**
 * Persistent device identity.
 *
 * A single UUID per installation, created on first use and never regenerated. It is
 * stored OUTSIDE the synced sections: it identifies this installation to the server,
 * so it must not itself be a synchronized record. It is also never authentication —
 * the server treats it as an identifier only.
 */

const DEVICE_ID_KEY = 'nuqta_sync_device_id_v1';
const DEVICE_META_KEY = 'nuqta_sync_device_meta_v1';

export interface DeviceMeta {
  deviceName: string;
  platform: string;
  appVersion: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 v4 UUID. Uses crypto.randomUUID when available, else getRandomValues. */
export function generateUuid(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function detectDeviceMeta(): DeviceMeta {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform =
    typeof navigator !== 'undefined' && navigator.platform ? navigator.platform : 'unknown';
  return {
    deviceName: platform || 'Browser',
    platform: /android/i.test(ua) ? 'android' : /iphone|ipad|ios/i.test(ua) ? 'ios' : 'web',
    appVersion: '0.1.0'
  };
}

/**
 * Return this installation's device id, creating and persisting one on first call.
 *
 * A stored-but-malformed value is replaced rather than reused: sending an invalid id
 * would be rejected by the server on every connection attempt.
 */
export function getOrCreateDeviceId(): string {
  const existing = readStorage(DEVICE_ID_KEY);
  if (isValidDeviceId(existing)) return existing;

  const created = generateUuid();
  writeStorage(DEVICE_ID_KEY, created);
  return created;
}

/** The stored device id, or null when this installation has never initialized sync. */
export function peekDeviceId(): string | null {
  const existing = readStorage(DEVICE_ID_KEY);
  return isValidDeviceId(existing) ? existing : null;
}

export function getDeviceMeta(): DeviceMeta {
  const raw = readStorage(DEVICE_META_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DeviceMeta>;
      if (parsed && typeof parsed.deviceName === 'string') {
        return {
          deviceName: parsed.deviceName,
          platform: typeof parsed.platform === 'string' ? parsed.platform : 'web',
          appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '0.1.0'
        };
      }
    } catch {
      /* fall through to a freshly detected value */
    }
  }
  const detected = detectDeviceMeta();
  writeStorage(DEVICE_META_KEY, JSON.stringify(detected));
  return detected;
}

/** Forget this installation's identity. Only used by an explicit local wipe. */
export function resetDeviceIdentity(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(DEVICE_META_KEY);
  } catch {
    /* nothing else we can do */
  }
}

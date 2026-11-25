/**
 * YouTube link parsing.
 *
 * This is the boundary where untrusted text becomes a playlist id that the server will
 * send to YouTube. The tests are mostly negative: a link that merely mentions YouTube
 * must be rejected rather than guessed at, because a guessed id resolves to a real but
 * wrong playlist and the person ends up studying someone else's course.
 */
import { describe, it, expect } from 'vitest';
import {
  canonicalPlaylistUrl,
  canonicalVideoUrl,
  describeParseError,
  formatDuration,
  isValidPlaylistId,
  isValidVideoId,
  parseIsoDuration,
  parsePlaylistLink,
  videoThumbnailUrl
} from '../src/lib/youtubeLink';

const PL = 'PLillGF-RfqbbnE1ZyYY0k8XLKzWVC5cU4';
const VIDEO = 'dQw4w9WgXcQ';

describe('isValidPlaylistId', () => {
  it('accepts the documented prefixes', () => {
    for (const id of [PL, 'UUillGF-RfqbbnE1ZyYY0k8XLKzWVC5cU4', 'OLAK5uy_kExample_123', 'RDdQw4w9WgXcQ']) {
      expect(isValidPlaylistId(id)).toBe(true);
    }
  });

  it('rejects a bare video id, which is too short to be a playlist', () => {
    expect(isValidPlaylistId(VIDEO)).toBe(false);
  });

  it('rejects ids with characters YouTube never issues', () => {
    expect(isValidPlaylistId('PL<script>alert(1)</script>')).toBe(false);
    expect(isValidPlaylistId('PL/../../etc/passwd')).toBe(false);
    expect(isValidPlaylistId('')).toBe(false);
  });
});

describe('isValidVideoId', () => {
  it('accepts exactly eleven URL-safe characters', () => {
    expect(isValidVideoId(VIDEO)).toBe(true);
    expect(isValidVideoId('_-_-_-_-_-_')).toBe(true);
  });

  it('rejects anything of another length', () => {
    expect(isValidVideoId('short')).toBe(false);
    expect(isValidVideoId('dQw4w9WgXcQx')).toBe(false);
  });
});

describe('canonical urls', () => {
  it('builds a playlist url that always opens the playlist', () => {
    expect(canonicalPlaylistUrl(PL)).toBe(`https://www.youtube.com/playlist?list=${PL}`);
  });

  it('keeps the playlist context on a video url so the course stays in sequence', () => {
    expect(canonicalVideoUrl(VIDEO, PL)).toBe(
      `https://www.youtube.com/watch?v=${VIDEO}&list=${PL}`
    );
  });

  it('omits the list parameter when there is no playlist', () => {
    expect(canonicalVideoUrl(VIDEO)).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
  });

  it('builds a key-free thumbnail url', () => {
    expect(videoThumbnailUrl(VIDEO)).toContain(VIDEO);
  });
});

describe('parsePlaylistLink — accepted shapes', () => {
  it('parses a /playlist?list= url', () => {
    const result = parsePlaylistLink(`https://www.youtube.com/playlist?list=${PL}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playlistId).toBe(PL);
  });

  it('parses a watch url and keeps the video that was playing', () => {
    const result = parsePlaylistLink(
      `https://www.youtube.com/watch?v=${VIDEO}&list=${PL}&index=4`
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playlistId).toBe(PL);
      expect(result.value.videoId).toBe(VIDEO);
    }
  });

  it('parses a mobile and a music host', () => {
    for (const host of ['m.youtube.com', 'music.youtube.com']) {
      const result = parsePlaylistLink(`https://${host}/playlist?list=${PL}`);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.playlistId).toBe(PL);
    }
  });

  it('parses a youtu.be short link carrying a list', () => {
    const result = parsePlaylistLink(`https://youtu.be/${VIDEO}?list=${PL}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playlistId).toBe(PL);
      expect(result.value.videoId).toBe(VIDEO);
    }
  });

  it('accepts a link without a scheme, as copied from a chat message', () => {
    const result = parsePlaylistLink(`www.youtube.com/playlist?list=${PL}`);
    expect(result.ok).toBe(true);
  });

  it('accepts a bare playlist id', () => {
    const result = parsePlaylistLink(PL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playlistId).toBe(PL);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parsePlaylistLink(`   ${PL}  `).ok).toBe(true);
  });
});

describe('parsePlaylistLink — rejections', () => {
  it('rejects empty input', () => {
    const result = parsePlaylistLink('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('empty');
  });

  it('rejects a lookalike host instead of guessing', () => {
    for (const url of [
      'https://youtube.com.evil.example/playlist?list=PLaaaaaaaaaaaaaaaaaaaa',
      'https://notyoutube.com/playlist?list=PLaaaaaaaaaaaaaaaaaaaa',
      'https://vimeo.com/playlist?list=PLaaaaaaaaaaaaaaaaaaaa'
    ]) {
      const result = parsePlaylistLink(url);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('not_youtube');
    }
  });

  it('rejects a single video link with no playlist', () => {
    const result = parsePlaylistLink(`https://www.youtube.com/watch?v=${VIDEO}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no_playlist_id');
  });

  it('rejects a /playlist url carrying a malformed id', () => {
    const result = parsePlaylistLink('https://www.youtube.com/playlist?list=abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_playlist_id');
  });

  it('rejects a bare token that is not a playlist id', () => {
    const result = parsePlaylistLink('hello');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_playlist_id');
  });

  it('never returns a thumbnail for a playlist with no video', () => {
    const result = parsePlaylistLink(`https://www.youtube.com/playlist?list=${PL}`);
    if (result.ok) expect(result.value.thumbnailUrl).toBe('');
  });
});

describe('describeParseError', () => {
  it('explains every error in both languages, never saying just "invalid"', () => {
    for (const error of ['empty', 'not_youtube', 'no_playlist_id', 'invalid_playlist_id'] as const) {
      const message = describeParseError(error);
      expect(message.ar.length).toBeGreaterThan(5);
      expect(message.en.length).toBeGreaterThan(5);
    }
  });
});

describe('parseIsoDuration', () => {
  it('converts ISO-8601 durations to seconds', () => {
    expect(parseIsoDuration('PT1H2M10S')).toBe(3730);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('PT10M')).toBe(600);
    expect(parseIsoDuration('P1DT2H')).toBe(93600);
  });

  it('returns null for missing or malformed input', () => {
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration('45 minutes')).toBeNull();
    expect(parseIsoDuration('PT')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours the way a player does', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(3730)).toBe('1:02:10');
  });

  it('returns null rather than "0:00" for an unknown duration', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
  });
});

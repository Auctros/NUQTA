import { describe, it, expect, afterEach, vi } from 'vitest';
import { NuqtaStorageEngine, getStorageIssues, clearStorageIssues } from '../src/lib/storage';
import { NuqtaIndexedDB, STORES } from '../src/lib/indexedDB';
import type { Task } from '../src/types';

const task = (id: string): Task => ({ id, title: id, status: 'todo', priority: 2 } as unknown as Task);
const tick = () => new Promise((r) => setTimeout(r, 50));
const META_KEY = 'nuqta_meta_v1';

/** Open the NUQTA database directly (bypassing the module's cached connection). */
const openRaw = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('nuqta_local_db', 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recovery is safe around unreadable metadata', () => {
  it('does NOT overwrite existing localStorage data when the metadata record is corrupt', async () => {
    clearStorageIssues();
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    // The metadata record becomes unreadable, but the dataset itself is still present.
    localStorage.setItem(META_KEY, '{not-json');

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    // The recoverable localStorage data must be preserved, not replaced by the mirror.
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a', 'b']);
    expect(getStorageIssues().some((i) => i.kind === 'corrupt' && i.key === META_KEY)).toBe(true);
  });

  it('does NOT overwrite existing localStorage data when the metadata record is missing', async () => {
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    localStorage.removeItem(META_KEY); // metadata gone, dataset still here

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('restores from the mirror only when localStorage has genuinely lost its data (stale mirror)', async () => {
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    localStorage.clear(); // e.g. localStorage evicted, IndexedDB survived

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(true);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('recovers from a mirror when metadata is corrupt AND localStorage is otherwise empty', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    // Drop every live dataset key, then leave only a broken metadata record behind.
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nuqta_') && !k.includes('__corrupt_'))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(META_KEY, '{broken');

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(true);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a']);
  });

  it('leaves localStorage untouched when metadata is valid, even if the mirror differs (conflicting state)', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]); // metadata stays valid
    await tick();

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('does not invent data when both stores are empty', async () => {
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
  });
});

describe('wipeAll reliability (mirror)', () => {
  it('clears every store and reports success on a normal wipe', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    NuqtaStorageEngine.saveJournalEntries([{ id: 'j1', content: 'x' } as never]);
    await tick();

    expect(await NuqtaIndexedDB.wipeAll()).toBe(true);
    for (const name of Object.values(STORES)) {
      expect(await NuqtaIndexedDB.getAll(name)).toEqual([]);
    }
  });

  it('reports success when IndexedDB is genuinely unavailable (no mirror to delete)', async () => {
    const original = (window as unknown as { indexedDB: unknown }).indexedDB;
    (window as unknown as { indexedDB: unknown }).indexedDB = null;
    try {
      expect(await NuqtaIndexedDB.wipeAll()).toBe(true);
    } finally {
      (window as unknown as { indexedDB: unknown }).indexedDB = original;
    }
  });

  it('reports FAILURE when the database cannot be opened', async () => {
    const db = await openRaw(); // the database genuinely exists...
    db.close();
    // ...but opening it now fails.
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      const req = { error: new DOMException('blocked', 'InvalidStateError') } as unknown as IDBOpenDBRequest;
      setTimeout(() => req.onerror?.(new Event('error') as never), 0);
      return req;
    });
    try {
      expect(await NuqtaIndexedDB.wipeAll()).toBe(false);
    } finally {
      openSpy.mockRestore();
    }
  });

  it('reports FAILURE when a store deletion fails', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    const txSpy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      throw new DOMException('cannot start transaction', 'InvalidStateError');
    });
    try {
      expect(await NuqtaIndexedDB.wipeAll()).toBe(false);
    } finally {
      txSpy.mockRestore();
    }
  });
});

describe('full wipe flow keeps localStorage when the mirror cannot be cleared', () => {
  it('does not clear localStorage when the mirror wipe fails', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    const txSpy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
      throw new DOMException('cannot start transaction', 'InvalidStateError');
    });
    try {
      expect(await NuqtaStorageEngine.wipeAll()).toBe(false);
    } finally {
      txSpy.mockRestore();
    }
    // Nothing was removed: the mirror could otherwise "recover" deleted data.
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a']);
  });

  it('clears both stores and is never undone by recovery on a successful wipe', async () => {
    localStorage.setItem('other_app_key', 'keep me');
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();

    expect(await NuqtaStorageEngine.wipeAll()).toBe(true);
    expect(Object.keys(localStorage).filter((k) => k.startsWith('nuqta_'))).toEqual([]);
    expect(localStorage.getItem('other_app_key')).toBe('keep me');
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
  });
});

describe('metadata is validated in full, not merely for a numeric schemaVersion', () => {
  /**
   * Every case below has a NUMERIC schemaVersion, so a naive check ("is schemaVersion a
   * number?") would treat it as valid. Each is nonetheless incomplete or malformed and
   * must be treated as invalid, which means the recoverable localStorage data is
   * preserved rather than silently overwritten by the mirror.
   */
  const incompleteMetadata: Array<[string, string]> = [
    ['numeric schemaVersion with no createdAt', JSON.stringify({ schemaVersion: 1 })],
    ['numeric schemaVersion with a non-string createdAt', JSON.stringify({ schemaVersion: 1, createdAt: 42 })],
    ['numeric schemaVersion with an empty createdAt', JSON.stringify({ schemaVersion: 1, createdAt: '' })],
    ['numeric schemaVersion with a non-integer version', JSON.stringify({ schemaVersion: 1.5, createdAt: 'x' })],
    ['numeric schemaVersion with a non-boolean demo flag', JSON.stringify({ schemaVersion: 1, createdAt: 'x', demo: 'yes' })],
    ['numeric schemaVersion with a string version', JSON.stringify({ schemaVersion: '1', createdAt: 'x' })]
  ];

  it.each(incompleteMetadata)('does NOT overwrite localStorage when the record has a %s', async (_name, meta) => {
    clearStorageIssues();
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    localStorage.setItem(META_KEY, meta);

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a', 'b']);
    expect(getStorageIssues().some((i) => i.kind === 'corrupt' && i.key === META_KEY)).toBe(true);
  });

  it('accepts a COMPLETE metadata record (valid version, createdAt, optional demo)', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    localStorage.setItem(META_KEY, JSON.stringify({ schemaVersion: 1, createdAt: '2026-01-01T00:00:00.000Z' }));
    // Valid metadata => localStorage is intact => never recover.
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a']);
  });

  it('still recovers when the metadata is incomplete AND localStorage is genuinely empty', async () => {
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nuqta_') && !k.includes('__corrupt_'))
      .forEach((k) => localStorage.removeItem(k));
    // Numeric schemaVersion but no createdAt: incomplete, so recovery is allowed to run.
    localStorage.setItem(META_KEY, JSON.stringify({ schemaVersion: 1 }));

    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(true);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a']);
  });
});

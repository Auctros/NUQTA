import { describe, it, expect, beforeEach, vi } from 'vitest';

// The module memoizes its connection, so each test needs a fresh instance.
const load = () => import('../src/lib/indexedDB');

/** Open a database at an older version with a subset of stores, then close it. */
function seedLegacyDb(version: number, storeNames: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nuqta_local_db', version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of storeNames) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

describe('IndexedDB notification store upgrade', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates the notifications store on a fresh database', async () => {
    const { openNuqtaDB, STORES } = await load();
    const db = await openNuqtaDB();
    expect(db.objectStoreNames.contains(STORES.NOTIFICATIONS)).toBe(true);
    db.close();
  });

  it('adds the notifications store to an existing v2 database', async () => {
    const { openNuqtaDB, STORES } = await load();
    // Simulate an install created before notifications existed.
    await seedLegacyDb(2, [
      STORES.TASKS,
      STORES.HABITS,
      STORES.GOALS,
      STORES.FOCUS,
      STORES.HEALTH,
      STORES.EXPENSES,
      STORES.SAVINGS,
      STORES.JOURNAL,
      STORES.PROFILE,
      STORES.SUNDAY_REVIEWS,
      STORES.HISTORY_AUDIT,
      STORES.META
    ]);

    const db = await openNuqtaDB();
    expect(db.objectStoreNames.contains(STORES.NOTIFICATIONS)).toBe(true);

    // The new store is usable, and the upgrade left existing stores in place.
    const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
    const store = tx.objectStore(STORES.NOTIFICATIONS);
    expect(store.indexNames.contains('createdAt')).toBe(true);
    expect(store.indexNames.contains('dedupeKey')).toBe(true);
    store.put({ id: 'n1', createdAt: '2026-01-01T00:00:00.000Z', dedupeKey: 'k1' });
    await new Promise((res) => { tx.oncomplete = res; });

    expect(db.objectStoreNames.contains(STORES.TASKS)).toBe(true);
    db.close();
  });

  it('mirrors and clears notifications through the shared helpers', async () => {
    const { NuqtaIndexedDB, STORES } = await load();
    await NuqtaIndexedDB.replaceAll(STORES.NOTIFICATIONS, [
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', dedupeKey: 'a' },
      { id: 'b', createdAt: '2026-01-02T00:00:00.000Z', dedupeKey: 'b' }
    ]);

    const rows = await NuqtaIndexedDB.getAll<{ id: string }>(STORES.NOTIFICATIONS);
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b']);

    // replaceAll must remove rows no longer present, so dismissing does not resurrect.
    await NuqtaIndexedDB.replaceAll(STORES.NOTIFICATIONS, [
      { id: 'b', createdAt: '2026-01-02T00:00:00.000Z', dedupeKey: 'b' }
    ]);
    const after = await NuqtaIndexedDB.getAll<{ id: string }>(STORES.NOTIFICATIONS);
    expect(after.map((r) => r.id)).toEqual(['b']);
  });
});

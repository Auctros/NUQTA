/**
 * NUQTA Local-First IndexedDB Engine
 * Zero external cloud dependency, zero API key requirement.
 * Stores all data client-side in browser IndexedDB with seamless migration and fallback.
 */

const DB_NAME = 'nuqta_local_db';
const DB_VERSION = 2;

export const STORES = {
  TASKS: 'tasks',
  HABITS: 'habits',
  GOALS: 'goals',
  FOCUS: 'focus_sessions',
  HEALTH: 'health_metrics',
  EXPENSES: 'expenses',
  SAVINGS: 'savings_goals',
  JOURNAL: 'journal_entries',
  PROFILE: 'profile',
  SUNDAY_REVIEWS: 'sunday_reviews',
  HISTORY_AUDIT: 'history_audit',
  META: 'meta'
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

export function openNuqtaDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Keyed stores with 'id'
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const store = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('scheduledDate', 'scheduledDate', { unique: false });
        store.createIndex('priority', 'priority', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.HABITS)) {
        db.createObjectStore(STORES.HABITS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.FOCUS)) {
        const store = db.createObjectStore(STORES.FOCUS, { keyPath: 'id' });
        store.createIndex('completedAt', 'completedAt', { unique: false });
      }

      // Health metrics keyed by 'date' (YYYY-MM-DD)
      if (!db.objectStoreNames.contains(STORES.HEALTH)) {
        db.createObjectStore(STORES.HEALTH, { keyPath: 'date' });
      }

      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SAVINGS)) {
        db.createObjectStore(STORES.SAVINGS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.JOURNAL)) {
        const store = db.createObjectStore(STORES.JOURNAL, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      // Singletons or keyed by id/key
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SUNDAY_REVIEWS)) {
        db.createObjectStore(STORES.SUNDAY_REVIEWS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.HISTORY_AUDIT)) {
        db.createObjectStore(STORES.HISTORY_AUDIT, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Let schema upgrades / deletes from another tab proceed instead of blocking forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      console.warn('Failed to open NUQTA IndexedDB, falling back to LocalStorage:', request.error);
      dbPromise = null; // allow a later retry instead of caching the failure forever
      reject(request.error);
    };
  });

  return dbPromise;
}

export class NuqtaIndexedDB {
  static async getAll<T>(storeName: StoreName): Promise<T[]> {
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  static async getById<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  static async put<T>(storeName: StoreName, item: T): Promise<void> {
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`NuqtaIndexedDB.put failed for store ${storeName}`, e);
    }
  }

  static async bulkPut<T>(storeName: StoreName, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn(`NuqtaIndexedDB.bulkPut failed for store ${storeName}`, e);
    }
  }

  /**
   * Make the store an exact copy of `items` (clear + put in ONE transaction),
   * so records deleted in the app are also removed here. Resolves true on commit.
   */
  static async replaceAll<T>(storeName: StoreName, items: T[]): Promise<boolean> {
    try {
      const db = await openNuqtaDB();
      return await new Promise<boolean>((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        (items || []).forEach((item) => store.put(item));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch (e) {
      console.warn(`NuqtaIndexedDB.replaceAll failed for store ${storeName}`, e);
      return false;
    }
  }

  static async clearStore(storeName: StoreName): Promise<void> {
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`NuqtaIndexedDB.clearStore failed for store ${storeName}`, e);
    }
  }

  static async deleteById(storeName: StoreName, key: IDBValidKey): Promise<void> {
    try {
      const db = await openNuqtaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`NuqtaIndexedDB.deleteById failed for store ${storeName}`, e);
    }
  }

  static async wipeAll(): Promise<boolean> {
    try {
      const db = await openNuqtaDB();
      const results = await Promise.all(
        Object.values(STORES).map(
          (name) =>
            new Promise<boolean>((resolve) => {
              try {
                const tx = db.transaction(name, 'readwrite');
                tx.objectStore(name).clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
              } catch {
                resolve(false);
              }
            })
        )
      );
      return results.every(Boolean);
    } catch (e) {
      // The database cannot even be opened (e.g. private mode): there is no mirror to
      // recover from either, so there is nothing left to wipe.
      console.warn('NuqtaIndexedDB unavailable during wipe:', e);
      return true;
    }
  }
}

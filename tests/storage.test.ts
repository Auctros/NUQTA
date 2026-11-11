import { describe, it, expect } from 'vitest';
import { NuqtaStorageEngine, getStorageIssues, clearStorageIssues } from '../src/lib/storage';
import { NuqtaIndexedDB, STORES } from '../src/lib/indexedDB';
import { parseBackup } from '../src/lib/backupSchema';
import { emptyHealthRecord } from '../src/lib/healthDefaults';
import { computeDailyEnergyScore } from '../src/lib/energyAlgorithm';
import type { Task } from '../src/types';

const task = (id: string, title = id) => ({ id, title, status: 'todo', priority: 'P2' }) as unknown as Task;
const tick = () => new Promise((r) => setTimeout(r, 50));

describe('first run is genuinely empty (no demo data, no invented values)', () => {
  it('returns empty collections and a blank profile, and WRITES NOTHING while reading', () => {
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
    expect(NuqtaStorageEngine.getHabits()).toEqual([]);
    expect(NuqtaStorageEngine.getGoals()).toEqual([]);
    expect(NuqtaStorageEngine.getExpenses()).toEqual([]);
    expect(NuqtaStorageEngine.getSavingsGoals()).toEqual([]);
    expect(NuqtaStorageEngine.getJournalEntries()).toEqual([]);
    expect(NuqtaStorageEngine.getHealthMetrics()).toEqual({});
    expect(NuqtaStorageEngine.getProfile().name).toBe('');
    expect(localStorage.length).toBe(0);
  });
  it('exporting a backup does not change stored data', () => {
    NuqtaStorageEngine.exportFullBackup();
    expect(localStorage.length).toBe(0);
  });
  it('sample data is opt-in, flagged, only for an empty app, and keeps the profile', () => {
    NuqtaStorageEngine.saveProfile({ ...NuqtaStorageEngine.getProfile(), name: 'Ali' });
    expect(NuqtaStorageEngine.isDemo()).toBe(false);
    expect(NuqtaStorageEngine.loadDemoData()).toBe(true);
    expect(NuqtaStorageEngine.isDemo()).toBe(true);
    expect(NuqtaStorageEngine.getTasks().length).toBeGreaterThan(0);
    expect(NuqtaStorageEngine.getProfile().name).toBe('Ali');
    expect(NuqtaStorageEngine.loadDemoData()).toBe(false); // not empty anymore
  });
});

describe('health data is never invented', () => {
  it('an empty day has nothing logged and scores from tasks alone', () => {
    const rec = emptyHealthRecord('2026-11-11');
    expect(rec.workoutLogged).toBe(false);
    expect(rec.sleepHours).toBe(0);
    expect(rec.weightKg).toBeUndefined();
    expect(computeDailyEnergyScore(rec, [])).toBe(computeDailyEnergyScore(null, []));
  });
  it('logged data still moves the score', () => {
    const rec = { ...emptyHealthRecord('d'), sleepHours: 8, sleepQuality: 5 as const };
    expect(computeDailyEnergyScore(rec, [])).toBeGreaterThan(computeDailyEnergyScore(null, []));
  });
});

describe('corrupt data is preserved, not overwritten', () => {
  it('quarantines invalid JSON and reports it', () => {
    clearStorageIssues();
    localStorage.setItem('nuqta_tasks_v1', '{broken');
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
    const copies = Object.keys(localStorage).filter((k) => k.startsWith('nuqta_tasks_v1__corrupt_'));
    expect(copies).toHaveLength(1);
    expect(localStorage.getItem(copies[0])).toBe('{broken');
    expect(getStorageIssues().some((i) => i.kind === 'corrupt')).toBe(true);
  });
  it('quarantines a wrongly shaped value', () => {
    localStorage.setItem('nuqta_tasks_v1', JSON.stringify({ not: 'an array' }));
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
    expect(Object.keys(localStorage).some((k) => k.includes('__corrupt_'))).toBe(true);
  });
});

describe('backup validation and atomic restore', () => {
  const good = () => NuqtaStorageEngine.exportFullBackup();

  it('round-trips through the versioned envelope', () => {
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    const file = good();
    expect(JSON.parse(file)).toMatchObject({ app: 'nuqta', version: 2 });
    NuqtaStorageEngine.saveTasks([]);
    expect(NuqtaStorageEngine.importBackup(file).ok).toBe(true);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('accepts a legacy flat v1 backup', () => {
    const legacy = JSON.stringify({ tasks: [task('x')], habits: [], goals: [] });
    const r = NuqtaStorageEngine.importBackup(legacy);
    expect(r).toMatchObject({ ok: true, legacy: true });
    expect(NuqtaStorageEngine.getTasks()).toHaveLength(1);
  });
  it.each([
    ['not json', '{nope', 'invalid_json'],
    ['empty object', '{}', 'not_nuqta'],
    ['array', '[]', 'not_nuqta'],
    ['other app', JSON.stringify({ app: 'other', version: 2, data: {} }), 'not_nuqta'],
    ['newer version', JSON.stringify({ app: 'nuqta', version: 99, data: {} }), 'unsupported_version'],
    ['tasks as object', JSON.stringify({ app: 'nuqta', version: 2, data: { tasks: {} } }), 'invalid_section'],
    ['task without id', JSON.stringify({ app: 'nuqta', version: 2, data: { tasks: [{ title: 'x' }] } }), 'invalid_section']
  ])('rejects %s and changes nothing', (_n, input, error) => {
    NuqtaStorageEngine.saveTasks([task('keep')]);
    const before = JSON.stringify(Object.entries(localStorage));
    const r = parseBackup(input);
    expect(r).toMatchObject({ ok: false, error });
    expect(NuqtaStorageEngine.importBackup(input).ok).toBe(false);
    expect(JSON.stringify(Object.entries(localStorage))).toBe(before);
  });
  it('a bad section in an otherwise good file blocks the WHOLE import', () => {
    NuqtaStorageEngine.saveTasks([task('keep')]);
    const mixed = JSON.stringify({ app: 'nuqta', version: 2, data: { tasks: [task('new')], habits: 'oops' } });
    expect(NuqtaStorageEngine.importBackup(mixed).ok).toBe(false);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id)).toEqual(['keep']);
  });
  it('rolls every key back if a write fails midway', () => {
    NuqtaStorageEngine.saveTasks([task('keep')]);
    const snapshot = JSON.stringify(Object.entries(localStorage).sort());
    const file = JSON.stringify({ app: 'nuqta', version: 2, data: { tasks: [task('new')], habits: [], goals: [] } });
    const orig = Storage.prototype.setItem;
    let n = 0;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (++n === 4) throw new DOMException('full', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
    try {
      expect(NuqtaStorageEngine.importBackup(file)).toMatchObject({ ok: false, error: 'write_failed' });
    } finally {
      Storage.prototype.setItem = orig;
    }
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(snapshot);
  });
  it('a failed save is reported instead of failing silently', () => {
    clearStorageIssues();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    try { NuqtaStorageEngine.saveTasks([task('a')]); } finally { Storage.prototype.setItem = orig; }
    expect(getStorageIssues().some((i) => i.kind === 'write_failed')).toBe(true);
  });
});

describe('IndexedDB mirror', () => {
  it('deletions propagate (replace-all semantics)', async () => {
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    NuqtaStorageEngine.saveTasks([task('a')]);
    await tick();
    expect((await NuqtaIndexedDB.getAll<Task>(STORES.TASKS)).map((t) => t.id)).toEqual(['a']);
    NuqtaStorageEngine.saveTasks([]);
    await tick();
    expect(await NuqtaIndexedDB.getAll(STORES.TASKS)).toEqual([]);
  });
  it('recovers from the mirror when localStorage was lost', async () => {
    NuqtaStorageEngine.saveTasks([task('a'), task('b')]);
    await tick();
    localStorage.clear(); // e.g. localStorage evicted, IndexedDB survived
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(true);
    expect(NuqtaStorageEngine.getTasks().map((t) => t.id).sort()).toEqual(['a', 'b']);
  });
  it('does not "recover" on a clean first run', async () => {
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
  });
});

describe('wipe', () => {
  it('clears BOTH stores, only touches nuqta_ keys, and is never undone by recovery', async () => {
    localStorage.setItem('other_app_key', 'keep me');
    NuqtaStorageEngine.saveTasks([task('a')]);
    NuqtaStorageEngine.saveJournalEntries([{ id: 'j1', content: 'private' } as any]);
    await tick();
    expect(await NuqtaStorageEngine.wipeAll()).toBe(true);
    expect(Object.keys(localStorage).filter((k) => k.startsWith('nuqta_'))).toEqual([]);
    expect(localStorage.getItem('other_app_key')).toBe('keep me');
    for (const name of Object.values(STORES)) expect(await NuqtaIndexedDB.getAll(name)).toEqual([]);
    expect(await NuqtaStorageEngine.recoverFromMirrorIfNeeded()).toBe(false);
    expect(NuqtaStorageEngine.getTasks()).toEqual([]);
  });
});

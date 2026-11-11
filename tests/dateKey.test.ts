import { describe, it, expect, vi, afterEach } from 'vitest';
import { localDateKey, parseDateKey, addDaysToKey, isDateKey } from '../src/lib/dateKey';

afterEach(() => vi.useRealTimers());

describe('local calendar dates (running in Africa/Cairo, UTC+2)', () => {
  it('uses the LOCAL day after local midnight, where the UTC day is still yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T22:30:00Z')); // 00:30 on 12 Nov in Cairo
    expect(new Date().toISOString().split('T')[0]).toBe('2026-11-11'); // the old, wrong way
    expect(localDateKey()).toBe('2026-11-12');
  });
  it('parseDateKey is local midnight, never UTC', () => {
    const d = parseDateKey('2026-11-12')!;
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });
  it('rejects impossible dates', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(parseDateKey('nope')).toBeNull();
  });
  it('adds days across month ends', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

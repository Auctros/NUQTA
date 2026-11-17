import { describe, it, expect } from 'vitest';
import {
  WEEK_DAY_ORDER,
  WEEK_START_DOW,
  WEEK_OFF_DOW,
  dayOfWeek,
  indexFromWeekStart,
  isWeekOff,
  isWorkingDay,
  startOfWeekKey,
  endOfWeekKey,
  weekDayKeys,
  elapsedWeekDayKeys,
  weekDayLabel,
  weekDayNarrow,
  weekDayLabels,
  weekDayLabelOf,
  currentWeekStartKey
} from '../src/lib/week';

// 2026-11-07 is a Saturday; 2026-11-13 is a Friday (NUQTA's day off).
describe('week module (Saturday-first, Friday off)', () => {
  it('declares a Saturday-first week with Friday as the day off', () => {
    expect(WEEK_START_DOW).toBe(6);
    expect(WEEK_OFF_DOW).toBe(5);
    expect(WEEK_DAY_ORDER).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('maps day keys to week position starting at Saturday', () => {
    expect(indexFromWeekStart('2026-11-07')).toBe(0); // Sat
    expect(indexFromWeekStart('2026-11-08')).toBe(1); // Sun
    expect(indexFromWeekStart('2026-11-13')).toBe(6); // Fri
    expect(indexFromWeekStart('2026-11-09')).toBe(2); // Mon
  });

  it('treats every day except Friday as a working day', () => {
    expect(isWeekOff('2026-11-13')).toBe(true); // Friday
    expect(isWorkingDay('2026-11-13')).toBe(false);
    expect(isWorkingDay('2026-11-07')).toBe(true); // Saturday
    expect(isWorkingDay('2026-11-08')).toBe(true); // Sunday
  });

  it('aligns a week to its Saturday start and Friday end', () => {
    expect(startOfWeekKey('2026-11-13')).toBe('2026-11-07'); // Fri -> Sat
    expect(endOfWeekKey('2026-11-13')).toBe('2026-11-13'); // Fri -> itself
    expect(startOfWeekKey('2026-11-07')).toBe('2026-11-07'); // Sat -> itself
    expect(startOfWeekKey('2026-11-09')).toBe('2026-11-07'); // Mon -> Sat
  });

  it('returns the seven keys of the week in Sat..Fri order', () => {
    expect(weekDayKeys('2026-11-13')).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13'
    ]);
  });

  it('lists only the elapsed days of the current week, week-to-date', () => {
    // Monday 2026-11-09: Sat, Sun and Mon have happened; the rest of the week has not.
    expect(elapsedWeekDayKeys('2026-11-09')).toEqual(['2026-11-07', '2026-11-08', '2026-11-09']);
    // On the Saturday that starts the week only that day counts.
    expect(elapsedWeekDayKeys('2026-11-07')).toEqual(['2026-11-07']);
    // On Friday the whole Sat..Fri week is elapsed.
    expect(elapsedWeekDayKeys('2026-11-13')).toHaveLength(7);
  });

  it('crosses a month boundary without drifting', () => {
    // 2026-10-31 is a Saturday, so the week is 10-31 .. 11-06.
    expect(startOfWeekKey('2026-11-02')).toBe('2026-10-31');
    expect(weekDayKeys('2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06'
    ]);
  });

  it('reads the weekday from a Date, an instant and a key alike', () => {
    expect(dayOfWeek('2026-11-07')).toBe(6);
    expect(dayOfWeek(new Date(2026, 10, 7, 12))).toBe(6);
  });

  it('localises labels in NUQTA week order', () => {
    expect(weekDayLabel(6, false)).toBe('Sat');
    expect(weekDayLabel(5, false)).toBe('Fri');
    expect(weekDayLabels(false)[0]).toBe('Sat');
    expect(weekDayLabels(false)[6]).toBe('Fri');
    expect(weekDayLabelOf('2026-11-07', false)).toBe('Sat');
    expect(weekDayNarrow(6, false)).toBe('S');
  });

  it('defaults the current week start to today when no key is given', () => {
    expect(currentWeekStartKey('2026-11-09')).toBe('2026-11-07');
  });
});

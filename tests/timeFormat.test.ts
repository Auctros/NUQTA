import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultTimeFormat,
  formatTimeLabel,
  fromHour12,
  parseTimeValue,
  parseTypedTime,
  readTimeFormat,
  resetTimeFormatCache,
  toHour12,
  toTimeValue,
  writeTimeFormat
} from '../src/lib/timeFormat';

beforeEach(() => {
  localStorage.clear();
  resetTimeFormatCache();
});

describe('parseTimeValue / toTimeValue', () => {
  it('round-trips a stored value', () => {
    expect(parseTimeValue('09:30')).toEqual({ h: 9, m: 30 });
    expect(toTimeValue(9, 30)).toBe('09:30');
  });

  it('accepts a single-digit hour', () => {
    expect(parseTimeValue('9:05')).toEqual({ h: 9, m: 5 });
  });

  it('rejects malformed and out-of-range values', () => {
    for (const bad of ['', 'abc', '24:00', '12:60', '-1:00', '12', '12:5']) {
      expect(parseTimeValue(bad)).toBeNull();
    }
  });

  it('normalises an out-of-range hour when writing', () => {
    expect(toTimeValue(25, 5)).toBe('01:05');
    expect(toTimeValue(-1, 5)).toBe('23:05');
  });
});

describe('12-hour conversion', () => {
  it('maps midnight and noon to 12', () => {
    expect(toHour12(0)).toEqual({ hour: 12, period: 'am' });
    expect(toHour12(12)).toEqual({ hour: 12, period: 'pm' });
  });

  it('maps the afternoon and evening', () => {
    expect(toHour12(9)).toEqual({ hour: 9, period: 'am' });
    expect(toHour12(13)).toEqual({ hour: 1, period: 'pm' });
    expect(toHour12(23)).toEqual({ hour: 11, period: 'pm' });
  });

  it('inverts without loss for every hour of the day', () => {
    for (let h = 0; h < 24; h += 1) {
      const { hour, period } = toHour12(h);
      expect(fromHour12(hour, period)).toBe(h);
    }
  });
});

describe('formatTimeLabel', () => {
  it('leaves 24-hour output identical to the stored value', () => {
    expect(formatTimeLabel('21:45', '24h')).toBe('21:45');
    expect(formatTimeLabel('09:05', '24h')).toBe('09:05');
  });

  it('renders 12-hour output with a period', () => {
    expect(formatTimeLabel('21:45', '12h')).toBe('9:45 PM');
    expect(formatTimeLabel('00:15', '12h')).toBe('12:15 AM');
    expect(formatTimeLabel('12:00', '12h')).toBe('12:00 PM');
  });

  it('uses Arabic meridiem markers when isAr', () => {
    expect(formatTimeLabel('21:45', '12h', true)).toBe('9:45 م');
    expect(formatTimeLabel('09:30', '12h', true)).toBe('9:30 ص');
  });

  it('passes an unparseable value through untouched', () => {
    expect(formatTimeLabel('', '12h')).toBe('');
    expect(formatTimeLabel('noon', '12h')).toBe('noon');
  });
});

describe('parseTypedTime', () => {
  it('accepts a bare hour', () => {
    expect(parseTypedTime('9', '24h')).toBe('09:00');
  });

  it('accepts the common separators', () => {
    expect(parseTypedTime('9:30', '24h')).toBe('09:30');
    expect(parseTypedTime('9.30', '24h')).toBe('09:30');
    expect(parseTypedTime('930', '24h')).toBe('09:30');
    expect(parseTypedTime('21:45', '24h')).toBe('21:45');
  });

  it('honours an explicit period in either language', () => {
    expect(parseTypedTime('7:05 pm', '12h')).toBe('19:05');
    expect(parseTypedTime('7:05 a', '12h')).toBe('07:05');
    expect(parseTypedTime('7:05 م', '12h')).toBe('19:05');
    expect(parseTypedTime('12:30 am', '12h')).toBe('00:30');
    expect(parseTypedTime('12:30 pm', '12h')).toBe('12:30');
  });

  it('refuses an ambiguous 24-hour hour in 12-hour mode', () => {
    expect(parseTypedTime('21:45', '12h')).toBeNull();
  });

  it('refuses impossible times', () => {
    for (const bad of ['', '   ', '99:99', '9:75', '0:00 am', '13:00 pm', 'later']) {
      expect(parseTypedTime(bad, '12h')).toBeNull();
    }
  });
});

describe('the preference itself', () => {
  it('defaults to 24-hour so existing screens do not change', () => {
    expect(defaultTimeFormat()).toBe('24h');
    expect(readTimeFormat()).toBe('24h');
  });

  it('persists a change', () => {
    writeTimeFormat('12h');
    resetTimeFormatCache();
    expect(readTimeFormat()).toBe('12h');
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('nuqta.ui.timeFormat', 'fuzzy');
    resetTimeFormatCache();
    expect(readTimeFormat()).toBe('24h');
  });

  it('stays out of the nuqta_ dataset namespace', () => {
    writeTimeFormat('12h');
    // A `nuqta_` key would be mistaken for user data and block mirror recovery.
    expect(localStorage.getItem('nuqta.ui.timeFormat')).toBe('12h');
    expect(Object.keys(localStorage).some((k) => k.startsWith('nuqta_'))).toBe(false);
  });
});

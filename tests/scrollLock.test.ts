import { beforeEach, describe, expect, it } from 'vitest';
import { lockPageScroll, resetScrollLock, unlockPageScroll } from '../src/lib/scrollLock';

beforeEach(() => {
  resetScrollLock();
  document.body.style.overflow = '';
});

describe('scrollLock', () => {
  it('restores the pre-overlay value, never the locked one', () => {
    document.body.style.overflow = 'scroll';
    const a = lockPageScroll();
    const b = lockPageScroll();
    expect(document.body.style.overflow).toBe('hidden');

    unlockPageScroll(b);
    expect(document.body.style.overflow).toBe('hidden');
    unlockPageScroll(a);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('ignores a double release instead of freeing another owner', () => {
    const a = lockPageScroll();
    const b = lockPageScroll();

    unlockPageScroll(a);
    unlockPageScroll(a);
    // `b` still holds the page; a second release of `a` must not unlock it.
    expect(document.body.style.overflow).toBe('hidden');

    unlockPageScroll(b);
    expect(document.body.style.overflow).toBe('');
  });

  it('survives an unlock before any lock', () => {
    expect(() => unlockPageScroll({})).not.toThrow();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('scrollLock reset seam', () => {
  it('restores the page instead of leaving it locked', () => {
    lockPageScroll();
    expect(document.body.style.overflow).toBe('hidden');

    resetScrollLock();
    expect(document.body.style.overflow).toBe('');

    // A leaked `hidden` would be recorded as the next pre-overlay value and
    // every release afterwards would "restore" a locked page.
    const token = lockPageScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlockPageScroll(token);
    expect(document.body.style.overflow).toBe('');
  });
});

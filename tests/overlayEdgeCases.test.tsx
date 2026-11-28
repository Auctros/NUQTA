import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../src/components/ui/overlays';
import { OVERLAY_TIMING } from '../src/lib/motion';
import { resetScrollLock } from '../src/lib/scrollLock';
import { resetOverlayStack } from '../src/lib/overlayStack';

/* ============================================================
   Overlay state must not leak between sessions.

   These target the four transitions a user can actually produce
   and that a naive presence timer gets wrong: abandoning an
   entrance, reopening during an exit, and handing over from one
   modal to another.
   ============================================================ */

const dialog = () => document.querySelector('[role="dialog"]');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  resetScrollLock();
  resetOverlayStack();
  document.body.style.overflow = '';
});

const renderModal = (open: boolean, onClose = () => {}, title = 'A') => (
  <Modal open={open} onClose={onClose} title={title}>
    <button type="button">inside</button>
  </Modal>
);

describe('overlay state isolation', () => {
  it('open then close before the entrance finishes leaves nothing behind', () => {
    const { rerender } = render(renderModal(true));
    expect(dialog()).toBeTruthy();

    // Close one frame in: the entrance never completed.
    act(() => vi.advanceTimersByTime(16));
    rerender(renderModal(false));

    expect(dialog()!.getAttribute('data-state')).toBe('closed');
    expect(dialog()!.hasAttribute('inert')).toBe(true);

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut + 1));
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('reopening during the exit reverses it without replaying the entrance', () => {
    const { rerender } = render(renderModal(true));
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelIn));

    rerender(renderModal(false));
    expect(dialog()!.getAttribute('data-state')).toBe('closed');

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut - 60));
    rerender(renderModal(true));

    const node = dialog()!;
    expect(node.getAttribute('data-state')).toBe('open');
    expect(node.hasAttribute('inert')).toBe(false);
    // The surface never unmounted, so it must not be in its entrance offset state.
    expect(node.className).not.toContain('nq-panel--entering');

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut * 3));
    expect(dialog()).toBe(node);
  });

  it('changing the title mid-life does not remount or re-enter the panel', () => {
    const { rerender } = render(renderModal(true, () => {}, 'A'));
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelIn));
    const node = dialog()!;

    rerender(renderModal(true, () => {}, 'B'));

    expect(dialog()).toBe(node);
    expect(node.className).not.toContain('nq-panel--entering');
    expect(node.getAttribute('aria-label')).toBe('B');
  });

  it('Escape closes only the topmost dialog, not the whole stack', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    render(
      <div>
        <Modal open onClose={closeA} title="A"><p>a</p></Modal>
        <Modal open onClose={closeB} title="B"><p>b</p></Modal>
      </div>
    );
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(2);

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });

    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('returns focus to the element that opened the dialog', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(renderModal(true));
    act(() => vi.advanceTimersByTime(50));
    expect(document.activeElement).toBe(dialog());

    rerender(renderModal(false));
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut + 1));

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keeps the page locked while handing over from one modal to the next', () => {
    const { rerender } = render(
      <div>
        {renderModal(true, () => {}, 'First')}
        {renderModal(false, () => {}, 'Second')}
      </div>
    );

    // Close the first and open the second in the same commit.
    rerender(
      <div>
        {renderModal(false, () => {}, 'First')}
        {renderModal(true, () => {}, 'Second')}
      </div>
    );

    expect(document.querySelectorAll('[role="dialog"]').length).toBe(2);
    expect(document.body.style.overflow).toBe('hidden');

    // When the outgoing panel's timer fires it must not unlock the page.
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut + 1));

    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');
  });
});


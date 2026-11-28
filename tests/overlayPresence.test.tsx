import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal, Sheet } from '../src/components/ui/overlays';
import { OVERLAY_TIMING } from '../src/lib/motion';

/* ============================================================
   Overlay lifecycle on the timer-driven presence.

   These assert what a user can observe — presence in the DOM,
   inertness while dying, scroll lock, focus — rather than the
   internal shape of the animation.
   ============================================================ */

const dialog = () => document.querySelector('[role="dialog"]');
const backdrop = () => document.querySelector('.nq-backdrop');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Modal lifecycle', () => {
  it('mounts, locks scroll, and unmounts for real after closing', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>
    );

    expect(dialog()).toBeTruthy();
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog()!.getAttribute('data-state')).toBe('open');

    rerender(
      <Modal open={false} onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>
    );

    // Still mounted, but already inert and hidden from the a11y tree.
    expect(dialog()).toBeTruthy();
    expect(dialog()!.getAttribute('data-state')).toBe('closed');
    expect(dialog()!.hasAttribute('inert')).toBe(true);
    expect(dialog()!.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    // The node is genuinely gone, not merely transparent.
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut + 1));
    expect(dialog()).toBeNull();
    expect(backdrop()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('reopening before the exit ends returns to open without unmounting', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="Settings"><p>Body</p></Modal>
    );

    rerender(<Modal open={false} onClose={onClose} title="Settings"><p>Body</p></Modal>);
    expect(dialog()!.getAttribute('data-state')).toBe('closed');

    // Reopen halfway through the exit.
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut - 40));
    rerender(<Modal open onClose={onClose} title="Settings"><p>Body</p></Modal>);

    expect(dialog()).toBeTruthy();
    expect(dialog()!.getAttribute('data-state')).toBe('open');
    expect(dialog()!.hasAttribute('inert')).toBe(false);
    expect(dialog()!.getAttribute('aria-hidden')).toBeNull();

    // The cancelled timer must not have fired later.
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut * 2));
    expect(dialog()).toBeTruthy();
  });

  it('Escape closes once, and the backdrop closes too', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Settings"><p>Body</p></Modal>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(backdrop()!);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Clicks inside the panel must not bubble out as a close.
    fireEvent.mouseDown(dialog()!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the panel on open', () => {
    render(<Modal open onClose={() => {}} title="Settings"><p>Body</p></Modal>);
    act(() => vi.advanceTimersByTime(50));
    expect(document.activeElement).toBe(dialog());
  });

  it('carries the entrance direction as CSS variables, not inline keyframes', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="S" direction="left"><p>B</p></Modal>
    );
    const panel = dialog() as HTMLElement;
    expect(panel.style.getPropertyValue('--nq-enter-x')).toBe('-22px');
    expect(panel.style.getPropertyValue('--nq-enter-ry')).toBe('6deg');

    rerender(<Modal open onClose={() => {}} title="S" direction="bottom"><p>B</p></Modal>);
    const panel2 = dialog() as HTMLElement;
    expect(panel2.style.getPropertyValue('--nq-enter-y')).toBe('18px');
    expect(panel2.style.getPropertyValue('--nq-enter-rx')).toBe('6deg');
  });
});

describe('Sheet lifecycle', () => {
  it('unmounts after closing and keeps the exit side for RTL', () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Filters"><p>Body</p></Sheet>
    );
    const panel = () => document.querySelector('.nq-panel--sheet') as HTMLElement;
    expect(panel().getAttribute('data-side')).toBe('end');

    rerender(<Sheet open={false} onClose={() => {}} title="Filters"><p>Body</p></Sheet>);
    expect(panel().getAttribute('data-state')).toBe('closed');
    expect(panel().hasAttribute('inert')).toBe(true);

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.panelOut + 1));
    expect(panel()).toBeNull();
  });

  it('bottom sheets report their own side', () => {
    render(<Sheet open onClose={() => {}} title="Filters" side="bottom"><p>Body</p></Sheet>);
    const panel = document.querySelector('.nq-panel--sheet') as HTMLElement;
    expect(panel.getAttribute('data-side')).toBe('bottom');
  });
});

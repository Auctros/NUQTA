import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '../src/components/motion/ContextMenu';
import { NuqtaSelect } from '../src/components/ui/NuqtaSelect';
import { OVERLAY_TIMING } from '../src/lib/motion';

/* ============================================================
   Menu lifecycle on the timer-driven presence.

   The bug these guard against is specific: a menu that only
   hides visually and stays in the DOM. Every close is asserted
   to end in true removal, and the exiting state must already be
   inert and hidden from assistive tech.
   ============================================================ */

const menu = () => document.querySelector('[role="menu"]');
const listbox = () => document.querySelector('[role="listbox"]');

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ContextMenu lifecycle', () => {
  const setup = () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        ariaLabel="Row actions"
        items={[
          { kind: 'item', id: 'open', label: 'Open', onSelect },
          { kind: 'item', id: 'archive', label: 'Archive', onSelect },
          { kind: 'separator', id: 'sep' },
          { kind: 'checkbox', id: 'pin', label: 'Pin', checked: true, onSelect }
        ]}
      >
        <button type="button">Row</button>
      </ContextMenu>
    );
    return { onSelect };
  };

  const openMenu = () => {
    const row = screen.getByText('Row');
    fireEvent.contextMenu(row, { clientX: 40, clientY: 40 });
  };

  it('opens on contextmenu and unmounts for real after Escape', () => {
    setup();
    openMenu();
    expect(menu()).toBeTruthy();
    expect(menu()!.getAttribute('data-state')).toBe('open');
    expect(menu()!.hasAttribute('inert')).toBe(false);

    fireEvent.keyDown(document, { key: 'Escape' });
    // Exiting: still in the DOM, but already out of reach.
    expect(menu()).toBeTruthy();
    expect(menu()!.getAttribute('data-state')).toBe('closed');
    expect(menu()!.hasAttribute('inert')).toBe(true);
    expect(menu()!.getAttribute('aria-hidden')).toBe('true');

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut + 1));
    expect(menu()).toBeNull();
  });

  it('unmounts after an outside click, not just visually', () => {
    setup();
    openMenu();
    expect(menu()).toBeTruthy();
    fireEvent.mouseDown(document.body);
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut + 1));
    expect(menu()).toBeNull();
  });

  it('reopening mid-exit keeps the same node and never duplicates', () => {
    setup();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu()!.getAttribute('data-state')).toBe('closed');

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut - 30));
    openMenu();

    expect(document.querySelectorAll('[role="menu"]').length).toBe(1);
    expect(menu()!.getAttribute('data-state')).toBe('open');
    expect(menu()!.hasAttribute('inert')).toBe(false);

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut * 3));
    expect(menu()).toBeTruthy();
  });

  it('renders checkbox state and separators with correct ARIA', () => {
    setup();
    openMenu();
    expect(menu()!.querySelector('[role="separator"]')).toBeTruthy();
    const box = menu()!.querySelector('[role="menuitemcheckbox"]');
    expect(box?.getAttribute('aria-checked')).toBe('true');
  });

  it('activates a row on click and closes', () => {
    const { onSelect } = setup();
    openMenu();
    fireEvent.click(screen.getByText('Archive'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut + 1));
    expect(menu()).toBeNull();
  });

  it('moves aria-activedescendant with the arrow keys', () => {
    setup();
    openMenu();
    const panel = menu()!;
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    expect(panel.getAttribute('aria-activedescendant')).toBe('ctx-item-open');
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    expect(panel.getAttribute('aria-activedescendant')).toBe('ctx-item-archive');
  });
});

describe('NuqtaSelect lifecycle', () => {
  const setup = () => {
    const onChange = vi.fn();
    render(
      <NuqtaSelect ariaLabel="Sort" value="due" onChange={onChange}>
        <option value="due">Due</option>
        <option value="priority">Priority</option>
      </NuqtaSelect>
    );
    return { onChange };
  };

  it('opens, commits a choice, and removes the listbox', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('combobox'));
    expect(listbox()).toBeTruthy();
    expect(listbox()!.getAttribute('data-state')).toBe('open');

    const option = screen.getByText('Priority');
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut + 1));
    expect(listbox()).toBeNull();
  });

  it('marks the listbox inert while closing, then unmounts it', () => {
    setup();
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    // Escape is handled on the trigger, which keeps focus while the list is open.
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(listbox()!.getAttribute('data-state')).toBe('closed');
    expect(listbox()!.hasAttribute('inert')).toBe(true);

    act(() => vi.advanceTimersByTime(OVERLAY_TIMING.menuOut + 1));
    expect(listbox()).toBeNull();
  });
});

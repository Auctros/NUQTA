import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WheelColumn } from '../src/components/ui/TimeWheel';

/**
 * The drum is the one place where a wrong pixel is a wrong value. These tests pin
 * what can be asserted without layout: which row is marked, and what the keyboard
 * and pointer do. Scroll-to-index mapping needs real geometry and is covered by
 * the browser probe in scripts/e2e, not by jsdom.
 */

const options = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0')
}));

const renderWheel = (index = 0, onChange = vi.fn()) => {
  render(
    <WheelColumn label="Hour" options={options} index={index} onIndexChange={onChange} />
  );
  return { onChange, list: screen.getByRole('listbox', { name: 'Hour' }) };
};

const selected = (list: HTMLElement) =>
  list.querySelector('[aria-selected="true"]')!.getAttribute('aria-label');

describe('WheelColumn', () => {
  it('marks exactly one row as selected', () => {
    const { list } = renderWheel(9);
    expect(list.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    expect(selected(list)).toBe('09');
  });

  it('renders every option as a row', () => {
    const { list } = renderWheel();
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(24);
  });

  it('is a focusable vertical listbox', () => {
    const { list } = renderWheel();
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
    expect(list.tabIndex).toBe(0);
  });

  it('moves down one row per ArrowDown', () => {
    const { onChange, list } = renderWheel(5);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('moves up one row per ArrowUp', () => {
    const { onChange, list } = renderWheel(5);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('jumps to the ends with Home and End', () => {
    const { onChange, list } = renderWheel(5);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(list, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(23);
  });

  it('pages by five rows', () => {
    const { onChange, list } = renderWheel(10);
    fireEvent.keyDown(list, { key: 'PageDown' });
    expect(onChange).toHaveBeenLastCalledWith(15);
    fireEvent.keyDown(list, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('does not report a move past the first row', () => {
    const { onChange, list } = renderWheel(0);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not report a move past the last row', () => {
    const { onChange, list } = renderWheel(23);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects a row that is tapped', () => {
    const { onChange, list } = renderWheel(5);
    fireEvent.click(list.querySelectorAll('[role="option"]')[8]);
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('ignores a tap on the row that is already selected', () => {
    const { onChange, list } = renderWheel(5);
    fireEvent.click(list.querySelectorAll('[role="option"]')[5]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores keys while disabled', () => {
    const onChange = vi.fn();
    render(
      <WheelColumn label="Hour" options={options} index={5} onIndexChange={onChange} disabled />
    );
    const list = screen.getByRole('listbox', { name: 'Hour' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).not.toHaveBeenCalled();
    expect(list.tabIndex).toBe(-1);
  });

  it('fades distant rows out of the hit area', () => {
    const { list } = renderWheel(10);
    const rows = list.querySelectorAll<HTMLElement>('[role="option"]');
    // Row 0 is ten steps away: visible enough to hint at, too far to tap.
    expect(rows[0].style.pointerEvents).toBe('none');
    expect(rows[10].style.pointerEvents).toBe('');
  });
});

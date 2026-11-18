import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NuqtaDatePicker, NuqtaTimePicker } from '../src/components/ui/NuqtaPickers';

const renderDate = (props: Partial<React.ComponentProps<typeof NuqtaDatePicker>> = {}) => {
  const onChange = vi.fn();
  render(<NuqtaDatePicker value="2026-11-12" onChange={onChange} ariaLabel="Pick date" {...props} />);
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Pick date' }) };
};

const renderTime = (props: Partial<React.ComponentProps<typeof NuqtaTimePicker>> = {}) => {
  const onChange = vi.fn();
  render(<NuqtaTimePicker value="09:30" onChange={onChange} ariaLabel="Pick time" {...props} />);
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Pick time' }) };
};

describe('NuqtaDatePicker', () => {
  it('renders the formatted value, not the raw key', () => {
    const { trigger } = renderDate();
    expect(trigger.textContent).toContain('2026');
    expect(trigger.textContent).not.toContain('2026-11-12');
  });

  it('shows the placeholder when empty', () => {
    const { trigger } = renderDate({ value: '', placeholder: 'No date' });
    expect(trigger.textContent).toContain('No date');
  });

  it('opens a calendar dialog on click', () => {
    const { trigger } = renderDate();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The selected day is exposed to assistive tech.
    expect(screen.getByRole('button', { name: '2026-11-12' }).getAttribute('aria-selected')).toBe('true');
  });

  it('emits a "YYYY-MM-DD" value through target.value when a day is picked', () => {
    const { onChange, trigger } = renderDate();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('button', { name: '2026-11-20' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('2026-11-20');
  });

  it('does not fire when re-picking the same day', () => {
    const { onChange, trigger } = renderDate();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('button', { name: '2026-11-12' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigates months and selects a day in the new month', () => {
    const { onChange, trigger } = renderDate();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: '2026-12-05' }));
    expect(onChange.mock.calls[0][0].target.value).toBe('2026-12-05');
  });

  it('jumps to today via the Today action', () => {
    const { onChange, trigger } = renderDate({ value: '' });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText('Today'));
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    expect(onChange.mock.calls[0][0].target.value).toBe(key);
  });

  it('honours min/max by disabling out-of-range days', () => {
    const { trigger } = renderDate({ min: '2026-11-10', max: '2026-11-15' });
    fireEvent.click(trigger);
    expect((screen.getByRole('button', { name: '2026-11-09' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '2026-11-20' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '2026-11-12' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('clears the value through the clear affordance', () => {
    const { onChange, trigger } = renderDate({ clearable: true });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange.mock.calls[0][0].target.value).toBe('');
    // The trigger itself must not toggle the panel open when clearing.
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape', () => {
    const { trigger } = renderDate();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on outside click', () => {
    const { trigger } = renderDate();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open when disabled', () => {
    const { trigger } = renderDate({ disabled: true });
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('labels the panel and chrome in Arabic when isAr', () => {
    const { trigger } = renderDate({ isAr: true });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('اليوم')).toBeTruthy();
  });
});

describe('NuqtaTimePicker', () => {
  it('renders the stored "HH:mm" value', () => {
    const { trigger } = renderTime();
    expect(trigger.textContent).toContain('09:30');
  });

  it('shows the placeholder when empty', () => {
    const { trigger } = renderTime({ value: '', placeholder: 'No time' });
    expect(trigger.textContent).toContain('No time');
  });

  it('opens an hour + minute dialog', () => {
    const { trigger } = renderTime();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByRole('listbox')).toHaveLength(2);
  });

  it('emits "HH:mm" when an hour is picked, keeping the minute', () => {
    const { onChange, trigger } = renderTime();
    fireEvent.click(trigger);
    const hours = screen.getAllByRole('listbox')[0];
    fireEvent.mouseDown(hours.querySelector('[data-selected="true"]')!.nextElementSibling!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toMatch(/^\d{2}:30$/);
  });

  it('emits "HH:mm" when a minute is picked, keeping the hour', () => {
    const { onChange, trigger } = renderTime();
    fireEvent.click(trigger);
    const minutes = screen.getAllByRole('listbox')[1];
    fireEvent.mouseDown(minutes.querySelector('[data-selected="true"]')!.nextElementSibling!);
    expect(onChange.mock.calls[0][0].target.value).toBe('09:31');
  });

  it('defaults an empty value to the chosen hour at :00', () => {
    const { onChange, trigger } = renderTime({ value: '' });
    fireEvent.click(trigger);
    const hours = screen.getAllByRole('listbox')[0];
    fireEvent.mouseDown(hours.querySelector('[role="option"]')!); // 00
    expect(onChange.mock.calls[0][0].target.value).toBe('00:00');
  });

  it('honours a minute step', () => {
    const { trigger } = renderTime({ minuteStep: 15 });
    fireEvent.click(trigger);
    const minutes = screen.getAllByRole('listbox')[1];
    expect(minutes.querySelectorAll('[role="option"]')).toHaveLength(4); // 00,15,30,45
  });

  it('clears the value through the clear affordance', () => {
    const { onChange } = renderTime({ clearable: true });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange.mock.calls[0][0].target.value).toBe('');
  });

  it('closes on Escape', () => {
    const { trigger } = renderTime();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open when disabled', () => {
    const { trigger } = renderTime({ disabled: true });
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

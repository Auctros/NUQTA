import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { NuqtaSelect } from '../src/components/ui/NuqtaSelect';

const OPTIONS = [
  { value: 'career', label: 'Career' },
  { value: 'health', label: 'Health' },
  { value: 'finance', label: 'Finance', disabled: true },
  { value: 'personal', label: 'Personal' }
];

const setup = (props: Partial<React.ComponentProps<typeof NuqtaSelect>> = {}) => {
  const onChange = vi.fn();
  render(
    <NuqtaSelect value="career" onChange={onChange} options={OPTIONS} ariaLabel="Category" {...props} />
  );
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Category' }) };
};

describe('NuqtaSelect', () => {
  it('renders the selected label, not the raw value', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('Career');
  });

  it('shows the placeholder when the value matches no option', () => {
    const { trigger } = setup({ value: 'none', placeholder: 'Pick one' });
    expect(trigger.textContent).toContain('Pick one');
  });

  it('opens the listbox on click and marks the current value selected', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(
      within(listbox).getByRole('option', { name: /Career/ }).getAttribute('aria-selected')
    ).toBe('true');
  });

  it('emits a change event carrying the chosen value through target.value', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: /Personal/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('personal');
  });

  it('does not fire when re-selecting the same value', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: /Career/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it('closes on Escape', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it('navigates with arrow keys and commits with Enter', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // -> Health
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange.mock.calls[0][0].target.value).toBe('health');
  });

  it('skips disabled options while navigating', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // Health
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // skips Finance -> Personal
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange.mock.calls[0][0].target.value).toBe('personal');
  });

  it('never commits a disabled option', () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: /Finance/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', () => {
    const { trigger } = setup({ disabled: true });
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

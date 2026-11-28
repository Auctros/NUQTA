import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Dropdown, type DropdownEntry } from '../src/components/motion/Dropdown';
import { Combobox } from '../src/components/motion/Combobox';
import { ContextMenu, type ContextMenuItem } from '../src/components/motion/ContextMenu';

const advance = async () => {
  // Exit animations are driven by motion; give the microtask + rAF queue a turn
  // so the presence hook can unmount the leaving node.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 700));
  });
};

const ITEMS: DropdownEntry[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'sep', separator: true },
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', tone: 'danger' }
];

const trigger = () => screen.getByRole('button', { name: /Actions/i });

describe('Dropdown', () => {
  const setup = (overrides?: Partial<React.ComponentProps<typeof Dropdown>>) => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger="Actions"
        items={ITEMS}
        onSelect={onSelect}
        ariaLabel="Actions"
        {...overrides}
      />
    );
    return { onSelect };
  };

  it('opens with a menu popup and marks the trigger expanded', () => {
    setup();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('selects a row and returns focus to the trigger', () => {
    const { onSelect } = setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onSelect).toHaveBeenCalledWith('archive');
    expect(document.activeElement).toBe(trigger());
  });

  it('skips disabled rows with the arrow keys', () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger="Actions"
        ariaLabel="Actions"
        onSelect={onSelect}
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta', disabled: true },
          { id: 'c', label: 'Gamma' }
        ]}
      />
    );
    const t = trigger();
    fireEvent.keyDown(t, { key: 'ArrowDown' }); // opens
    fireEvent.keyDown(t, { key: 'ArrowDown' }); // -> Beta (disabled) -> Gamma
    fireEvent.keyDown(t, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('closes on Escape and restores focus', async () => {
    setup();
    fireEvent.click(trigger());
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    // The panel animates out; it must already be inert and hidden from the tree.
    const menu = document.querySelector('[role="menu"]');
    expect(menu?.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(trigger());
    await advance();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('does not open when disabled', () => {
    setup({ disabled: true });
    fireEvent.click(trigger());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Combobox', () => {
  const OPTIONS = [
    { value: 'g1', label: 'Read more' },
    { value: 'g2', label: 'Train daily' },
    { value: 'g3', label: 'Save money' }
  ];

  it('filters options by query', () => {
    render(<Combobox options={OPTIONS} value="" onChange={() => {}} ariaLabel="Link goal" />);
    const input = screen.getByRole('combobox', { name: 'Link goal' });
    fireEvent.change(input, { target: { value: 'tr' } });
    expect(screen.getByRole('option', { name: 'Train daily' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Save money' })).toBeNull();
  });

  it('never offers a value that is not a real option', () => {
    const onChange = vi.fn();
    render(<Combobox options={OPTIONS} value="" onChange={onChange} ariaLabel="Link goal" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('prunes chips whose entity was deleted elsewhere', () => {
    const onChange = vi.fn();
    render(
      <Combobox
        mode="multiple"
        options={OPTIONS}
        value={['g1', 'deleted-goal']}
        onChange={onChange}
        ariaLabel="Link goals"
      />
    );
    expect(onChange).toHaveBeenCalledWith(['g1']);
  });

  it('toggles multiple values without closing', () => {
    const onChange = vi.fn();
    render(
      <Combobox mode="multiple" options={OPTIONS} value={['g1']} onChange={onChange} ariaLabel="Link goals" />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'save' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Save money' }));
    expect(onChange).toHaveBeenCalledWith(['g1', 'g3']);
  });

  it('removes the last chip on Backspace when the query is empty', () => {
    const onChange = vi.fn();
    render(
      <Combobox mode="multiple" options={OPTIONS} value={['g1', 'g2']} onChange={onChange} ariaLabel="Link goals" />
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['g1']);
  });

  it('folds Arabic diacritics and letter variants when matching', () => {
    render(
      <Combobox
        options={[{ value: 'a', label: 'إنجاز المهام' }]}
        value=""
        onChange={() => {}}
        ariaLabel="ربط"
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'انجاز' } });
    expect(screen.getByRole('option', { name: 'إنجاز المهام' })).toBeTruthy();
  });
});

describe('ContextMenu', () => {
  const buildItems = (onDelete = vi.fn()) => ({
    onDelete,
    items: [
      { kind: 'item', id: 'open', label: 'Open', onSelect: vi.fn() },
      {
        kind: 'submenu',
        id: 'more',
        label: 'Move to',
        items: [{ kind: 'item', id: 'today', label: 'Today', onSelect: vi.fn() }]
      },
      { kind: 'checkbox', id: 'pin', label: 'Pinned', checked: true, onSelect: vi.fn() },
      { kind: 'separator', id: 's' },
      { kind: 'item', id: 'delete', label: 'Delete', tone: 'danger', onSelect: onDelete }
    ] as ContextMenuItem[]
  });

  it('opens at the pointer on right-click', () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <div>Task row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Task row'), { clientX: 40, clientY: 60 });
    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
    expect(menu.getAttribute('aria-label')).toBe('Task actions');
    expect(menu.style.position).toBe('fixed');
  });

  it('does not open on right-click when disabled', () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items} disabled>
        <div>Task row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Task row'), { clientX: 10, clientY: 10 });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens from the keyboard with Shift+F10 and anchors to the element', () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <button type="button">Task row</button>
      </ContextMenu>
    );
    const row = screen.getByRole('button', { name: 'Task row' });
    row.focus();
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('exposes checkbox and radio semantics through aria-checked', () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <div>Task row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Task row'), { clientX: 20, clientY: 20 });
    const pin = screen.getByRole('menuitemcheckbox', { name: /Pinned/ });
    expect(pin.getAttribute('aria-checked')).toBe('true');
  });

  it('opens a submenu with ArrowRight and collapses it with ArrowLeft', () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <div>Task row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Task row'), { clientX: 20, clientY: 20 });
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Move to
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(screen.queryByRole('menuitem', { name: 'Today' })).toBeTruthy();
  });

  it('runs the action and closes, returning focus to the record', () => {
    const onDelete = vi.fn();
    const { items } = buildItems(onDelete);
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <button type="button">Task row</button>
      </ContextMenu>
    );
    const row = screen.getByRole('button', { name: 'Task row' });
    row.focus();
    fireEvent.contextMenu(row, { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(row);
  });

  it('closes on Escape', async () => {
    const { items } = buildItems();
    render(
      <ContextMenu ariaLabel="Task actions" items={items}>
        <div>Task row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Task row'), { clientX: 20, clientY: 20 });
    fireEvent.keyDown(document, { key: 'Escape' });
    // While the panel animates out it must already be out of the a11y tree.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const dying = document.querySelector('[role="menu"]');
    expect(dying?.getAttribute('aria-hidden')).toBe('true');
    expect(dying?.hasAttribute('inert')).toBe(true);
    await advance();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

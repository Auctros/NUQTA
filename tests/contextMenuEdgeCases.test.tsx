import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu, type ContextMenuItem } from '../src/components/motion/ContextMenu';
import { Modal } from '../src/components/ui/overlays';
import { resetOverlayStack } from '../src/lib/overlayStack';
import { resetScrollLock } from '../src/lib/scrollLock';

beforeEach(() => {
  resetOverlayStack();
  resetScrollLock();
});

afterEach(() => {
  resetOverlayStack();
  resetScrollLock();
});

/* ============================================================
   Context menu entry points and dismissal paths.

   The menu is the one surface a user reaches from three different
   input modalities, so each entry point and each way out is
   asserted separately — a gap in one does not show up in another.
   ============================================================ */

const items = (onSelect = vi.fn()): ContextMenuItem[] => [
  { kind: 'item', id: 'open', label: 'Open', onSelect },
  {
    kind: 'submenu',
    id: 'move',
    label: 'Move to',
    items: [{ kind: 'item', id: 'today', label: 'Today', onSelect: vi.fn() }]
  }
];

describe('ContextMenu entry points', () => {
  it('opens with the dedicated ContextMenu key', () => {
    render(
      <ContextMenu ariaLabel="Row actions" items={items()}>
        <button type="button">Row</button>
      </ContextMenu>
    );
    fireEvent.keyDown(screen.getByText('Row'), { key: 'ContextMenu' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('opens with Shift+F10', () => {
    render(
      <ContextMenu ariaLabel="Row actions" items={items()}>
        <button type="button">Row</button>
      </ContextMenu>
    );
    fireEvent.keyDown(screen.getByText('Row'), { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('does not hijack the native menu on a disabled target', () => {
    render(
      <ContextMenu ariaLabel="Row actions" items={items()} disabled>
        <button type="button">Row</button>
      </ContextMenu>
    );
    const event = fireEvent.contextMenu(screen.getByText('Row'), { clientX: 5, clientY: 5 });
    // fireEvent returns false when preventDefault was called; the native menu
    // must be allowed to appear when this wrapper is inactive.
    expect(event).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('leaves text selection available inside an input', () => {
    render(
      <ContextMenu ariaLabel="Field actions" items={items()}>
        <input aria-label="Note" defaultValue="selectable text" />
      </ContextMenu>
    );
    const input = screen.getByLabelText('Note') as HTMLInputElement;
    input.setSelectionRange(0, 5);
    // The wrapper itself must not impose a selection-blocking style.
    expect(getComputedStyle(input).userSelect === 'none').toBe(false);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });
});

describe('ContextMenu dismissal', () => {
  it('Escape inside a submenu collapses the submenu, not the whole menu', () => {
    render(
      <ContextMenu ariaLabel="Row actions" items={items()}>
        <div>Row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Row'), { clientX: 20, clientY: 20 });

    const root = screen.getByRole('menu');
    fireEvent.keyDown(root, { key: 'ArrowDown' }); // Open
    fireEvent.keyDown(root, { key: 'ArrowDown' }); // Move to
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(screen.getByRole('menuitem', { name: 'Today' })).toBeTruthy();

    // Escape inside the submenu steps back one level only.
    const submenu = screen.getAllByRole('menu').at(-1)!;
    fireEvent.keyDown(submenu, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Today' })).toBeNull();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('Escape on the root menu closes it', () => {
    render(
      <ContextMenu ariaLabel="Row actions" items={items()}>
        <div>Row</div>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText('Row'), { clientX: 20, clientY: 20 });
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('reopening on a different element anchors to the new target', () => {
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    render(
      <div>
        <ContextMenu ariaLabel="First" items={items(onFirst)}>
          <div>First row</div>
        </ContextMenu>
        <ContextMenu ariaLabel="Second" items={items(onSecond)}>
          <div>Second row</div>
        </ContextMenu>
      </div>
    );

    fireEvent.contextMenu(screen.getByText('First row'), { clientX: 30, clientY: 40 });
    expect(screen.getByRole('menu').getAttribute('aria-label')).toBe('First');
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.contextMenu(screen.getByText('Second row'), { clientX: 120, clientY: 260 });
    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('aria-label')).toBe('Second');
    expect(menu.style.left).not.toBe('');
    expect(screen.queryByRole('menu', { name: 'First' })).toBeNull();
  });
});

describe('ContextMenu nested in a dialog', () => {
  it('Escape closes the menu only, leaving the dialog open', () => {
    const closeModal = vi.fn();
    render(
      <Modal open onClose={closeModal} title="Settings">
        <ContextMenu ariaLabel="Row actions" items={items()}>
          <div>Inner row</div>
        </ContextMenu>
      </Modal>
    );

    fireEvent.contextMenu(screen.getByText('Inner row'), { clientX: 20, clientY: 20 });
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    // Every surface listens on `document`, so stopPropagation alone would let
    // this single keypress dismiss the menu and the dialog behind it.
    expect(screen.queryByRole('menu')).toBeNull();
    expect(closeModal).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Escape closes the dialog once the menu is already gone', () => {
    const closeModal = vi.fn();
    render(
      <Modal open onClose={closeModal} title="Settings">
        <ContextMenu ariaLabel="Row actions" items={items()}>
          <div>Inner row</div>
        </ContextMenu>
      </Modal>
    );

    fireEvent.contextMenu(screen.getByText('Inner row'), { clientX: 20, clientY: 20 });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});

describe('submenu stepping out', () => {
  it('closes only the submenu, leaving the root menu open', () => {
    resetOverlayStack();
    const items: ContextMenuItem[] = [
      { kind: 'submenu', id: 'more', label: 'More', items: [{ kind: 'item', id: 'child', label: 'Child', onSelect: () => {} }] },
      { kind: 'item', id: 'act', label: 'Act', onSelect: () => {} }
    ];
    render(
      <ContextMenu ariaLabel="Row actions" items={items}>
        <div>Row</div>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByText('Row'), { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByText('More'));

    const menus = () => document.querySelectorAll('[role="menu"]');
    expect(menus()).toHaveLength(2);

    // Escape is delivered to the submenu, which is where focus sits.
    fireEvent.keyDown(menus()[1], { key: 'Escape' });

    expect(menus()).toHaveLength(1);
  });
});

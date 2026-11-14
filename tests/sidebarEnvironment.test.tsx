import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import App from '../src/App';

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

describe('Ambient environment & sidebar motion interactions', () => {
  it('renders the 7 overlapping ambient color pools hidden from assistive tech', async () => {
    const { container } = render(<App />);
    await settle();

    const canvas = container.querySelector('.ambient-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.ambient-pool')).toHaveLength(7);
  });

  it('toggles collapsed sidebar, keeps active label visible, shows tooltips on other items, and supports arrow-key nav', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    const { container } = render(<App />);
    await settle();

    const shell = container.querySelector('.app-shell');
    const aside = screen.getByRole('complementary', { name: /Primary navigation/i });
    expect(shell?.classList.contains('sidebar-collapsed')).toBe(false);

    const collapseBtn = within(aside).getByRole('button', { name: /Collapse Sidebar/i });
    fireEvent.click(collapseBtn);
    expect(shell?.classList.contains('sidebar-collapsed')).toBe(true);

    // Active nav item (Overview) still includes its compact collapsed label
    const overviewBtn = within(aside).getByRole('button', { name: 'Overview' });
    expect(overviewBtn.getAttribute('aria-current')).toBe('page');
    expect(overviewBtn.querySelector('.nav-active-mini-label')?.textContent).toBe('Overview');

    // Hovering a non-active item in collapsed mode opens a floating glass tooltip
    const tasksBtn = within(aside).getByRole('button', { name: 'Tasks' });
    fireEvent.mouseEnter(tasksBtn);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Tasks');

    fireEvent.mouseLeave(tasksBtn);
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Keyboard ArrowDown moves focus from Overview to Tasks
    overviewBtn.focus();
    fireEvent.keyDown(overviewBtn, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tasksBtn);

    // Clicking topbar menu toggle expands sidebar again
    const topbarToggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    fireEvent.click(topbarToggle);
    expect(shell?.classList.contains('sidebar-collapsed')).toBe(false);
  });
});

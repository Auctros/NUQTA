import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { SyncStatusBadge } from '../src/components/SyncStatusBadge';
import type { SyncStatus } from '../src/lib/sync/useSyncStatus';

const status = (patch: Partial<SyncStatus> = {}): SyncStatus => ({
  enabled: true,
  paused: false,
  state: 'idle',
  pendingChanges: 0,
  ...patch
});

afterEach(cleanup);

/** The full sentence is what assistive tech and the tooltip read. */
const detail = () => screen.getByRole('status').textContent ?? '';

describe('SyncStatusBadge', () => {
  it('renders nothing when sync is not configured', () => {
    const { container } = render(<SyncStatusBadge status={status({ enabled: false })} isAr={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('reports connecting rather than claiming sync is idle', () => {
    // Regression: `connecting` had no branch and fell through to "Sync idle", which
    // tells the user sync is off while a socket is actually being opened.
    render(<SyncStatusBadge status={status({ state: 'connecting' })} isAr={false} />);
    expect(detail()).toContain('Connecting…');
    expect(detail()).not.toContain('Sync idle');
  });

  it('shows a fatal identity rejection instead of a silent retry loop', () => {
    render(<SyncStatusBadge status={status({ state: 'error' })} isAr={false} />);
    expect(detail()).toContain('identity rejected');
  });

  it('shows the paused latch with a resume action after a wipe', () => {
    render(<SyncStatusBadge status={status({ paused: true })} isAr={false} />);
    expect(detail()).toContain('paused after a data wipe');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  it('reports the pending count once connected', () => {
    render(<SyncStatusBadge status={status({ state: 'connected', pendingChanges: 3 })} isAr={false} />);
    expect(detail()).toContain('Connected — 3 pending');
  });

  it('says "Synced" only when connected with nothing pending', () => {
    render(<SyncStatusBadge status={status({ state: 'connected' })} isAr={false} />);
    expect(detail()).toContain('Synced');
  });

  it('warns that changes are only local while offline', () => {
    render(<SyncStatusBadge status={status({ state: 'offline', pendingChanges: 2 })} isAr={false} />);
    expect(detail()).toContain('Offline — changes are saved locally');
  });

  it('keeps the header label short and puts the full sentence in the tooltip', () => {
    const { container } = render(
      <SyncStatusBadge status={status({ state: 'connected', pendingChanges: 4 })} isAr={false} />
    );
    // The visible label is abbreviated so it cannot widen the header row.
    expect(screen.getByText('4 pending')).toBeTruthy();
    // The tooltip is aria-hidden (the visually hidden text is the accessible name), so
    // it is queried directly rather than by role.
    expect(container.querySelector('.sync-pill-tip')?.textContent).toContain(
      'Connected — 4 pending'
    );
  });

  it('exposes the state exactly once to assistive technology', () => {
    const { container } = render(
      <SyncStatusBadge status={status({ state: 'connected' })} isAr={false} />
    );
    // Regression: the visible label, the hidden text and the tooltip all contained the
    // sentence, so a screen reader announced "Synced" three times.
    const visible = container.querySelector('.sync-pill-label');
    const hidden = container.querySelector('.sync-pill-sr');
    const tip = container.querySelector('.sync-pill-tip');
    expect(visible?.getAttribute('aria-hidden')).toBe('true');
    expect(tip?.getAttribute('aria-hidden')).toBe('true');
    expect(hidden?.getAttribute('aria-hidden')).toBeNull();
    expect(hidden?.textContent).toBe('Synced');
  });

  it('localises the paused state', () => {
    render(<SyncStatusBadge status={status({ paused: true })} isAr />);
    expect(detail()).toContain('المزامنة متوقفة بعد حذف البيانات');
    expect(screen.getByRole('button', { name: 'استئناف' })).toBeTruthy();
  });
});

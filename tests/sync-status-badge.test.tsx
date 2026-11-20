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

describe('SyncStatusBadge', () => {
  it('renders nothing when sync is not configured', () => {
    const { container } = render(<SyncStatusBadge status={status({ enabled: false })} isAr={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('reports connecting rather than claiming sync is idle', () => {
    // Regression: `connecting` had no branch and fell through to "Sync idle", which
    // tells the user sync is off while a socket is actually being opened.
    render(<SyncStatusBadge status={status({ state: 'connecting' })} isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('Connecting…');
    expect(screen.getByRole('status').textContent).not.toContain('Sync idle');
  });

  it('shows a fatal identity rejection instead of a silent retry loop', () => {
    render(<SyncStatusBadge status={status({ state: 'error' })} isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('identity rejected');
  });

  it('shows the paused latch with a resume action after a wipe', () => {
    render(<SyncStatusBadge status={status({ paused: true })} isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('paused after a data wipe');
    expect(screen.getByRole('button', { name: 'Resume sync' })).toBeTruthy();
  });

  it('reports the pending count once connected', () => {
    render(<SyncStatusBadge status={status({ state: 'connected', pendingChanges: 3 })} isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('Connected — 3 pending');
  });

  it('says "Synced" only when connected with nothing pending', () => {
    render(<SyncStatusBadge status={status({ state: 'connected' })} isAr={false} />);
    expect(screen.getByRole('status').textContent).toContain('Synced');
  });

  it('localises the paused state', () => {
    render(<SyncStatusBadge status={status({ paused: true })} isAr />);
    expect(screen.getByRole('status').textContent).toContain('المزامنة متوقفة بعد حذف البيانات');
    expect(screen.getByRole('button', { name: 'استئناف المزامنة' })).toBeTruthy();
  });
});

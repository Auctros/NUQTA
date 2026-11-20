import { describe, it, expect } from 'vitest';
import { PREVIEW_STATES, readSyncPreview } from '../src/lib/sync/previewStatus';

const ON = { VITE_NUQTA_SYNC_PREVIEW: '1' };

describe('readSyncPreview', () => {
  it('stays out of the way unless the build opts in', () => {
    expect(readSyncPreview('?syncPreview=ok', {})).toBeNull();
    expect(readSyncPreview('?syncPreview=ok', { VITE_NUQTA_SYNC_PREVIEW: '' })).toBeNull();
    expect(readSyncPreview('?syncPreview=ok', { VITE_NUQTA_SYNC_PREVIEW: '0' })).toBeNull();
  });

  it('defaults to the synced state so a bare demo URL still shows the pill', () => {
    const status = readSyncPreview('', ON);
    expect(status).toEqual({
      enabled: true,
      paused: false,
      state: 'connected',
      pendingChanges: 0,
      preview: true
    });
  });

  it.each([
    ['busy', 'synchronizing', false],
    ['warn', 'offline', false],
    ['danger', 'error', false],
    ['muted', 'connecting', false],
    ['paused', 'idle', true]
  ])('maps %s to the %s connection state', (state, expected, paused) => {
    const status = readSyncPreview(`?syncPreview=${state}`, ON);
    expect(status?.state).toBe(expected);
    expect(status?.paused).toBe(paused);
    expect(status?.enabled).toBe(true);
  });

  it('falls back to the default for an unknown state rather than rendering nothing', () => {
    expect(readSyncPreview('?syncPreview=nonsense', ON)?.state).toBe('connected');
  });

  it('is case and whitespace tolerant, since the value comes from a URL', () => {
    expect(readSyncPreview('?syncPreview=%20WARN%20', ON)?.state).toBe('offline');
  });

  it('turns a queued count into the pending tone, matching how the badge renders it', () => {
    const status = readSyncPreview('?pending=3', ON);
    expect(status).toEqual({
      enabled: true,
      paused: false,
      state: 'connected',
      pendingChanges: 3,
      preview: true
    });
  });

  it('ignores a non-positive or unparseable count', () => {
    expect(readSyncPreview('?pending=0', ON)?.pendingChanges).toBe(0);
    expect(readSyncPreview('?pending=-2', ON)?.pendingChanges).toBe(0);
    expect(readSyncPreview('?pending=abc', ON)?.pendingChanges).toBe(0);
  });

  it('never claims pending work in a state that cannot have any', () => {
    expect(readSyncPreview('?syncPreview=warn&pending=5', ON)?.pendingChanges).toBe(0);
    expect(readSyncPreview('?syncPreview=danger&pending=5', ON)?.pendingChanges).toBe(0);
  });

  it('marks every status as a preview so real controls stay inert', () => {
    for (const state of PREVIEW_STATES) {
      expect(readSyncPreview(`?syncPreview=${state}`, ON)?.preview).toBe(true);
    }
    expect(readSyncPreview('?pending=2', ON)?.preview).toBe(true);
  });

  it('covers every state the badge can present', () => {
    for (const state of PREVIEW_STATES) {
      expect(readSyncPreview(`?syncPreview=${state}`, ON)).not.toBeNull();
    }
  });
});

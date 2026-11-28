import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogHost } from '../src/components/ui/DialogHost';
import { dialogs } from '../src/components/ui/dialogController';
import { Modal } from '../src/components/ui/overlays';
import { resetOverlayStack } from '../src/lib/overlayStack';
import { resetScrollLock } from '../src/lib/scrollLock';
import { useEscapeKey } from '../src/lib/useEscapeKey';

/* ============================================================
   Legacy surfaces own Escape without owning the stack.

   The views that still hand-roll a `.modal-backdrop` close on Escape
   through `useEscapeKey`. Since every listener sits on `document`,
   those views competed with DialogHost and with each other: one
   press closed the legacy form *and* the confirm above it.
   ============================================================ */

beforeEach(() => {
  resetOverlayStack();
  resetScrollLock();
});

afterEach(() => {
  resetOverlayStack();
  resetScrollLock();
});

function Legacy({ name, log }: { name: string; log: string[] }) {
  const [open, setOpen] = useState(true);
  useEscapeKey(open, () => {
    log.push(name);
    setOpen(false);
  });
  return open ? (
    <div className="modal-backdrop">
      <div role="dialog" aria-modal="true" aria-label={name}>{name}</div>
    </div>
  ) : null;
}

const press = async () => {
  fireEvent.keyDown(document, { key: 'Escape' });
  await act(async () => { await Promise.resolve(); });
};

describe('useEscapeKey on the shared stack', () => {
  it('leaves a confirm dialog above it in charge of Escape', async () => {
    const log: string[] = [];
    render(<><Legacy name="Form" log={log} /><DialogHost /></>);

    let answered: boolean | undefined;
    act(() => { void dialogs.confirm({ title: 'Sure?' }).then((v) => { answered = v; }); });
    await screen.findByRole('dialog', { name: /Sure\?/ });

    await press();
    expect(answered).toBe(false);
    expect(log).toEqual([]);

    await press();
    expect(log).toEqual(['Form']);
  });

  it('leaves a Modal above it in charge of Escape', async () => {
    const log: string[] = [];
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Legacy name="Form" log={log} />
          <Modal open={open} onClose={() => setOpen(false)} title="Sheet">
            inner
          </Modal>
        </>
      );
    }
    render(<Host />);

    await press();
    expect(screen.queryByRole('dialog', { name: 'Sheet' })).toBeNull();
    expect(log).toEqual([]);

    await press();
    expect(log).toEqual(['Form']);
  });

  it('closes legacy surfaces one per press, newest first', async () => {
    const log: string[] = [];
    render(<><Legacy name="First" log={log} /><Legacy name="Second" log={log} /></>);

    await press();
    expect(log).toEqual(['Second']);

    await press();
    expect(log).toEqual(['Second', 'First']);
  });
});

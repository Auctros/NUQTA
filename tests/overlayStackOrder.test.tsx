import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal, Sheet } from '../src/components/ui/overlays';
import { DialogHost } from '../src/components/ui/DialogHost';
import { dialogs } from '../src/components/ui/dialogController';
import { ContextMenu } from '../src/components/motion/ContextMenu';
import { resetOverlayStack } from '../src/lib/overlayStack';
import { resetScrollLock } from '../src/lib/scrollLock';
import { useNuqtaStore } from '../src/store/nuqtaStore';

/* ============================================================
   Escape must unwind a pile of surfaces one press at a time.

   Every surface listens on `document`, so a per-component
   `stopPropagation` isolates nothing. The shared stack decides by
   what the user sees: z-index first, then containment, then the
   order of opening.
   ============================================================ */

beforeEach(() => {
  resetOverlayStack();
  resetScrollLock();
  useNuqtaStore.setState((state) => ({ profile: { ...state.profile, language: 'en' } }));
});

afterEach(() => {
  resetOverlayStack();
  resetScrollLock();
});

describe('stacked surface unwinding', () => {
  it('closes confirm, then menu, then sheet, then modal — one per Escape', async () => {
    const order: string[] = [];

    function Nested() {
      const [modal, setModal] = useState(true);
      const [sheet, setSheet] = useState(true);
      return (
        <>
          <Modal open={modal} onClose={() => { order.push('modal'); setModal(false); }} title="Outer">
            <Sheet open={sheet} onClose={() => { order.push('sheet'); setSheet(false); }} title="Inner">
              <ContextMenu ariaLabel="Row actions" items={[{ kind: 'item', id: 'a', label: 'Act', onSelect: () => {} }]}>
                <div>Row</div>
              </ContextMenu>
            </Sheet>
          </Modal>
          <DialogHost />
        </>
      );
    }

    render(<Nested />);
    fireEvent.contextMenu(screen.getByText('Row'), { clientX: 8, clientY: 8 });
    expect(screen.getByRole('menu')).toBeTruthy();

    let answered: boolean | undefined;
    act(() => { void dialogs.confirm({ title: 'Sure?' }).then((v) => { answered = v; }); });
    await screen.findByRole('dialog', { name: /Sure\?/ });

    const press = async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await act(async () => { await Promise.resolve(); });
    };

    await press();
    expect(answered).toBe(false);
    expect(screen.queryByRole('menu')).toBeTruthy();

    await press();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(order).toEqual([]);

    await press();
    expect(order).toEqual(['sheet']);

    await press();
    expect(order).toEqual(['sheet', 'modal']);
    // The outer modal is still fading out, so the page lock legitimately stays
    // until its exit finishes and the last owner releases.
    expect(document.body.style.overflow).toBe('hidden');
  });
});

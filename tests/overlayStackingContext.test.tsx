import { afterEach, describe, expect, it } from 'vitest';
import { isTopmostOverlay, popOverlay, pushOverlay, resetOverlayStack } from '../src/lib/overlayStack';

/* ============================================================
   Escape follows the paint order, not the z-index number.

   `z-index` only ranks an element inside its own stacking context.
   The app ports the context menu to `body` (z-index 40) while a
   Modal renders inside `.app-shell`, which is `isolation: isolate`
   and therefore traps the Modal's z-index inside a context sitting
   at level 0. Verified in a real browser: at the overlap point the
   menu receives the hit test even though the dialog's z-index is
   higher. Ranking by the raw number would give Escape to the wrong
   surface.
   ============================================================ */

afterEach(() => resetOverlayStack());

const attach = (parent: HTMLElement, css: string) => {
  const el = document.createElement('div');
  el.setAttribute('style', css);
  parent.appendChild(el);
  return el;
};

describe('escape order follows paint order', () => {
  it('portal at the root outranks a higher z-index trapped in an isolated ancestor', () => {
    const shell = attach(document.body, 'position:relative;isolation:isolate');
    const dialogWrap = attach(shell, 'position:fixed;z-index:120');
    const dialogPanel = attach(dialogWrap, 'position:static');
    const menuWrap = attach(document.body, 'position:fixed;z-index:40');

    const dialogToken = pushOverlay(() => dialogPanel);
    const menuToken = pushOverlay(() => menuWrap);

    expect(isTopmostOverlay(menuToken)).toBe(true);
    expect(isTopmostOverlay(dialogToken)).toBe(false);
  });

  it('a nested surface still outranks its host', () => {
    const modal = attach(document.body, 'position:fixed;z-index:60');
    const sheet = attach(modal, 'position:fixed;z-index:60');

    // React registers the child effect first, so order must not decide this.
    const sheetToken = pushOverlay(() => sheet);
    const modalToken = pushOverlay(() => modal);

    expect(isTopmostOverlay(sheetToken)).toBe(true);
    expect(isTopmostOverlay(modalToken)).toBe(false);
  });

  it('ignores a z-index on a static wrapper', () => {
    const staticStale = attach(document.body, 'position:static;z-index:999');
    const real = attach(document.body, 'position:fixed;z-index:10');

    const staleToken = pushOverlay(() => staticStale);
    const realToken = pushOverlay(() => real);

    expect(isTopmostOverlay(realToken)).toBe(true);
    expect(isTopmostOverlay(staleToken)).toBe(false);
  });

  it('ranks equal surfaces by opening order', () => {
    const first = attach(document.body, 'position:fixed;z-index:60');
    const second = attach(document.body, 'position:fixed;z-index:60');

    const firstToken = pushOverlay(() => first);
    const secondToken = pushOverlay(() => second);

    expect(isTopmostOverlay(secondToken)).toBe(true);
    expect(isTopmostOverlay(firstToken)).toBe(false);
  });

  it('does not throw once a surface is removed from the DOM', () => {
    const gone = attach(document.body, 'position:fixed;z-index:90');
    const stay = attach(document.body, 'position:fixed;z-index:10');
    const goneToken = pushOverlay(() => gone);
    const stayToken = pushOverlay(() => stay);
    gone.remove();

    expect(() => isTopmostOverlay(goneToken)).not.toThrow();
    expect(isTopmostOverlay(stayToken)).toBe(true);
    popOverlay(goneToken);
  });
});

/* ============================================================
   NUQTA — page scroll lock
   ------------------------------------------------------------
   Reference-counted, because overlays overlap. Handing over from
   one dialog to the next closes one and opens another in the same
   commit: a plain save/restore per overlay lets the outgoing
   panel's cleanup unlock the page underneath the incoming one.

   Ownership is tracked per caller rather than as a shared counter.
   A release that runs twice (a double-invoked effect, a surface
   unmounted by an error boundary in the same commit as its own
   cleanup) then removes only its own claim instead of consuming
   another surface's, which would leave the page locked forever.
   ============================================================ */

const owners = new Set<object>();
let saved = '';

/** Take the lock and hand back the token that releases it. */
export function lockPageScroll(): object {
  const token = {};
  if (typeof document === 'undefined') return token;

  // The first owner records what the page looked like before any overlay
  // touched it. Later owners must not overwrite this with `hidden`.
  if (owners.size === 0) saved = document.body.style.overflow;

  owners.add(token);
  document.body.style.overflow = 'hidden';
  return token;
}

/** Release one claim. A token that was already released is ignored. */
export function unlockPageScroll(token: object): void {
  if (!owners.delete(token)) return;
  if (owners.size === 0) document.body.style.overflow = saved;
}

/**
 * Test seam: drop every owner and put the page back.
 *
 * It has to restore the DOM, not just the bookkeeping. Leaving `overflow:
 * hidden` behind means the next `lockPageScroll()` records `hidden` as the
 * pre-overlay value, and every later release "restores" it — one leaked lock
 * poisons the rest of the file.
 */
export function resetScrollLock(): void {
  if (owners.size > 0 && typeof document !== 'undefined') {
    document.body.style.overflow = saved;
  }
  owners.clear();
  saved = '';
}

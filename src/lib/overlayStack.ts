/* ============================================================
   NUQTA — overlay stack
   ------------------------------------------------------------
   Every dismissible surface (Modal, Sheet, DialogHost, context
   menu) registers while it is visible. Escape is answered by the
   topmost one only, so a stack of dialogs unwinds one press at a
   time instead of all collapsing together.

   "Topmost" cannot come from registration order: React runs child
   effects before their parent's, so a Sheet inside a Modal
   registers first although it paints above it. It cannot come from
   document order either, because surfaces portal to body.

   So the order is the one the user sees. A z-index alone is not enough:
   it only ranks an element inside its own stacking context. The menu
   portals to `body` at z-index 40 while a Modal renders inside
   `.app-shell`, which is `isolation: isolate` and therefore traps the
   Modal's z-index 60 inside a context that sits at level 0. The menu is
   drawn on top, so comparing 40 against 60 would pick the wrong surface.
   The comparison is therefore the whole path of stacking levels from
   the root down to the element. See `isTopmostOverlay`.
   ============================================================ */

interface Entry {
  token: object;
  element: () => HTMLElement | null;
}

const stack: Entry[] = [];

/**
 * The stacking levels from the root down to `node`, one entry per ancestor that
 * establishes a stacking context. Comparing these lexicographically reproduces
 * the paint order, which a single z-index cannot: a high z-index inside an
 * isolated ancestor still paints below a low z-index at the root.
 *
 * `z-index` is ignored unless the element is positioned, so `static` elements
 * only contribute through `isolation`, which creates a context on its own.
 */
function stackingPath(node: HTMLElement): number[] {
  const levels: number[] = [];
  let el: HTMLElement | null = node;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = getComputedStyle(el);
    const z = Number.parseInt(style.zIndex, 10);
    const hasLayer = style.position !== 'static' && !Number.isNaN(z);
    const isolated = style.isolation === 'isolate';
    const fixedLike = style.position === 'fixed' || style.position === 'sticky';
    if (hasLayer || isolated || fixedLike) levels.push(Number.isNaN(z) ? 0 : z);
    el = el.parentElement;
  }
  return levels.reverse();
}

/**
 * Positive when `a` paints above `b`. A path that extends another one is a
 * context nested inside it, and its content is drawn above that context's own
 * background, so the longer path wins on a prefix.
 */
function comparePaths(a: number[], b: number[]): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Register a surface; `element` is read lazily so it may be filled after mount. */
export function pushOverlay(element: () => HTMLElement | null): object {
  const token = {};
  stack.push({ token, element });
  return token;
}

export function popOverlay(token: object): void {
  const at = stack.findIndex((entry) => entry.token === token);
  if (at !== -1) stack.splice(at, 1);
}

export function isTopmostOverlay(token: object, element?: HTMLElement | null): boolean {
  const mine = element ?? stack.find((entry) => entry.token === token)?.element() ?? null;

  // Surfaces that render outside the shared components (the legacy views using
  // `useEscapeKey`) have no element to rank by, so there is no geometry to
  // compare. They defer to anything measurable — that surface is drawn in the
  // shared layer — and among themselves the most recently opened wins, which is
  // the same fallback used for unrelated surfaces on one layer.
  if (!mine || !mine.isConnected) {
    const myOrder = stack.findIndex((entry) => entry.token === token);
    return !stack.some((entry, i) => {
      if (entry.token === token) return false;
      const other = entry.element();
      if (other && other.isConnected) return true;
      return i > myOrder;
    });
  }

  const myPath = stackingPath(mine);
  const myIndex = stack.findIndex((entry) => entry.token === token);

  for (let i = 0; i < stack.length; i += 1) {
    if (i === myIndex) continue;
    const other = stack[i].element();
    if (!other || !other.isConnected || other === mine) continue;

    // Whatever is painted higher owns Escape, wherever in the tree it lives.
    const order = comparePaths(stackingPath(other), myPath);
    if (order > 0) return false;
    if (order < 0) continue;
    // Same paint level: a surface rendered inside another one paints above it
    // (a Sheet inside a Modal), and React registers the child first, so the
    // containment check has to come before the opening order. Being the inner
    // surface means being on top, hence `continue`, not `return false`.
    if (other.contains(mine)) continue;
    if (mine.contains(other)) return false;
    // Unrelated surfaces on the same level: the later-opened one is on top.
    if (i > myIndex) return false;
  }
  return true;
}

/** Test seam: forget all registered surfaces. */
export function resetOverlayStack(): void {
  stack.length = 0;
}

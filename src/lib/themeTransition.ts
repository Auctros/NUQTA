import { flushSync } from 'react-dom';
import type { UserProfile } from '../types';

type ViewTransitionLike = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionLike;
};

let activeTransition: ViewTransitionLike | null = null;

export function applyThemeClass(theme: UserProfile['theme']): void {
  if (typeof document === 'undefined') return;
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light-mode', isLight);
  document.body?.classList.toggle('light-mode', isLight);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isLight ? '#f4f6f4' : '#0b0f13');
}

export function isThemeTransitionActive(): boolean {
  return activeTransition !== null;
}

export function resetThemeTransitionStateForTest(): void {
  activeTransition = null;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove(
      'theme-liquid-transition',
      'theme-liquid-simple',
      'theme-liquid-snap'
    );
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isConstrainedDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 4;
  return cores > 0 && cores <= 2;
}

/**
 * Performs a bottom-left -> top-right liquid-spill theme reveal using
 * the browser's compositor-level View Transitions API when available.
 * Falls back to an instant switch under reduced-motion preferences or
 * unsupported environments. Ignores overlapping clicks mid-pour so the
 * advancing front completes cleanly without visual tears.
 */
export function runLiquidThemeTransition(
  currentTheme: UserProfile['theme'],
  targetTheme: UserProfile['theme'],
  commitStore: () => void
): void {
  if (currentTheme === targetTheme) {
    commitStore();
    applyThemeClass(targetTheme);
    return;
  }

  // Prevent repeated toggles from interrupting an active liquid pour unpredictably
  if (activeTransition) {
    return;
  }

  const doc = typeof document !== 'undefined' ? (document as DocumentWithViewTransition) : null;
  const canUseViewTransition =
    doc !== null &&
    typeof doc.startViewTransition === 'function' &&
    !prefersReducedMotion();

  if (!canUseViewTransition) {
    applyThemeClass(targetTheme);
    commitStore();
    return;
  }

  const root = doc.documentElement;
  const simpleMode = isConstrainedDevice();

  root.classList.add('theme-liquid-transition');
  if (simpleMode) {
    root.classList.add('theme-liquid-simple');
  }

  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition!(() => {
      // Disable intermediate CSS property transitions for this exact snapshot frame
      // so the new-theme view-transition layer captures final target theme colors.
      root.classList.add('theme-liquid-snap');
      try {
        flushSync(() => {
          applyThemeClass(targetTheme);
          commitStore();
        });
      } catch {
        applyThemeClass(targetTheme);
        commitStore();
      }
    });
  } catch {
    root.classList.remove('theme-liquid-transition', 'theme-liquid-simple', 'theme-liquid-snap');
    applyThemeClass(targetTheme);
    commitStore();
    return;
  }

  activeTransition = transition;

  Promise.resolve(transition.ready)
    .catch(() => {})
    .finally(() => {
      root.classList.remove('theme-liquid-snap');
    });

  Promise.resolve(transition.finished)
    .catch(() => {})
    .finally(() => {
      if (activeTransition === transition) {
        activeTransition = null;
      }
      root.classList.remove('theme-liquid-transition', 'theme-liquid-simple', 'theme-liquid-snap');
    });
}

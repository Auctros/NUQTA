import React from 'react';
import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { LiquidTabs } from '../src/components/ui/LiquidTabs';

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
  { id: 'd', label: 'Delta' }
];

const WIDTHS = [80, 100, 120, 90];
const GAP = 6;
const ROW_WIDTH = 500;
const ROW_HEIGHT = 40;

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} }) as DOMRect;

/**
 * jsdom reports every rect as zero. The prototype is patched instead of the
 * nodes, because measurement happens in a layout effect — before any post-render
 * stub assignment could take hold. Each tab gets a known offset and size, and the
 * row spans the full width, which is enough to exercise measuring, retargeting
 * and the covered-item logic for real.
 */
const realGetRect = Element.prototype.getBoundingClientRect;
const realOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
const realOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft')!;

/** Index of `el` among its row's tabs, or -1. */
function tabIndex(el: Element): number {
  if (el.getAttribute?.('role') !== 'tab') return -1;
  const row = el.parentElement;
  if (!row) return -1;
  return Array.from(row.querySelectorAll('[role="tab"]')).indexOf(el as HTMLElement);
}

function tabOffset(index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += (WIDTHS[i] ?? 80) + GAP;
  return offset;
}

/**
 * jsdom reports every box as zero, and `markCovered` reads `offsetWidth`/
 * `offsetLeft` during the layout effect — before a per-node stub could exist.
 * So the prototypes are patched for the duration of a test.
 */
function installLayout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList?.contains('liquid-tabs')) return rect(0, 0, ROW_WIDTH, ROW_HEIGHT);
    const index = tabIndex(this);
    if (index >= 0) return rect(tabOffset(index), 0, WIDTHS[index] ?? 80, ROW_HEIGHT);
    return rect(0, 0, 0, 0);
  };

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const index = tabIndex(this);
      return index >= 0 ? WIDTHS[index] ?? 80 : realOffsetWidth.get!.call(this);
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get(this: HTMLElement) {
      const index = tabIndex(this);
      return index >= 0 ? tabOffset(index) : realOffsetLeft.get!.call(this);
    }
  });
}

function restoreLayout() {
  Element.prototype.getBoundingClientRect = realGetRect;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetWidth);
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', realOffsetLeft);
}

function TabList({
  value,
  onChange,
  mode
}: {
  value: string;
  onChange: (id: string) => void;
  mode?: 'fill' | 'underline';
}) {
  return (
    <LiquidTabs role="tablist" aria-label="Sections" mode={mode} remeasureKey={value}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </LiquidTabs>
  );
}

function renderTabs(initial = 'a', mode?: 'fill' | 'underline') {
  installLayout();
  let current = initial;
  const changes: string[] = [];

  const rerenderWith = (next: string) => {
    current = next;
    changes.push(next);
    view.rerender(<TabList value={current} onChange={rerenderWith} mode={mode} />);
  };

  const view = render(<TabList value={current} onChange={rerenderWith} mode={mode} />);

  return { ...view, changes, rerenderWith };
}

const indicator = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.liquid-tabs-indicator')!;

const realMatchMedia = window.matchMedia;

beforeEach(() => {
  // Reduced motion makes the hook land exactly on target instead of animating,
  // so the assertions see a settled indicator rather than a spring in flight.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  restoreLayout();
  window.matchMedia = realMatchMedia;
});

describe('LiquidTabs — measuring', () => {
  it('sizes the indicator to the selected tab', () => {
    const { container } = renderTabs('b');
    const ind = indicator(container);
    expect(ind.style.width).toBe('100px');
    expect(ind.style.height).toBe('40px');
  });

  it('positions the indicator at the selected tab offset', () => {
    const { container } = renderTabs('c');
    // Alpha 80 + gap 6 + Bravo 100 + gap 6 = 192
    expect(indicator(container).style.transform).toContain('translate3d(192px');
  });

  it('marks the tab it covers, and only that one', () => {
    const { container } = renderTabs('b');
    const covered = Array.from(container.querySelectorAll('[data-liquid-covered]')).map((el) =>
      el.textContent?.trim()
    );
    expect(covered).toEqual(['Bravo']);
  });

  it('reports readiness through a data attribute', () => {
    const { container } = renderTabs('a');
    expect(container.querySelector('.liquid-tabs')!.getAttribute('data-liquid-ready')).toBe('true');
  });

  it('re-measures when the selection changes', () => {
    const { container, rerenderWith } = renderTabs('a');
    expect(indicator(container).style.width).toBe('80px');

    act(() => rerenderWith('c'));
    expect(indicator(container).style.width).toBe('120px');
    expect(indicator(container).style.transform).toContain('translate3d(192px');
  });

  it('keeps the covered marker in step with the selection', () => {
    const { container, rerenderWith } = renderTabs('a');
    act(() => rerenderWith('d'));
    const covered = Array.from(container.querySelectorAll('[data-liquid-covered]')).map((el) =>
      el.textContent?.trim()
    );
    expect(covered).toEqual(['Delta']);
  });

  it('renders an underline rail at the bottom edge in underline mode', () => {
    const { container } = renderTabs('a', 'underline');
    const ind = indicator(container);
    expect(ind.style.height).toBe('2px');
    // Top 0 + tab height 40 - rule 2 = 38
    expect(ind.style.transform).toContain('translate3d(0px, 38px');
  });

  it('hides the indicator from assistive tech', () => {
    const { container } = renderTabs('a');
    expect(indicator(container).getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LiquidTabs — keyboard', () => {
  const press = (container: HTMLElement, key: string) => {
    const row = container.querySelector('.liquid-tabs')!;
    fireEvent.keyDown(row, { key });
  };

  const focusSelected = (container: HTMLElement) => {
    const selected = container.querySelector<HTMLElement>('[aria-selected="true"]')!;
    selected.focus();
    return selected;
  };

  it('moves to the next tab with ArrowRight', () => {
    const { container, changes } = renderTabs('a');
    focusSelected(container);
    press(container, 'ArrowRight');
    expect(changes.at(-1)).toBe('b');
  });

  it('moves to the previous tab with ArrowLeft', () => {
    const { container, changes } = renderTabs('c');
    focusSelected(container);
    press(container, 'ArrowLeft');
    expect(changes.at(-1)).toBe('b');
  });

  it('wraps from the last tab to the first', () => {
    const { container, changes } = renderTabs('d');
    focusSelected(container);
    press(container, 'ArrowRight');
    expect(changes.at(-1)).toBe('a');
  });

  it('wraps from the first tab to the last', () => {
    const { container, changes } = renderTabs('a');
    focusSelected(container);
    press(container, 'ArrowLeft');
    expect(changes.at(-1)).toBe('d');
  });

  it('jumps to the ends with Home and End', () => {
    const { container, changes } = renderTabs('b');
    focusSelected(container);
    press(container, 'End');
    expect(changes.at(-1)).toBe('d');
    press(container, 'Home');
    expect(changes.at(-1)).toBe('a');
  });

  it('ignores unrelated keys', () => {
    const { container, changes } = renderTabs('a');
    focusSelected(container);
    press(container, 'Enter');
    press(container, 'x');
    expect(changes).toEqual([]);
  });
});

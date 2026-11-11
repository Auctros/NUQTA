import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO;
(globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver || RO;
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false
  })) as any;
}
window.scrollTo = (() => {}) as any;
(Element.prototype as any).scrollIntoView = () => {};

beforeEach(async () => {
  localStorage.clear();
  const dbs = (await (indexedDB as any).databases?.()) || [];
  await Promise.all(dbs.map((d: any) => new Promise((res) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res(null); })));
});
afterEach(() => cleanup());

/**
 * Horizontal placement inside a lane.
 *
 * Items are packed into rows greedily: an item goes into the first row whose last
 * item ends before it starts, otherwise it opens a new row (up to `maxRows`, after
 * which it stacks into the last row rather than growing the lane forever). This is
 * what keeps a dense habit lane readable without a virtualised canvas.
 */
import type { TimelineItem } from './types';

export interface PlacedItem {
  item: TimelineItem;
  /** Horizontal offset in px from the window origin. */
  left: number;
  /** Width in px; always at least `minWidth` so a zero-length point stays clickable. */
  width: number;
  row: number;
}

export interface LaneLayout {
  placed: PlacedItem[];
  rows: number;
}

export function layoutLane(
  items: TimelineItem[],
  origin: Date,
  pxPerDay: number,
  options: { minWidth?: number; maxRows?: number } = {}
): LaneLayout {
  const minWidth = options.minWidth ?? 18;
  const maxRows = options.maxRows ?? 3;
  const originMs = origin.getTime();

  const measured = items
    .map((item) => {
      const startMs = item.start.getTime();
      const endMs = item.end?.getTime() ?? startMs;
      const left = ((startMs - originMs) / 86_400_000) * pxPerDay;
      const rawWidth = ((endMs - startMs) / 86_400_000) * pxPerDay;
      return { item, left, width: Math.max(minWidth, rawWidth), startMs, endMs };
    })
    .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);

  const rowEnds: number[] = [];
  const placed: PlacedItem[] = [];

  for (const entry of measured) {
    let row = rowEnds.findIndex((end) => end <= entry.startMs);
    if (row === -1) {
      if (rowEnds.length < maxRows) {
        row = rowEnds.length;
        rowEnds.push(0);
      } else {
        row = maxRows - 1;
      }
    }
    rowEnds[row] = entry.endMs;
    placed.push({ item: entry.item, left: entry.left, width: entry.width, row });
  }

  return { placed, rows: Math.max(1, rowEnds.length) };
}

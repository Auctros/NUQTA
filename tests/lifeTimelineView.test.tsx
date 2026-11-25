/**
 * Life Timeline — rendering, filtering and the two handoffs.
 *
 * The timeline is a view over records other modules own, so what matters here is that
 * it reads them faithfully (day sections, quiet-by-default) and that a reader can get
 * from an event to its source, or from a day to the map, without a dead end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LifeTimeline } from '../src/components/LifeTimeline';
import type { UniversalHistoryItem } from '../src/types';

let seq = 0;

function item(overrides: Partial<UniversalHistoryItem> = {}): UniversalHistoryItem {
  seq += 1;
  const date = overrides.date ?? '2026-11-10';
  return {
    id: `h${seq}`,
    domain: 'tasks',
    eventType: 'completed',
    entityId: `e${seq}`,
    entityType: 'task',
    title: `Event ${seq}`,
    date,
    timestamp: `${date}T09:00:00.000Z`,
    ...overrides
  } as UniversalHistoryItem;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('LifeTimeline — reading the feed', () => {
  it('groups events into day sections', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[
          item({ domain: 'tasks', title: 'Ship the report', date: '2026-11-10' }),
          item({ domain: 'quran', eventType: 'session', title: 'Juz 3', date: '2026-11-09' })
        ]}
      />
    );
    expect(screen.getByText('Ship the report')).toBeTruthy();
    expect(screen.getByText('Juz 3')).toBeTruthy();
    // One section per local day.
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(2);
  });

  it('says the memory has not started rather than showing an empty list', () => {
    render(<LifeTimeline isAr={false} items={[]} />);
    expect(screen.getByText(/Your memory has not started yet/i)).toBeTruthy();
  });

  it('distinguishes "nothing matches" from "no history at all"', () => {
    render(<LifeTimeline isAr={false} items={[item({ title: 'Ship the report' })]} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nothing matches this view/i)).toBeTruthy();
  });

  it('hides administrative noise by default', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[
          item({ title: 'Ship the report', eventType: 'completed' }),
          item({ title: 'Created a task', eventType: 'created' })
        ]}
      />
    );
    expect(screen.queryByText('Created a task')).toBeNull();
  });

  it('collapses a repeated activity into one row that says how many', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[
          item({ domain: 'quran', eventType: 'session', title: 'Juz 1', timestamp: '2026-11-10T08:00:00.000Z' }),
          item({ domain: 'quran', eventType: 'session', title: 'Juz 2', timestamp: '2026-11-10T12:00:00.000Z' })
        ]}
      />
    );
    expect(screen.getByText(/2 events/)).toBeTruthy();
  });

  it('filters by area from the chips', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[
          item({ domain: 'tasks', title: 'Ship the report' }),
          item({ domain: 'quran', eventType: 'session', title: 'Juz 3' })
        ]}
      />
    );
    // The area appears in both the chip row and the event-type row is absent, so pick the chip.
    fireEvent.click(screen.getAllByRole('button', { name: /Quran/i })[0]);
    expect(screen.getByText('Juz 3')).toBeTruthy();
    expect(screen.queryByText('Ship the report')).toBeNull();
  });

  it('renders Arabic chrome when asked', () => {
    render(<LifeTimeline isAr items={[]} />);
    expect(screen.getByText(/لم تبدأ ذاكرتك بعد/)).toBeTruthy();
  });
});

describe('LifeTimeline — opening an event', () => {
  it('expands a row to show its detail instead of navigating immediately', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[item({ title: 'Ship the report', description: 'The Q3 numbers' })]}
      />
    );
    expect(screen.queryByText('The Q3 numbers')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ship the report/ }));
    expect(screen.getByText('The Q3 numbers')).toBeTruthy();
  });

  it('reports the domain and entity id of the event it opens', () => {
    const onOpenSource = vi.fn();
    render(
      <LifeTimeline
        isAr={false}
        items={[item({ domain: 'tasks', entityId: 'task-42', title: 'Ship the report' })]}
        onOpenSource={onOpenSource}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ship the report/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open source/i }));
    expect(onOpenSource).toHaveBeenCalledWith('tasks', 'task-42');
  });

  it('offers no source link for an event that has no screen', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[item({ domain: 'review', eventType: 'milestone', title: 'Weekly review' })]}
        onOpenSource={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Weekly review/ }));
    expect(screen.queryByRole('button', { name: /Open source/i })).toBeNull();
  });
});

describe('LifeTimeline — handoff to the map', () => {
  it('sends the day heading to the map', () => {
    const onOpenDay = vi.fn();
    render(
      <LifeTimeline
        isAr={false}
        items={[item({ title: 'Ship the report', date: '2026-11-10' })]}
        onOpenDay={onOpenDay}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /On the map/i }));
    expect(onOpenDay).toHaveBeenCalledWith('2026-11-10');
  });

  it('offers no map link when the caller did not ask for one', () => {
    render(<LifeTimeline isAr={false} items={[item({ title: 'Ship the report' })]} />);
    expect(screen.queryByRole('button', { name: /On the map/i })).toBeNull();
  });
});

describe('LifeTimeline — arriving with a day focus', () => {
  it('shows the focused day and only that day', () => {
    render(
      <LifeTimeline
        isAr={false}
        items={[
          item({ title: 'Ship the report', date: '2026-11-10' }),
          item({ domain: 'quran', eventType: 'session', title: 'Juz 3', date: '2026-11-09' })
        ]}
        focusDate="2026-11-10"
      />
    );
    expect(screen.getByText('Ship the report')).toBeTruthy();
    expect(screen.queryByText('Juz 3')).toBeNull();
  });

  it('shows the focused date and offers to clear it', () => {
    const onClearFocusDate = vi.fn();
    render(
      <LifeTimeline
        isAr={false}
        items={[item({ title: 'Ship the report', date: '2026-11-10' })]}
        focusDate="2026-11-10"
        onClearFocusDate={onClearFocusDate}
      />
    );
    expect(screen.getByText('2026-11-10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear the day filter/i }));
    expect(onClearFocusDate).toHaveBeenCalled();
  });
});

describe('LifeTimeline — paging', () => {
  it('loads more rows on request and stops offering when done', () => {
    // One event per day, so nothing collapses and the counts are the raw item count.
    const items = Array.from({ length: 45 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 0, 1 + i));
      const date = day.toISOString().slice(0, 10);
      return item({ domain: 'tasks', title: `Task ${i}`, date, timestamp: `${date}T09:00:00.000Z` });
    });
    render(<LifeTimeline isAr={false} items={items} />);
    // The default period is "this month", so widen it to see the whole set.
    fireEvent.click(screen.getByRole('button', { name: /All time/i }));
    expect(screen.getByText(/Showing 40 of 45 events/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
    expect(screen.getByText(/Showing 45 of 45 events/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Load more/i })).toBeNull();
  });
});

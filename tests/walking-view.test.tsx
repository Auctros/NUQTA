/**
 * Walking Studio — UI behaviour.
 *
 * Renders the real component against the real store so the flow a user actually
 * performs (enable → start → pause → resume → finish) is exercised end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WalkingView } from '../src/components/WalkingView';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const S = () => useNuqtaStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  localStorage.clear();
  S().initializeStore();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('WalkingView', () => {
  it('offers to enable the studio instead of showing empty widgets', () => {
    render(<WalkingView />);
    expect(screen.getByRole('heading', { name: 'Walking Studio' })).toBeTruthy();
    const enable = screen.getByRole('button', { name: /Enable Walking Studio/i });
    fireEvent.click(enable);
    expect(S().habits.some((h) => h.specializedType === 'walking')).toBe(true);
  });

  it('starts, pauses, resumes, and saves a walk through the buttons', () => {
    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);

    render(<WalkingView />);
    fireEvent.click(screen.getByRole('button', { name: /Start walking/i }));
    expect(screen.getByRole('button', { name: /^Pause$/ })).toBeTruthy();

    // 5 minutes of walking, then a 2 minute pause, then 5 more.
    act(() => {
      vi.advanceTimersByTime(300_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /^Pause$/ }));
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }));
    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    // The readout must show walked time only, not wall-clock time.
    expect(screen.getByRole('timer').textContent).toBe('10:00');

    fireEvent.click(screen.getByRole('button', { name: /Finish & save/i }));

    const d = S().habits.find((h) => h.specializedType === 'walking')!.walkingData!;
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0].durationSeconds).toBe(600);
    expect(d.sessions[0].pausedSeconds).toBe(120);
  });

  it('discards a walk without writing anything', () => {
    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);

    render(<WalkingView />);
    fireEvent.click(screen.getByRole('button', { name: /Start walking/i }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));

    expect(S().habits.find((h) => h.specializedType === 'walking')!.walkingData!.sessions).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Start walking/i })).toBeTruthy();
  });

  it('shows an honest dash rather than a zero when nothing was measured', () => {
    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);

    render(<WalkingView />);
    // Distance and steps both read as unmeasured, never as a fabricated zero.
    expect(screen.getAllByText('not recorded')).toHaveLength(2);
    expect(screen.queryByText('0 km')).toBeNull();
    expect(screen.queryByText('0 steps')).toBeNull();
  });
});

describe('Walking Studio — scene wiring', () => {
  it('drives the walk cycle from the is-walking class, not from a JS timer value', () => {
    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);

    const { container } = render(<WalkingView />);
    fireEvent.click(screen.getByRole('button', { name: /Start walking/i }));

    // SVG elements expose className as an SVGAnimatedString, so read the attribute.
    const scene = container.querySelector('.walk-scene')!;
    expect(scene.getAttribute('class')).toContain('is-walking');

    // Parallax must be a CSS loop: a value recomputed from `seconds % 60` snapped the
    // landscape back to zero at every minute boundary.
    const stage = container.querySelector<HTMLElement>('.walk-stage')!;
    expect(stage.style.getPropertyValue('--walk-progress')).toBe('');
  });

  it('keeps the weekly bar filled while the timer is stopped', () => {
    S().createHabit({
      name: 'Daily Walk',
      anchor: '',
      category: 'health',
      timeOfDay: 'afternoon',
      specializedType: 'walking'
    } as any);
    const habit = S().habits.find((h) => h.specializedType === 'walking')!;
    // 75 of the default 150 weekly minutes.
    S().logWalkingSession(habit.id, {
      durationSeconds: 4500,
      startedAt: '2026-11-11T12:00:00.000Z',
      endedAt: '2026-11-11T13:15:00.000Z'
    });

    const { container } = render(<WalkingView />);
    const fill = container.querySelector<HTMLElement>('.walk-stage-progress span')!;
    expect(fill.style.width).toBe('50%');
  });
});

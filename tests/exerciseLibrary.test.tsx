import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExerciseCard } from '../src/components/workout/ExerciseCard';
import { ExerciseDetailModal } from '../src/components/workout/ExerciseDetailModal';
import { MuscleMap, MUSCLE_IDS } from '../src/components/workout/MuscleMap';
import { ExerciseIllustration } from '../src/components/workout/illustration/ExerciseIllustration';
import { WorkoutAppModal } from '../src/components/WorkoutAppModal';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { EXERCISE_CATALOG, recentlyPerformedExercises } from '../src/lib/exerciseCatalog';
import { ExerciseCatalog } from '../src/components/workout/ExerciseCatalog';
import { ILLUSTRATION_KEYS, ART_IDS, EXERCISE_ART, artUrl } from '../src/components/workout/illustration/exerciseArt';

const pushUp = EXERCISE_CATALOG.find((e) => e.illustrationKey === 'push-up')!;

describe('ExerciseIllustration', () => {
  it('draws every exercise from the shared character set', () => {
    // One authored set is the whole point: every exercise must resolve to art,
    // so no card falls back to the placeholder and breaks the visual run.
    const missing = ILLUSTRATION_KEYS.filter((k) => !EXERCISE_ART[k]?.art);
    expect(missing).toEqual([]);
    expect(ART_IDS.length).toBeGreaterThan(0);
  });

  it('points each key at a vendored SVG that exists on disk', () => {
    // A key mapped to a file that was never vendored would 404 at runtime and
    // render as an empty (invisible) mask, which reads as a missing illustration.
    const missing = ART_IDS.filter((id) => !existsSync(join(process.cwd(), 'public/exercise-art', `${id}.svg`)));
    expect(missing).toEqual([]);
  });

  it('paints every figure with the same ink, so the set is visually consistent', () => {
    // The ink is the element background (the SVG is only a mask). Any drawing that
    // carried its own colour would break the consistent tint across the library.
    const { container } = render(<ExerciseIllustration illustrationKey="push-up" isAr={false} name="Push-up" />);
    const art = container.querySelector<HTMLElement>('.ex-art')!;
    expect(art).toBeTruthy();
    const mask = art.style.getPropertyValue('mask-image') || art.style.getPropertyValue('-webkit-mask-image');
    expect(mask).toContain(artUrl('push-up'));
  });

  it('keeps the vendored SVGs as uncoloured line art (no hard-coded fill)', () => {
    // `currentColor` / no fill keeps the drawing usable as a mask and tintable by
    // the theme; a baked-in fill would render one colour in every theme.
    const offenders = ART_IDS.filter((id) => {
      const svg = readFileSync(join(process.cwd(), 'public/exercise-art', `${id}.svg`), 'utf8');
      return /fill="#[0-9a-fA-F]{3,6}"/.test(svg) || /stroke="#[0-9a-fA-F]{3,6}"/.test(svg);
    });
    expect(offenders).toEqual([]);
  });

  it('gives every illustration an accessible description in both languages', () => {
    const bad = ILLUSTRATION_KEYS.filter((k) => !EXERCISE_ART[k].altEn || !EXERCISE_ART[k].altAr);
    expect(bad).toEqual([]);
  });

  it('renders a labelled illustration for a known exercise', () => {
    render(<ExerciseIllustration illustrationKey="push-up" isAr={false} name="Standard Push-up" />);
    const art = screen.getByRole('img', { name: /Standard Push-up/ });
    expect(art.getAttribute('data-art')).toBe('push-up');
    expect(art.getAttribute('aria-description')).toMatch(/push/i);
  });

  it('renders the Arabic description when isAr is set', () => {
    render(<ExerciseIllustration illustrationKey="air-squat" isAr name="القرفصاء" />);
    const art = screen.getByRole('img', { name: /القرفصاء/ });
    expect(art.getAttribute('aria-description')).toBe(EXERCISE_ART['air-squat'].altAr);
  });

  it('falls back to a placeholder for an unknown key instead of throwing', () => {
    render(<ExerciseIllustration illustrationKey="does-not-exist" isAr={false} name="Mystery Move" />);
    expect(screen.getByRole('img', { name: 'Mystery Move' })).toBeTruthy();
  });

  it('renders every registered illustration without crashing', () => {
    for (const key of ILLUSTRATION_KEYS) {
      const { unmount } = render(<ExerciseIllustration illustrationKey={key} isAr={false} name={key} />);
      expect(screen.getByRole('img', { name: new RegExp(key) })).toBeTruthy();
      unmount();
    }
  });
});

describe('MuscleMap', () => {
  it('highlights primary, secondary and neutral regions and shows a legend', () => {
    const { container } = render(<MuscleMap primary={['chest']} secondary={['triceps']} isAr={false} />);
    expect(container.querySelectorAll('.ex-mm-primary').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.ex-mm-secondary').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.ex-mm-neutral').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
  });

  it('has a path for every known muscle id', () => {
    const { container } = render(<MuscleMap primary={MUSCLE_IDS} secondary={[]} isAr />);
    // primary regions are the ones we passed in; all must resolve to a path
    expect(container.querySelectorAll('.ex-mm-primary').length).toBeGreaterThan(10);
  });
});

describe('ExerciseCard', () => {
  it('shows the name and opens the detail sheet on click', () => {
    let opened: string | null = null;
    render(<ExerciseCard exercise={pushUp} isAr={false} onOpen={(e) => (opened = e.id)} />);
    const openBtn = screen.getByRole('button', { name: pushUp.nameEn });
    expect(openBtn.textContent).toContain(pushUp.nameEn);
    fireEvent.click(openBtn);
    expect(opened).toBe(pushUp.id);
  });

  it('offers a quick add action when provided', () => {
    let added: string | null = null;
    render(<ExerciseCard exercise={pushUp} isAr={false} onOpen={() => {}} onAdd={(e) => (added = e.id)} addLabel="Add" />);
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    expect(added).toBe(pushUp.id);
  });
});

describe('ExerciseDetailModal', () => {
  it('renders the demonstration, muscle map and instructional content', () => {
    render(<ExerciseDetailModal exercise={pushUp} isAr={false} onClose={() => {}} />);
    expect(screen.getByRole('img', { name: new RegExp(pushUp.nameEn) })).toBeTruthy();
    expect(screen.getByText('How to perform it')).toBeTruthy();
    expect(screen.getByText('Breathing')).toBeTruthy();
    expect(screen.getByText('Form cues')).toBeTruthy();
    expect(screen.getByText('Common mistakes')).toBeTruthy();
    expect(screen.getByText('Safety')).toBeTruthy();
    expect(screen.getByText('Make it easier')).toBeTruthy();
    expect(screen.getByText('Make it harder')).toBeTruthy();
    // every step of the coaching content is present
    for (const step of pushUp.coaching.stepsEn) expect(screen.getByText(step)).toBeTruthy();
  });

  it('renders the Arabic coaching content when isAr is set', () => {
    render(<ExerciseDetailModal exercise={pushUp} isAr onClose={() => {}} />);
    expect(screen.getByText('خطوات الأداء')).toBeTruthy();
    for (const step of pushUp.coaching.stepsAr) expect(screen.getByText(step)).toBeTruthy();
  });

  it('renders nothing when no exercise is selected', () => {
    const { container } = render(<ExerciseDetailModal exercise={null} isAr={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('WorkoutAppModal library tab', () => {
  it('renders the catalog grid and opens the detail modal', () => {
    useNuqtaStore.getState().initializeStore();
    const habit: any = {
      id: 'h-workout',
      title: 'Home Workout',
      specializedType: 'workout',
      workoutData: { sessions: [], customRoutines: [], weeklyTargetSessions: 4 }
    };
    render(<WorkoutAppModal habit={habit} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Exercise Catalog'));
    expect(document.querySelectorAll('.ex-card').length).toBe(EXERCISE_CATALOG.length);

    // search narrows the grid
    const search = screen.getByLabelText('Search the library');
    fireEvent.change(search, { target: { value: 'push-up' } });
    expect(document.querySelectorAll('.ex-card').length).toBeLessThan(EXERCISE_CATALOG.length);

    // clearing restores, and a card opens the detail modal
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(document.querySelector('.ex-card button') as HTMLElement);
    expect(document.querySelector('.ex-detail')).toBeTruthy();
    expect(document.querySelectorAll('.ex-mm-primary').length).toBeGreaterThan(0);
  });
});

describe('recentlyPerformedExercises', () => {
  const session = (date: string, names: string[]) => ({
    id: `s-${date}`,
    date,
    title: 'x',
    workoutType: 'strength' as const,
    durationMinutes: 20,
    volumeKg: 0,
    intensityRating: 3 as const,
    exercises: names.map((name, i) => ({ id: `${date}-${i}`, name, category: 'chest' as const, sets: [] }))
  });

  it('returns catalog matches newest first, deduplicated', () => {
    const result = recentlyPerformedExercises([
      session('2026-01-01', ['Standard Push-up', 'Pull-up']),
      session('2026-01-03', ['Standard Push-up', 'Bodyweight Air Squat'])
    ]);
    expect(result.map((e) => e.illustrationKey)).toEqual(['push-up', 'air-squat', 'pull-up']);
  });

  it('skips names that are not in the catalog and respects the limit', () => {
    const result = recentlyPerformedExercises([session('2026-01-01', ['Made-up Move', 'Pull-up', 'Bodyweight Air Squat'])], 1);
    expect(result).toHaveLength(1);
    expect(result[0].illustrationKey).toBe('pull-up');
  });

  it('returns nothing for an empty history', () => {
    expect(recentlyPerformedExercises([])).toEqual([]);
  });
});

describe('ExerciseCatalog', () => {
  it('filters by query and clears back to the full catalog', () => {
    render(<ExerciseCatalog isAr={false} />);
    expect(document.querySelectorAll('.ex-card').length).toBe(EXERCISE_CATALOG.length);
    fireEvent.change(screen.getByLabelText('Search the library'), { target: { value: 'squat' } });
    expect(document.querySelectorAll('.ex-card').length).toBeLessThan(EXERCISE_CATALOG.length);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(document.querySelectorAll('.ex-card').length).toBe(EXERCISE_CATALOG.length);
  });

  it('adds an exercise through the quick-add action', () => {
    let added: string | null = null;
    render(<ExerciseCatalog isAr={false} onAdd={(e) => (added = e.id)} addLabel="Add" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Add/ })[0]);
    expect(added).toBeTruthy();
  });

  it('shows a recently-performed quick pick from session history', () => {
    const session: any = {
      id: 's1',
      date: '2026-01-01',
      title: 'x',
      workoutType: 'strength',
      durationMinutes: 20,
      volumeKg: 0,
      intensityRating: 3,
      exercises: [{ id: 'e1', name: 'Standard Push-up', category: 'chest', sets: [] }]
    };
    render(<ExerciseCatalog isAr={false} recentSessions={[session]} />);
    expect(screen.getByText('Recently performed')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Standard Push-up' }).length).toBeGreaterThan(1);
  });

  it('omits the filter row in the inline variant', () => {
    render(<ExerciseCatalog isAr={false} variant="inline" />);
    expect(screen.queryByLabelText('Region')).toBeNull();
    expect(document.querySelectorAll('.ex-card').length).toBe(EXERCISE_CATALOG.length);
  });
});

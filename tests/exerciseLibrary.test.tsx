import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseCard } from '../src/components/workout/ExerciseCard';
import { ExerciseDetailModal } from '../src/components/workout/ExerciseDetailModal';
import { MuscleMap, MUSCLE_IDS } from '../src/components/workout/MuscleMap';
import { ExerciseIllustration } from '../src/components/workout/illustration/ExerciseIllustration';
import { WorkoutAppModal } from '../src/components/WorkoutAppModal';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { EXERCISE_CATALOG, recentlyPerformedExercises } from '../src/lib/exerciseCatalog';
import { ExerciseCatalog } from '../src/components/workout/ExerciseCatalog';
import { ILLUSTRATION_KEYS, getIllustration } from '../src/components/workout/illustration/registry';

const pushUp = EXERCISE_CATALOG.find((e) => e.illustrationKey === 'push-up')!;

describe('ExerciseIllustration', () => {
  it('keeps every pose inside the illustration viewBox', () => {
    // The viewBox is 200x200. A joint outside it means a limb is clipped or the
    // figure is drawn off-canvas, which reads as a broken illustration.
    const outside: string[] = [];
    for (const key of ILLUSTRATION_KEYS) {
      const illo = getIllustration(key)!;
      illo.phases.forEach((pose, i) => {
        const joints = [pose.head, pose.neck, pose.hip, ...pose.armNear, ...pose.armFar, ...pose.legNear, ...pose.legFar];
        for (const q of joints) {
          if (!(q.x >= -6 && q.x <= 206 && q.y >= -6 && q.y <= 206)) {
            outside.push(`${key}#${i} (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
          }
        }
      });
    }
    expect(outside).toEqual([]);
  });

  it('draws limbs at plausible lengths and a consistent torso', () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const broken: string[] = [];
    for (const key of ILLUSTRATION_KEYS) {
      const illo = getIllustration(key)!;
      illo.phases.forEach((pose, i) => {
        const torso = dist(pose.hip, pose.neck);
        if (torso < 28 || torso > 62) broken.push(`${key}#${i} torso ${torso.toFixed(0)}`);
        const chains: [string, typeof pose.armNear][] = [
          ['armNear', pose.armNear],
          ['armFar', pose.armFar],
          ['legNear', pose.legNear],
          ['legFar', pose.legFar]
        ];
        for (const [name, c] of chains) {
          const upper = dist(c[0], c[1]);
          const lower = dist(c[1], c[2]);
          if (upper < 14 || upper > 48 || lower < 12 || lower > 46) {
            broken.push(`${key}#${i} ${name} ${upper.toFixed(0)}/${lower.toFixed(0)}`);
          }
        }
      });
    }
    expect(broken).toEqual([]);
  });

  it('marks an illustration animated only when its phases actually differ', () => {
    // An entry flagged `animated` with identical phases animates nothing, which
    // reads as a broken player in the detail view.
    const poseKey = (pose: {
      head: { x: number; y: number };
      neck: { x: number; y: number };
      hip: { x: number; y: number };
      armNear: { x: number; y: number }[];
      armFar: { x: number; y: number }[];
      legNear: { x: number; y: number }[];
      legFar: { x: number; y: number }[];
    }) =>
      [pose.head, pose.neck, pose.hip, ...pose.armNear, ...pose.armFar, ...pose.legNear, ...pose.legFar]
        .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
        .join('|');
    const staticAnimated: string[] = [];
    for (const key of ILLUSTRATION_KEYS) {
      const illo = getIllustration(key)!;
      if (!illo.animated) continue;
      if (illo.phases.length < 2 || illo.phases.every((p) => poseKey(p) === poseKey(illo.phases[0]))) {
        staticAnimated.push(key);
      }
    }
    expect(staticAnimated).toEqual([]);
  });

  it('keeps motion arrows and ground props inside the viewBox', () => {
    const inside = (x: number, y: number) => x >= -4 && x <= 204 && y >= -4 && y <= 204;
    const bad: string[] = [];
    for (const key of ILLUSTRATION_KEYS) {
      const illo = getIllustration(key)!;
      if (illo.motion) {
        if (!inside(illo.motion.from.x, illo.motion.from.y)) bad.push(`${key} motion.from`);
        if (!inside(illo.motion.to.x, illo.motion.to.y)) bad.push(`${key} motion.to`);
      }
      const g = illo.ground;
      if (g?.bar && (!inside(g.bar.x1, g.bar.y) || !inside(g.bar.x2, g.bar.y))) bad.push(`${key} bar`);
      if (g?.chair && !inside(g.chair.x, g.chair.y)) bad.push(`${key} chair`);
      if (g?.floor && (g.floor.from < -4 || g.floor.to > 204 || !inside(g.floor.from, g.floor.y))) bad.push(`${key} floor`);
      if (g?.mat && (g.mat.from < -4 || g.mat.to > 204)) bad.push(`${key} mat`);
      if (g?.wall && (g.wall.from < -4 || g.wall.to > 204 || !inside(g.wall.x, g.wall.from))) bad.push(`${key} wall`);
    }
    expect(bad).toEqual([]);
  });

  it('gives every illustration an accessible description in both languages', () => {
    const bad = ILLUSTRATION_KEYS.filter((k) => {
      const i = getIllustration(k)!;
      return !i.altEn || !i.altAr;
    });
    expect(bad).toEqual([]);
  });

  it('renders a labelled SVG for a known exercise', () => {
    render(<ExerciseIllustration illustrationKey="push-up" isAr={false} name="Standard Push-up" />);
    const svg = screen.getByRole('img', { name: /Standard Push-up/ });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.querySelectorAll('polyline').length).toBeGreaterThan(0);
  });

  it('renders Arabic description when isAr is set', () => {
    render(<ExerciseIllustration illustrationKey="air-squat" isAr name="القرفصاء" />);
    expect(screen.getByRole('img', { name: /القرفصاء/ })).toBeTruthy();
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

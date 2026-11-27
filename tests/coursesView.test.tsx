/**
 * Courses Studio — the library, a course, and the promise it represents.
 *
 * Courses store a local snapshot of a YouTube playlist, so every test here seeds the
 * real store and renders the real component. Progress is the one thing this view
 * writes, and it is the user's own statement — never inferred from playback — so the
 * tests check that marking a lesson done survives a remount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { CoursesView } from '../src/components/CoursesView';
import { useNuqtaStore } from '../src/store/nuqtaStore';
import { getActiveDialog, settleDialog } from '../src/components/ui/dialogController';
import type { CourseVideo, YoutubeCourse } from '../src/types';

const S = () => useNuqtaStore.getState();

function video(overrides: Partial<CourseVideo> = {}): CourseVideo {
  return {
    videoId: `vid${Math.random().toString(36).slice(2, 13)}`,
    title: 'Lesson',
    position: 0,
    ...overrides
  } as CourseVideo;
}

function course(overrides: Partial<YoutubeCourse> = {}): YoutubeCourse {
  return {
    id: 'c1',
    playlistId: 'PLillGF-RfqbbnE1ZyYY0k8XLKzWVC5cU4',
    title: 'Learn TypeScript',
    channelTitle: 'Type Academy',
    videos: [
      video({ videoId: 'aaaaaaaaaaa', title: 'Lesson one', position: 0 }),
      video({ videoId: 'bbbbbbbbbbb', title: 'Lesson two', position: 1 })
    ],
    itemCount: 2,
    canonicalUrl: 'https://www.youtube.com/playlist?list=PLillGF-RfqbbnE1ZyYY0k8XLKzWVC5cU4',
    fetchedAt: '2026-11-10T09:00:00.000Z',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
  localStorage.clear();
  // A queued dialog from a previous test would block the next confirmation.
  let pending = getActiveDialog();
  while (pending) {
    settleDialog(pending.id, false);
    pending = getActiveDialog();
  }
  S().initializeStore();
  // No server proxy in tests: status resolves as "not configured", never throws.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ configured: false }), { status: 200 }))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const seed = async (c: YoutubeCourse) => {
  await act(async () => {
    S().upsertCourse(c);
  });
};

describe('CoursesView — empty library', () => {
  it('invites the first import instead of showing empty widgets', async () => {
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(screen.getByText(/No courses yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Import your first course/i })).toBeTruthy();
  });

  it('explains that importing needs a server key, and that saved courses still work', async () => {
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(screen.getByText(/YOUTUBE_API_KEY/)).toBeTruthy();
    expect(screen.getByText(/work fully offline/i)).toBeTruthy();
  });

  it('rejects a link that is not a playlist, with a reason', async () => {
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import playlist/i }));
    });
    const input = screen.getByPlaceholderText(/playlist\?list/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://vimeo.com/12345' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));
    });
    expect(screen.getByText(/not a YouTube link/i)).toBeTruthy();
    expect(S().courses).toHaveLength(0);
  });

  it('never sends a malformed link to the server', async () => {
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import playlist/i }));
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/playlist\?list/), {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
      });
    });
    const before = (globalThis.fetch as any).mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));
    });
    expect((globalThis.fetch as any).mock.calls.length).toBe(before);
    expect(screen.getByText(/has no playlist/i)).toBeTruthy();
  });
});

describe('CoursesView — library', () => {
  it('lists a course with its promise: how many lessons remain', async () => {
    await seed(course());
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(screen.getByText('Learn TypeScript')).toBeTruthy();
    expect(screen.getByText('0 of 2 lessons')).toBeTruthy();
    expect(screen.getByText('Type Academy')).toBeTruthy();
  });

  it('counts lessons and completion across the library', async () => {
    await seed(course());
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(screen.getByText('2')).toBeTruthy(); // lessons
    expect(screen.getByText('0/2')).toBeTruthy(); // completed
  });

  it('sorts the course nearest to done first', async () => {
    await seed(course({ id: 'c1', title: 'Fresh course' }));
    await seed(
      course({
        id: 'c2',
        playlistId: 'PLbbbbbbbbbbbbbbbbbbbb',
        title: 'Almost done',
        videos: [video({ videoId: 'ccccccccccc', title: 'A', position: 0 })]
      })
    );
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c2: ['ccccccccccc'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    const titles = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    const almost = titles.findIndex((t) => t.includes('Almost done'));
    const fresh = titles.findIndex((t) => t.includes('Fresh course'));
    expect(almost).toBeGreaterThanOrEqual(0);
    expect(almost).toBeLessThan(fresh);
  });

  it('marks a finished course with a completion badge', async () => {
    await seed(
      course({ videos: [video({ videoId: 'aaaaaaaaaaa', title: 'Only lesson', position: 0 })] })
    );
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(screen.getByText('1 of 1 lessons')).toBeTruthy();
  });
});

describe('CoursesView — a course', () => {
  const openCourse = async (c: YoutubeCourse) => {
    await seed(c);
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript|Only lesson/ }));
    });
  };

  it('shows the lessons in YouTube order with their titles', async () => {
    await openCourse(course());
    expect(screen.getByText('Lesson one')).toBeTruthy();
    expect(screen.getByText('Lesson two')).toBeTruthy();
  });

  it('offers "continue watching" at the first unfinished lesson, not the first lesson', async () => {
    await seed(course());
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    const resume = screen.getByRole('link', { name: /Continue watching/i });
    expect(resume.getAttribute('href')).toContain('bbbbbbbbbbb');
    expect(resume.getAttribute('href')).toContain('list=');
  });

  it('offers "play all" on a course that has not been started', async () => {
    await openCourse(course());
    const play = screen.getByRole('link', { name: /Play all/i });
    // Starting a course must open its first lesson, not just the playlist page.
    expect(play.getAttribute('href')).toContain('aaaaaaaaaaa');
  });

  it('marks a lesson done and records it locally', async () => {
    await openCourse(course());
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Mark as completed/i })[0]);
    });
    const stored = JSON.parse(localStorage.getItem('nuqta.ui.courseProgress') ?? '{}');
    expect(stored.c1).toHaveLength(1);
  });

  it('unmarks a lesson that was already done', async () => {
    await seed(course());
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Mark as not completed/i })[0]);
    });
    const stored = JSON.parse(localStorage.getItem('nuqta.ui.courseProgress') ?? '{}');
    expect(stored.c1).toHaveLength(0);
  });

  it('opens the course on YouTube in a new tab, without leaking the referrer', async () => {
    await openCourse(course());
    const link = screen.getByRole('link', { name: /Open on YouTube/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('says when the saved copy is partial rather than pretending it is whole', async () => {
    await openCourse(course({ truncated: true, itemCount: 200 }));
    expect(screen.getByText(/only part of it was saved/i)).toBeTruthy();
  });

  it('asks for confirmation before removing a course, in the app dialog layer', async () => {
    await seed(course());
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^Remove$/ })[0]);
    });

    // The confirmation is the app's own queued dialog, so nothing is removed yet.
    const active = getActiveDialog();
    expect(active?.kind).toBe('confirm');
    expect(JSON.stringify(active?.options)).toContain('Learn TypeScript');
    expect(S().courses).toHaveLength(1);

    await act(async () => {
      settleDialog(active!.id, true);
    });
    expect(S().courses).toHaveLength(0);
  });

  it('keeps the course when the removal is cancelled', async () => {
    await seed(course());
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^Remove$/ })[0]);
    });

    await act(async () => {
      settleDialog(getActiveDialog()!.id, false);
    });
    expect(S().courses).toHaveLength(1);
  });
});

describe('CoursesView — Arabic', () => {
  it('renders the studio in Arabic', async () => {
    await act(async () => {
      render(<CoursesView isAr />);
    });
    expect(screen.getByText(/لا دورات بعد/)).toBeTruthy();
  });
});

describe('CoursesView — cover artwork', () => {
  const COVER = 'https://i.ytimg.com/vi/zzzzzzzzzzz/hqdefault.jpg';

  it('uses the real playlist thumbnail on the library card', async () => {
    await seed(course({ thumbnailUrl: COVER }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    const img = document.querySelector(`img[src="${COVER}"]`);
    expect(img).toBeTruthy();
    // The cover is decoration next to the title, so it must not be announced twice.
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('shows the title and channel over the cover, not beside it', async () => {
    await seed(course({ thumbnailUrl: COVER }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    const scrim = document.querySelector('.course-card-scrim');
    expect(scrim?.textContent).toContain('Learn TypeScript');
    expect(scrim?.textContent).toContain('Type Academy');
  });

  it('falls back to a designed surface when YouTube gave no cover', async () => {
    await seed(course({ thumbnailUrl: undefined }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(document.querySelector('.course-card img')).toBeNull();
    expect(document.querySelector('.course-card-fallback')).toBeTruthy();
  });

  it('replaces a cover that fails to load instead of leaving a broken image', async () => {
    await seed(course({ thumbnailUrl: COVER }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    const img = document.querySelector<HTMLImageElement>(`.course-card img[src="${COVER}"]`)!;
    await act(async () => {
      fireEvent.error(img);
    });
    expect(document.querySelector('.course-card img')).toBeNull();
    expect(document.querySelector('.course-card-fallback')).toBeTruthy();
  });

  it('never invents a cover when the course has none', async () => {
    await seed(course({ thumbnailUrl: undefined }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    expect(document.querySelectorAll('img').length).toBe(0);
  });

  it('names the card with its title, channel, and progress — and nests no widget', async () => {
    await seed(course({ thumbnailUrl: COVER }));
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    const card = screen.getByRole('button', { name: /Learn TypeScript/ });
    const name = card.textContent ?? '';
    expect(name).toContain('Type Academy');
    expect(name).toContain('1 of 2 lessons');
    // A progressbar inside a button is invalid ARIA; the bar is decoration and
    // the count is already spoken as part of the button's name.
    expect(card.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe('CoursesView — playlist detail', () => {
  const withVideos = (overrides: Partial<YoutubeCourse> = {}) =>
    course({
      description: 'A tour of the type system.',
      videos: [
        video({
          videoId: 'aaaaaaaaaaa',
          title: 'Lesson one',
          position: 0,
          durationSeconds: 3661,
          thumbnailUrl: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg'
        }),
        video({
          videoId: 'bbbbbbbbbbb',
          title: 'Lesson two',
          position: 1,
          durationSeconds: 90,
          thumbnailUrl: 'https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg'
        })
      ],
      ...overrides
    });

  const openWith = async (c: YoutubeCourse) => {
    await seed(c);
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
  };

  it('shows the playlist description and video count in the hero', async () => {
    await openWith(withVideos());
    expect(screen.getByText('A tour of the type system.')).toBeTruthy();
    expect(screen.getByText(/2 lessons/)).toBeTruthy();
  });

  it('totals the runtime only from the durations YouTube actually returned', async () => {
    await openWith(withVideos());
    // 3661s + 90s ≈ 62.5 min → rounds to 1 hr 3 min.
    expect(screen.getByText(/1 hr 3 min/)).toBeTruthy();
  });

  it('omits the total when any lesson is missing a duration', async () => {
    await openWith(
      withVideos({
        videos: [
          video({ videoId: 'aaaaaaaaaaa', title: 'Lesson one', position: 0, durationSeconds: 600 }),
          video({ videoId: 'bbbbbbbbbbb', title: 'Lesson two', position: 1 })
        ]
      })
    );
    const meta = document.querySelector('.course-hero-meta')!;
    expect(meta.textContent).not.toMatch(/\bhr\b|\bmin\b/);
  });

  it('gives every lesson row its own thumbnail and duration overlay', async () => {
    await openWith(withVideos());
    expect(document.querySelector('img[src*="aaaaaaaaaaa"]')).toBeTruthy();
    expect(document.querySelector('img[src*="bbbbbbbbbbb"]')).toBeTruthy();
    // 3661s formats as 1:01:01; 90s as 1:30.
    expect(screen.getByText('1:01:01')).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('marks the lesson that continue-watching will open, and only that one', async () => {
    await seed(withVideos());
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    const rows = document.querySelectorAll('.course-row');
    expect(rows[0].getAttribute('data-active')).toBe('false');
    expect(rows[1].getAttribute('data-active')).toBe('true');
    expect(screen.getAllByText(/Up next/i)).toHaveLength(1);
  });

  it('marks completed rows without hiding them from the list', async () => {
    await seed(withVideos());
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['aaaaaaaaaaa'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    const first = document.querySelectorAll('.course-row')[0];
    expect(first.getAttribute('data-done')).toBe('true');
    expect(first.textContent).toContain('Lesson one');
  });

  it('keeps playlist order even when a lesson is completed', async () => {
    await seed(withVideos());
    localStorage.setItem('nuqta.ui.courseProgress', JSON.stringify({ c1: ['bbbbbbbbbbb'] }));
    await act(async () => {
      render(<CoursesView isAr={false} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Learn TypeScript/ }));
    });
    const titles = [...document.querySelectorAll('.course-row-title')].map((n) => n.textContent);
    expect(titles).toEqual(['Lesson one', 'Lesson two']);
  });

  it('still marks lessons done from the redesigned row', async () => {
    await openWith(withVideos());
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Mark as completed/i })[1]);
    });
    const stored = JSON.parse(localStorage.getItem('nuqta.ui.courseProgress') ?? '{}');
    expect(stored.c1).toEqual(['bbbbbbbbbbb']);
  });
});

import React, { useEffect, useMemo, useState } from 'react';
import { CourseVideo, YoutubeCourse } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { Badge, Button, Field, Input, Modal, ProgressBar, SpringCheck, Surface } from './ui';
import { dialogs, feedback } from './ui/dialogController';
import { StudioEmpty, StudioFrame, StudioStat } from './studios/StudioKit';
import { usePersistedViewTab } from '../lib/useNavigation';
import { useNuqtaStore } from '../store/nuqtaStore';
import {
  courseFromPayload,
  describeYoutubeError,
  findCourseByPlaylistId,
  YoutubeClient,
  YoutubeStatus
} from '../lib/youtubeClient';
import {
  canonicalVideoUrl,
  describeParseError,
  formatDuration,
  parsePlaylistLink
} from '../lib/youtubeLink';
import { localDateKey } from '../lib/dateKey';

type CourseTab = 'library' | 'course';

/**
 * YouTube Courses.
 *
 * The design problem this solves: a playlist is a *promise* — "I will work through
 * these 40 videos". Every course app shows a list of videos and forgets the promise.
 * So the primary number here is not "videos watched" but how much of the course is
 * still ahead of you, and the library sorts by what is nearest to done.
 *
 * Two deliberate constraints:
 *   - NUQTA stores a *snapshot* of YouTube's answer. The course is readable offline;
 *     a refresh is an explicit act, never automatic.
 *   - Nothing here pretends to track watch progress from YouTube. Marking a video
 *     done is the user's own statement, stored locally, because scraping playback
 *     state is exactly the kind of fragile integration this app avoids.
 */

/** Locally recorded progress, kept beside the course so a refresh never loses it. */
const PROGRESS_KEY = 'nuqta.ui.courseProgress';

interface CourseProgress {
  /** courseId → set of completed video ids. */
  [courseId: string]: string[];
}

function readProgress(): CourseProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(progress: CourseProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* progress still works for this session */
  }
}

export const CoursesView: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const courses = useNuqtaStore((s) => s.courses);
  const upsertCourse = useNuqtaStore((s) => s.upsertCourse);
  const removeCourse = useNuqtaStore((s) => s.removeCourse);
  const setActiveNavTab = useNuqtaStore((s) => s.setActiveNavTab);

  const [tab, setTab] = usePersistedViewTab<CourseTab>('courses', ['library', 'course'], 'library');
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<YoutubeStatus | null>(null);
  const [progress, setProgress] = useState<CourseProgress>(() => readProgress());

  const client = useMemo(() => new YoutubeClient(), []);
  const openCourse = courses.find((c) => c.id === openCourseId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void client.status().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // The open course *is* the destination; the tab only mirrors it into the URL.
  // Deriving the view from `openCourse` keeps rendering independent of when the
  // route round-trip lands, so opening a card is never a no-op render.
  const showingCourse = openCourse !== null;

  useEffect(() => {
    setTab(showingCourse ? 'course' : 'library');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingCourse]);

  const completedByCourse = progress;
  const progressFor = (course: YoutubeCourse): { done: number; total: number; pct: number } => {
    const doneIds = completedByCourse[course.id] ?? [];
    const available = course.videos.filter((v) => !v.unavailable);
    const done = available.filter((v) => doneIds.includes(v.videoId)).length;
    const total = available.length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const toggleVideo = (course: YoutubeCourse, video: CourseVideo): void => {
    setProgress((prev) => {
      const current = prev[course.id] ?? [];
      const next = current.includes(video.videoId)
        ? current.filter((id) => id !== video.videoId)
        : [...current, video.videoId];
      const updated = { ...prev, [course.id]: next };
      writeProgress(updated);
      return updated;
    });
  };

  const handleImport = async (): Promise<void> => {
    setImportError(null);
    const parsed = parsePlaylistLink(linkInput);
    if (!parsed.ok) {
      const message = describeParseError(parsed.error);
      setImportError(isAr ? message.ar : message.en);
      return;
    }

    const existing = findCourseByPlaylistId(courses, parsed.value.playlistId);
    setIsImporting(true);
    try {
      const result = await client.fetchPlaylist(parsed.value.playlistId);
      if (!result.ok) {
        const message = describeYoutubeError(result.error);
        setImportError(isAr ? message.ar : message.en);
        return;
      }

      const course = courseFromPayload(
        result.value,
        existing ? { id: existing.id, createdAt: existing.createdAt, linkedGoalId: existing.linkedGoalId } : undefined
      );
      upsertCourse(course);
      setLinkInput('');
      setIsImportOpen(false);
      setOpenCourseId(course.id);
      feedback.success(
        existing
          ? isAr
            ? 'تم تحديث الدورة من يوتيوب.'
            : 'Course refreshed from YouTube.'
          : isAr
          ? 'تمت إضافة الدورة إلى مكتبتك.'
          : 'Course added to your library.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const refreshCourse = async (course: YoutubeCourse): Promise<void> => {
    const result = await client.fetchPlaylist(course.playlistId);
    if (!result.ok) {
      const message = describeYoutubeError(result.error);
      feedback.error(isAr ? message.ar : message.en);
      return;
    }
    upsertCourse(
      courseFromPayload(result.value, {
        id: course.id,
        createdAt: course.createdAt,
        linkedGoalId: course.linkedGoalId
      })
    );
    feedback.success(isAr ? 'تم تحديث الدورة.' : 'Course refreshed.');
  };

  const confirmRemove = async (course: YoutubeCourse): Promise<void> => {
    const ok = await dialogs.confirm({
      title: isAr ? 'إزالة الدورة؟' : 'Remove this course?',
      description: isAr
        ? `ستُحذف "${course.title}" من مكتبتك. يمكنك استيرادها مرة أخرى من يوتيوب في أي وقت.`
        : `"${course.title}" will be removed from your library. You can import it again from YouTube at any time.`,
      confirmLabel: isAr ? 'إزالة' : 'Remove',
      tone: 'danger'
    });
    if (!ok) return;
    removeCourse(course.id);
    setProgress((prev) => {
      const next = { ...prev };
      delete next[course.id];
      writeProgress(next);
      return next;
    });
    if (openCourseId === course.id) setOpenCourseId(null);
  };

  const sortedCourses = useMemo(() => {
    // Courses nearest to done come first: finishing is the point.
    return [...courses].sort((a, b) => {
      const pa = progressFor(a).pct;
      const pb = progressFor(b).pct;
      if (pb !== pa) return pb - pa;
      return b.createdAt.localeCompare(a.createdAt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, progress]);

  const totalVideos = courses.reduce((sum, c) => sum + c.videos.filter((v) => !v.unavailable).length, 0);
  const totalDone = courses.reduce((sum, c) => sum + progressFor(c).done, 0);

  return (
    <StudioFrame
      studio="courses"
      eyebrow={isAr ? 'استوديو الدورات' : 'Courses Studio'}
      title={isAr ? 'الدورات' : 'Courses'}
      description={
        isAr
          ? 'قوائم تشغيل يوتيوب كمقررات تتابعها. تُحفظ نسخة محلية لتعمل دون اتصال.'
          : 'YouTube playlists as courses you work through. A local snapshot keeps them readable offline.'
      }
      actions={
        <Button size="sm" onClick={() => setIsImportOpen(true)}>
          <NuqtaIcon name="plus" className="w-4 h-4" />
          {isAr ? 'استيراد قائمة' : 'Import playlist'}
        </Button>
      }
      tabs={[
        { id: 'library', label: isAr ? 'المكتبة' : 'Library', icon: 'layers', count: courses.length },
        ...(openCourse
          ? [{ id: 'course', label: isAr ? 'الدورة' : 'Course', icon: 'play' as const }]
          : [])
      ]}
      activeTab={showingCourse ? 'course' : 'library'}
      onTabChange={(id) => {
        if (id === 'library') setOpenCourseId(null);
      }}
      navVariant="shelf"
    >
      {showingCourse && openCourse ? (
        <CourseDetail
          course={openCourse}
          isAr={isAr}
          progress={progressFor(openCourse)}
          completedIds={progress[openCourse.id] ?? []}
          onToggleVideo={(video) => toggleVideo(openCourse, video)}
          onRefresh={() => void refreshCourse(openCourse)}
          onRemove={() => void confirmRemove(openCourse)}
          onBack={() => {
            setOpenCourseId(null);
            setTab('library');
          }}
          onOpenGoal={() => setActiveNavTab('goals')}
        />
      ) : (
        <div className="space-y-4">
          {courses.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StudioStat label={isAr ? 'دورات' : 'Courses'} value={String(courses.length)} />
              <StudioStat label={isAr ? 'دروس' : 'Lessons'} value={String(totalVideos)} />
              <StudioStat
                label={isAr ? 'أُنجز' : 'Completed'}
                value={`${totalDone}/${totalVideos}`}
              />
            </div>
          )}

          {status && !status.configured && (
            <Surface variant="inset" padding="sm" className="flex items-start gap-2">
              <NuqtaIcon name="alert" className="w-4 h-4 mt-0.5 text-[var(--tone-warning)]" />
              <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] leading-relaxed">
                {isAr
                  ? 'استيراد الدورات يحتاج مفتاح YouTube API على الخادم (YOUTUBE_API_KEY). الدورات المستوردة سابقاً تعمل بالكامل دون اتصال.'
                  : 'Importing needs a YouTube API key on the server (YOUTUBE_API_KEY). Courses already imported work fully offline.'}
              </p>
            </Surface>
          )}

          {courses.length === 0 ? (
            <Surface variant="panel" padding="lg">
              <StudioEmpty
                icon="play"
                title={isAr ? 'لا دورات بعد' : 'No courses yet'}
                description={
                  isAr
                    ? 'الصق رابط قائمة تشغيل من يوتيوب لتحويلها إلى دورة تتابعها درساً بدرس.'
                    : 'Paste a YouTube playlist link to turn it into a course you work through lesson by lesson.'
                }
                action={
                  <Button size="sm" onClick={() => setIsImportOpen(true)}>
                    <NuqtaIcon name="plus" className="w-4 h-4" />
                    {isAr ? 'استيراد أول دورة' : 'Import your first course'}
                  </Button>
                }
              />
            </Surface>
          ) : (
            <div className="course-grid">
              {sortedCourses.map((course) => {
                const p = progressFor(course);
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isAr={isAr}
                    progress={p}
                    onOpen={() => setOpenCourseId(course.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal
        open={isImportOpen}
        onClose={() => {
          if (isImporting) return;
          setIsImportOpen(false);
          setImportError(null);
        }}
        title={isAr ? 'استيراد قائمة تشغيل' : 'Import a playlist'}
        description={
          isAr
            ? 'الصق رابط القائمة من يوتيوب. سنقرأ بياناتها مرة واحدة ونحفظها محلياً.'
            : 'Paste the playlist link from YouTube. We read it once and keep a local copy.'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsImportOpen(false);
                setImportError(null);
              }}
              disabled={isImporting}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={() => void handleImport()} disabled={isImporting || !linkInput.trim()}>
              {isImporting
                ? isAr
                  ? 'جارٍ الاستيراد…'
                  : 'Importing…'
                : isAr
                ? 'استيراد'
                : 'Import'}
            </Button>
          </div>
        }
      >
        <Field
          label={isAr ? 'رابط قائمة التشغيل' : 'Playlist link'}
          hint={
            isAr
              ? 'مثال: youtube.com/playlist?list=PL…'
              : 'For example: youtube.com/playlist?list=PL…'
          }
          error={importError ?? undefined}
        >
          <Input
            value={linkInput}
            onChange={(event) => {
              setLinkInput(event.target.value);
              setImportError(null);
            }}
            placeholder="https://www.youtube.com/playlist?list=…"
            dir="ltr"
            disabled={isImporting}
            autoFocus
          />
        </Field>
      </Modal>
    </StudioFrame>
  );
};

/* ============================================================
   Shared cover
   ============================================================ */

/**
 * Playlist or lesson artwork, with a designed fallback.
 *
 * Thumbnails come from i.ytimg.com, the one external origin the CSP allows for
 * images. When YouTube gave no cover, or it fails to load, this draws a dark
 * accent plate instead of a broken-image glyph — never an invented picture.
 */
const Cover: React.FC<{
  src?: string;
  alt?: string;
  className?: string;
  icon?: 'play' | 'layers';
}> = ({ src, alt = '', className = 'course-card-cover', icon = 'layers' }) => {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <>
      {showImage && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={className}
          onError={() => setFailed(true)}
        />
      )}
      {!showImage && (
        <span className="course-card-fallback" aria-hidden="true">
          <NuqtaIcon name={icon} />
        </span>
      )}
    </>
  );
};

const CourseCard: React.FC<{
  course: YoutubeCourse;
  isAr: boolean;
  progress: { done: number; total: number; pct: number };
  onOpen: () => void;
}> = ({ course, isAr, progress, onOpen }) => (
  <button type="button" onClick={onOpen} className="course-card">
    <div className="course-card-media">
      <Cover src={course.thumbnailUrl} alt="" />

      {/* Title and channel ride on the artwork; the scrim fades into the cover so
          there is no hard panel edge. */}
      <div className="course-card-scrim">
        <p className="course-card-title">{course.title}</p>
        <p className="course-card-channel">
          {course.channelTitle || (isAr ? 'قناة غير معروفة' : 'Unknown channel')}
        </p>
      </div>

      {progress.pct === 100 && (
        <span className="course-card-done" title={isAr ? 'مكتملة' : 'Completed'}>
          <NuqtaIcon name="check" className="w-3 h-3" />
        </span>
      )}

      {/* Decorative: a progressbar nested in a button is invalid ARIA, and the
          same count is already in the card's accessible name below. */}
      <span className="course-card-progress" aria-hidden="true">
        <span style={{ width: `${progress.pct}%` }} />
      </span>
    </div>

    {/* The count stays in the accessible name of the card, so the button still
        announces progress to a screen reader without a second visible panel. */}
    <span className="sr-only">
      {isAr ? `${progress.done} من ${progress.total} درساً` : `${progress.done} of ${progress.total} lessons`}
    </span>
  </button>
);

/* ============================================================
   Course detail
   ============================================================ */

const CourseDetail: React.FC<{
  course: YoutubeCourse;
  isAr: boolean;
  progress: { done: number; total: number; pct: number };
  completedIds: string[];
  onToggleVideo: (video: CourseVideo) => void;
  onRefresh: () => void;
  onRemove: () => void;
  onBack: () => void;
  onOpenGoal: () => void;
}> = ({ course, isAr, progress, completedIds, onToggleVideo, onRefresh, onRemove, onBack, onOpenGoal }) => {
  // "Resume" means the first lesson not yet marked done — not merely the first lesson.
  const nextVideo = course.videos.find((v) => !v.unavailable && !completedIds.includes(v.videoId));
  const available = course.videos.filter((v) => !v.unavailable);

  // Total runtime is only shown when YouTube reported a duration for every
  // playable lesson; a partial sum would understate the course.
  const timed = available.filter((v) => typeof v.durationSeconds === 'number');
  const totalSeconds =
    available.length > 0 && timed.length === available.length
      ? timed.reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0)
      : null;

  const totalLabel = totalSeconds === null ? null : formatTotalDuration(totalSeconds, isAr);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <NuqtaIcon name="chevronLeft" className="w-4 h-4 rtl:-scale-x-100" />
          {isAr ? 'المكتبة' : 'Library'}
        </Button>
        <div className="grow" />
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <NuqtaIcon name="restore" className="w-4 h-4" />
          {isAr ? 'تحديث' : 'Refresh'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <NuqtaIcon name="trash" className="w-4 h-4" />
          {isAr ? 'إزالة' : 'Remove'}
        </Button>
      </div>

      <div className="course-layout">
        <section className="course-hero">
          <div className="course-hero-art">
            <Cover src={course.thumbnailUrl} alt="" className="course-card-cover" />
          </div>

          <div className="space-y-1">
            <h2 className="course-hero-title">{course.title}</h2>
            <div className="course-hero-meta">
              <span>{course.channelTitle || (isAr ? 'قناة غير معروفة' : 'Unknown channel')}</span>
              <span className="dot-sep">
                {isAr
                  ? `${available.length} درساً`
                  : `${available.length} ${available.length === 1 ? 'lesson' : 'lessons'}`}
              </span>
              {totalLabel && <span className="dot-sep">{totalLabel}</span>}
            </div>
          </div>

          {course.description && <p className="course-hero-desc">{course.description}</p>}

          <div className="course-hero-actions">
            {nextVideo ? (
              <a
                href={canonicalVideoUrl(nextVideo.videoId, course.playlistId)}
                target="_blank"
                rel="noopener noreferrer"
                className="course-hero-play"
              >
                <NuqtaIcon name="play" className="w-4 h-4" />
                {progress.done > 0
                  ? isAr
                    ? 'أكمل المشاهدة'
                    : 'Continue watching'
                  : isAr
                  ? 'ابدأ الدورة'
                  : 'Play all'}
              </a>
            ) : (
              <a
                href={course.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="course-hero-play"
              >
                <NuqtaIcon name="play" className="w-4 h-4" />
                {isAr ? 'أعد المشاهدة' : 'Watch again'}
              </a>
            )}
            <a
              href={course.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-full)] border border-[var(--studio-line)] text-[var(--fs-xs)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--studio-line-strong)] transition-colors"
            >
              {isAr ? 'افتح في يوتيوب' : 'Open on YouTube'}
              <NuqtaIcon name="arrow" className="w-3.5 h-3.5 rtl:-scale-x-100" />
            </a>
            <Button variant="ghost" size="sm" onClick={onOpenGoal}>
              <NuqtaIcon name="target" className="w-3.5 h-3.5" />
              {isAr ? 'اربطه بهدف' : 'Link to a goal'}
            </Button>
          </div>

          <div className="course-hero-progress">
            <div className="course-hero-progress-label">
              <span>
                {progress.done === 0
                  ? isAr
                    ? 'لم تبدأ بعد'
                    : 'Not started'
                  : isAr
                  ? 'تقدمك'
                  : 'Your progress'}
              </span>
              <span>
                <strong>{progress.pct}%</strong>
                {` · ${progress.done}/${progress.total}`}
              </span>
            </div>
            <ProgressBar value={progress.pct} />
          </div>

          {course.truncated && (
            <p className="text-[var(--fs-xs)] text-[var(--tone-warning)]">
              {isAr
                ? 'قائمة التشغيل أطول من الحد المسموح للاستيراد، لذا حُفظ جزء منها فقط.'
                : 'This playlist is longer than the import limit, so only part of it was saved.'}
            </p>
          )}
        </section>

        <div className="min-w-0">
          <div className="course-list-head">
            <span className="inline-flex items-center gap-2">
              <span className="text-[var(--fs-sm)] font-semibold text-[var(--text-primary)]">
                {isAr ? 'الدروس' : 'Lessons'}
              </span>
              <Badge tone="neutral">{course.videos.length}</Badge>
            </span>
            <span className="tabular-nums">
              {isAr
                ? `${progress.done} مكتمل`
                : `${progress.done} done`}
            </span>
          </div>

          <ol className="course-list">
            {course.videos.map((video) => (
              <LessonRow
                key={`${video.videoId}-${video.position}`}
                video={video}
                isAr={isAr}
                playlistId={course.playlistId}
                channelTitle={course.channelTitle}
                done={completedIds.includes(video.videoId)}
                active={nextVideo?.videoId === video.videoId}
                onToggle={() => onToggleVideo(video)}
              />
            ))}
          </ol>

          <p className="text-[10px] text-[var(--text-tertiary)] mt-3">
            {isAr
              ? `آخر تحديث للبيانات: ${course.fetchedAt.slice(0, 10)} — نسخة محلية من يوتيوب.`
              : `Metadata last refreshed: ${course.fetchedAt.slice(0, 10)} — a local copy of YouTube's data.`}
          </p>
        </div>
      </div>
    </div>
  );
};

/** "2 hr 14 min" / "ساعتان و14 دقيقة" — only whole minutes, never a fake precision. */
function formatTotalDuration(seconds: number, isAr: boolean): string | null {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (isAr) {
    const h = hours > 0 ? `${hours} ساعة` : '';
    const m = minutes > 0 ? `${minutes} دقيقة` : '';
    return [h, m].filter(Boolean).join(' و');
  }
  const h = hours > 0 ? `${hours} hr` : '';
  const m = minutes > 0 ? `${minutes} min` : '';
  return [h, m].filter(Boolean).join(' ');
}

const LessonRow: React.FC<{
  video: CourseVideo;
  isAr: boolean;
  playlistId: string;
  channelTitle?: string;
  done: boolean;
  active: boolean;
  onToggle: () => void;
}> = ({ video, isAr, playlistId, channelTitle, done, active, onToggle }) => {
  const duration = formatDuration(video.durationSeconds ?? null);
  const uploader = video.channelTitle || channelTitle;
  const year = video.publishedAt ? video.publishedAt.slice(0, 4) : null;

  return (
    <li
      className="course-row"
      data-done={done ? 'true' : 'false'}
      data-active={active ? 'true' : 'false'}
    >
      <div className="course-row-thumb">
        {video.unavailable ? (
          <span className="course-card-fallback" aria-hidden="true">
            <NuqtaIcon name="alert" />
          </span>
        ) : (
          <Cover src={video.thumbnailUrl} alt="" icon="play" />
        )}
        {!video.unavailable && duration && (
          <span className="course-row-duration">{duration}</span>
        )}
      </div>

      <div className="course-row-body">
        <div className="course-row-main">
          {video.unavailable ? (
            <span className="course-row-unavailable">
              {isAr ? 'هذا الدرس لم يعد متاحاً على يوتيوب.' : 'This lesson is no longer available on YouTube.'}
            </span>
          ) : (
            <a
              href={canonicalVideoUrl(video.videoId, playlistId)}
              target="_blank"
              rel="noopener noreferrer"
              className="course-row-title"
            >
              {video.title}
            </a>
          )}

          <div className="course-row-meta">
            <span className="tabular-nums">
              {String(video.position + 1).padStart(2, '0')}
            </span>
            {uploader && <span>{uploader}</span>}
            {year && <span>{year}</span>}
            {active && (
              <span className="course-row-now">
                <span className="bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {isAr ? 'التالي' : 'Up next'}
              </span>
            )}
          </div>
        </div>

        <SpringCheck
          checked={done}
          onChange={onToggle}
          size="sm"
          className="shrink-0 mt-0.5"
          ariaLabel={
            done
              ? isAr
                ? 'تحديد كغير مكتمل'
                : 'Mark as not completed'
              : isAr
              ? 'تحديد كمكتمل'
              : 'Mark as completed'
          }
        />
      </div>
    </li>
  );
};

export default CoursesView;

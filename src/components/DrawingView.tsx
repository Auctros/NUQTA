import { localDateKey, parseDateKey, addDaysToKey } from '../lib/dateKey';
import React, { useMemo, useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { ArtMedium, ArtProject, ProjectStage } from '../types';
import { Button, Field, Input, Modal, Select, Textarea, Toast } from './ui';
import { StudioFrame, StudioSection, StudioStat, StudioBars, StudioEmpty, StudioTab } from './studios/StudioKit';

type DTab = 'workspace' | 'projects' | 'practice' | 'gallery' | 'progress';

const MEDIUM_LABEL: Record<ArtMedium, [string, string]> = {
  sketch: ['رصاص / سكتش', 'Pencil / Sketch'],
  ink: ['حبر', 'Ink'],
  watercolor: ['ألوان مائية', 'Watercolour'],
  digital: ['رقمي', 'Digital'],
  acrylic: ['أكريليك', 'Acrylic'],
  mixed: ['وسائط مختلطة', 'Mixed media'],
  oil: ['زيتي', 'Oil']
};

const STAGE_LABEL: Record<ProjectStage, [string, string]> = {
  ideation: ['فكرة', 'Ideation'],
  sketching: ['تخطيط', 'Sketching'],
  inking: ['تحبير', 'Inking'],
  coloring: ['تلوين', 'Colouring'],
  polishing: ['لمسات أخيرة', 'Polishing'],
  completed: ['مكتمل', 'Completed'],
  archived: ['مؤرشف', 'Archived']
};

const PALETTE = ['#7c3aed', '#0f766e', '#b45309', '#be123c', '#1d4ed8', '#4d7c0f', '#a21caf', '#0e7490'];

const mediumLabel = (m: ArtMedium, isAr: boolean) => (isAr ? MEDIUM_LABEL[m][0] : MEDIUM_LABEL[m][1]);
const stageLabel = (s: ProjectStage, isAr: boolean) => (isAr ? STAGE_LABEL[s][0] : STAGE_LABEL[s][1]);

export const DrawingView: React.FC = () => {
  const {
    habits,
    createHabit,
    profile,
    logDrawingSession,
    deleteArtworkPiece,
    addOrUpdateArtProject,
    deleteArtProject,
    updateDrawingTargets,
    setActiveNavTab
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = localDateKey();

  const drawingHabit = habits.find((h) => h.specializedType === 'drawing');
  const drawingData = drawingHabit?.drawingData || {
    pieces: [],
    projects: [],
    weeklyTargetHours: 3,
    totalDrawingMinutes: 0,
    totalSketches: 0,
    favoriteMedium: 'sketch'
  };

  const pieces = drawingData.pieces || [];
  const projects = drawingData.projects || [];

  const [activeTab, setActiveTab] = useState<DTab>('workspace');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [galleryMedium, setGalleryMedium] = useState<'all' | ArtMedium>('all');

  // practice logger
  const [pieceTitle, setPieceTitle] = useState('');
  const [pieceMedium, setPieceMedium] = useState<ArtMedium>('sketch');
  const [pieceDuration, setPieceDuration] = useState(30);
  const [pieceProject, setPieceProject] = useState<string>('');
  const [pieceStage, setPieceStage] = useState<ProjectStage>('sketching');
  const [pieceNotes, setPieceNotes] = useState('');

  // project editor
  const [editingProject, setEditingProject] = useState<ArtProject | null>(null);
  const [isNewProject, setIsNewProject] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projMedium, setProjMedium] = useState<ArtMedium>('sketch');
  const [projStage, setProjStage] = useState<ProjectStage>('sketching');
  const [projColor, setProjColor] = useState(PALETTE[0]);
  const [projTags, setProjTags] = useState('');

  // targets
  const [targetHours, setTargetHours] = useState(drawingData.weeklyTargetHours || 3);
  const [targetsSaved, setTargetsSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleInitDrawingHabit = () =>
    createHabit({
      name: isAr ? 'اسكتش ورسم إبداعي يومي' : 'Daily Creative Sketch',
      anchor: isAr ? 'في المساء -> أرسم لمدة 20 دقيقة' : 'In the evening -> draw 20 min sketch',
      category: 'mind',
      timeOfDay: 'evening',
      specializedType: 'drawing'
    });

  const openNewProject = () => {
    setIsNewProject(true);
    setEditingProject(null);
    setProjTitle('');
    setProjDesc('');
    setProjMedium('sketch');
    setProjStage('sketching');
    setProjColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setProjTags('');
  };

  const openEditProject = (p: ArtProject) => {
    setIsNewProject(false);
    setEditingProject(p);
    setProjTitle(p.title);
    setProjDesc(p.description || '');
    setProjMedium(p.medium);
    setProjStage(p.stage);
    setProjColor(p.thumbnailColor || PALETTE[0]);
    setProjTags((p.tags || []).join(', '));
  };

  const saveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingHabit || !projTitle.trim()) return;
    addOrUpdateArtProject(drawingHabit.id, {
      id: editingProject?.id || 'proj-' + crypto.randomUUID().slice(0, 8),
      title: projTitle.trim(),
      description: projDesc.trim() || undefined,
      stage: projStage,
      medium: projMedium,
      startedDate: editingProject?.startedDate || todayStr,
      completedDate: projStage === 'completed' ? editingProject?.completedDate || todayStr : editingProject?.completedDate,
      thumbnailColor: projColor,
      totalMinutesSpent: editingProject?.totalMinutesSpent || 0,
      sessionsCount: editingProject?.sessionsCount || 0,
      tags: projTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    });
    setEditingProject(null);
    setIsNewProject(false);
    setToast(isAr ? 'تم حفظ المشروع.' : 'Project saved.');
    window.setTimeout(() => setToast(null), 2200);
  };

  const submitPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingHabit || !pieceTitle.trim()) return;
    const matched = projects.find((p) => p.id === pieceProject);
    logDrawingSession(drawingHabit.id, {
      title: pieceTitle.trim(),
      medium: pieceMedium,
      durationMinutes: Number(pieceDuration),
      projectId: pieceProject || undefined,
      projectTitle: matched?.title,
      stage: pieceStage,
      notes: pieceNotes.trim() || undefined
    });
    setPieceTitle('');
    setPieceNotes('');
    setToast(isAr ? 'تم تسجيل العمل.' : 'Practice logged.');
    window.setTimeout(() => setToast(null), 2200);
  };

  const saveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingHabit) return;
    updateDrawingTargets(drawingHabit.id, { weeklyTargetHours: Number(targetHours) });
    setTargetsSaved(true);
    window.setTimeout(() => setTargetsSaved(false), 2000);
  };

  const openProject = projects.find((p) => p.id === openProjectId) || null;
  const projectPieces = openProject ? pieces.filter((p) => p.projectId === openProject.id) : [];

  const weekBars = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysToKey(todayStr, -i);
      const mins = pieces.filter((p) => p.completedDate === key).reduce((a, p) => a + p.durationMinutes, 0);
      const d = parseDateKey(key);
      out.push({ label: d ? d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'narrow' }) : '', value: mins });
    }
    return out;
  }, [pieces, todayStr, isAr]);

  const totalMinutesToday = pieces.filter((p) => p.completedDate === todayStr).reduce((a, p) => a + p.durationMinutes, 0);
  const totalHours = Math.round((drawingData.totalDrawingMinutes || 0) / 60 * 10) / 10;
  const weekMinutes = weekBars.reduce((a, b) => a + b.value, 0);

  const mediumBreakdown = useMemo(() => {
    const dist: Record<string, number> = {};
    pieces.forEach((p) => {
      dist[p.medium] = (dist[p.medium] || 0) + p.durationMinutes;
    });
    return dist;
  }, [pieces]);

  const filteredGallery = pieces.filter((p) => galleryMedium === 'all' || p.medium === galleryMedium);

  if (!drawingHabit) {
    return (
      <div className="studio-root" data-studio="drawing" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="studio-head">
          <div className="min-w-0">
            <span className="studio-eyebrow">NUQTA / CREATIVE WORKSPACE</span>
            <h1 className="studio-title mt-1">{isAr ? 'مرسم الإبداع' : 'Creative Workspace'}</h1>
            <p className="studio-lede mt-1">
              {isAr ? 'مشاريع فنية، جلسات تدريب، ومعرض أعمال.' : 'Art projects, practice sessions, and a gallery.'}
            </p>
          </div>
        </header>
        <StudioSection>
          <StudioEmpty
            icon="brush"
            title={isAr ? 'ابدأ مرسمك الإبداعي' : 'Initialize your creative workspace'}
            description={isAr ? 'وثّق مشاريعك، سجّل جلسات التدريب، واعرض أعمالك.' : 'Track projects, log practice, and showcase your work.'}
            action={
              <Button variant="primary" onClick={handleInitDrawingHabit}>
                {isAr ? 'تفعيل مرسم الفن' : 'Enable Drawing Studio'}
              </Button>
            }
          />
        </StudioSection>
      </div>
    );
  }

  const tabs: StudioTab[] = [
    { id: 'workspace', label: isAr ? 'المرسم' : 'Workspace', icon: 'grid' },
    { id: 'projects', label: isAr ? 'المشاريع' : 'Projects', icon: 'layers', count: projects.filter((p) => p.stage !== 'completed' && p.stage !== 'archived').length },
    { id: 'practice', label: isAr ? 'التدريب' : 'Practice', icon: 'brush' },
    { id: 'gallery', label: isAr ? 'المعرض' : 'Gallery', icon: 'image', count: pieces.length },
    { id: 'progress', label: isAr ? 'التقدم' : 'Progress', icon: 'chart' }
  ];

  return (
    <StudioFrame
      studio="drawing"
      eyebrow="NUQTA / CREATIVE WORKSPACE"
      title={isAr ? 'مرسم الإبداع' : 'Creative Workspace'}
      description={
        isAr
          ? 'مساحة للمشاريع الإبداعية، جلسات التدريب، ومعرض الأعمال.'
          : 'A workspace for creative projects, practice sessions, and finished work.'
      }
      actions={
        <>
          <Button variant="primary" size="sm" icon="plus" onClick={openNewProject}>
            {isAr ? 'مشروع' : 'Project'}
          </Button>
          <Button variant="secondary" size="sm" icon="brush" onClick={() => setActiveTab('practice')}>
            {isAr ? 'تسجيل تدريب' : 'Log practice'}
          </Button>
          <Button variant="ghost" size="sm" icon="archive" onClick={() => setActiveNavTab('archive')}>
            {isAr ? 'الأرشيف' : 'Archive'}
          </Button>
        </>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setOpenProjectId(null);
        setActiveTab(id as DTab);
      }}
      navVariant="workspace"
      context={
        <span className="text-[var(--fs-micro)] font-mono text-[var(--text-secondary)]">
          {totalHours}h
        </span>
      }
    >
      {/* ============================ WORKSPACE ============================ */}
      {activeTab === 'workspace' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-4">
            <StudioStat label={isAr ? 'الأعمال' : 'Artworks'} value={pieces.length} icon="image" tone="accent" />
            <StudioStat label={isAr ? 'المشاريع الجارية' : 'Active projects'} value={projects.filter((p) => p.stage !== 'completed' && p.stage !== 'archived').length} icon="layers" />
            <StudioStat label={isAr ? 'ساعات التدفق' : 'Flow hours'} value={`${totalHours}h`} hint={`/ ${drawingData.weeklyTargetHours || 3}h ${isAr ? 'أسبوعياً' : 'weekly'}`} />
            <StudioStat label={isAr ? 'تدفق اليوم' : 'Today'} value={`${totalMinutesToday}m`} />
          </div>

          {/* continue working */}
          <StudioSection title={isAr ? 'متابعة العمل' : 'Continue working'}>
            {projects.filter((p) => p.stage !== 'completed' && p.stage !== 'archived').length === 0 ? (
              <StudioEmpty
                icon="brush"
                title={isAr ? 'لا مشاريع جارية' : 'No active projects'}
                description={isAr ? 'ابدأ مشروعاً جديداً أو سجّل جلسة تدريب حرة.' : 'Start a new project or log a free practice session.'}
                action={
                  <Button variant="primary" size="sm" icon="plus" onClick={openNewProject}>
                    {isAr ? 'مشروع جديد' : 'New project'}
                  </Button>
                }
              />
            ) : (
              <div className="art-grid">
                {projects
                  .filter((p) => p.stage !== 'completed' && p.stage !== 'archived')
                  .slice(0, 4)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="art-tile"
                      style={{ background: `linear-gradient(140deg, ${p.thumbnailColor || PALETTE[0]}, color-mix(in srgb, ${p.thumbnailColor || PALETTE[0]} 55%, #000))` }}
                      onClick={() => {
                        setOpenProjectId(p.id);
                        setActiveTab('projects');
                      }}
                    >
                      <span className="art-stage-chip">{stageLabel(p.stage, isAr)}</span>
                      <span className="art-tile-caption">
                        <span className="block font-[var(--fw-semibold)] text-[var(--fs-sm)] truncate">{p.title}</span>
                        <span className="block text-[var(--fs-micro)] opacity-90 font-mono">
                          {mediumLabel(p.medium, isAr)} · {p.totalMinutesSpent || 0}m
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </StudioSection>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-3">
            <StudioSection title={isAr ? 'نشاط الأسبوع' : 'This week'}>
              <StudioBars data={weekBars} unit={isAr ? 'دقيقة' : 'min'} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <StudioStat label={isAr ? 'دقائق الأسبوع' : 'Week minutes'} value={weekMinutes} tone="accent" />
                <StudioStat label={isAr ? 'جلسات الأسبوع' : 'Week sessions'} value={pieces.filter((p) => p.completedDate >= addDaysToKey(todayStr, -6)).length} />
              </div>
            </StudioSection>

            <StudioSection className="lg:col-span-2" title={isAr ? 'آخر الأعمال' : 'Recent work'}
              action={<Button variant="ghost" size="sm" onClick={() => setActiveTab('gallery')}>{isAr ? 'المعرض' : 'Gallery'}</Button>}>
              {pieces.length === 0 ? (
                <StudioEmpty icon="image" title={isAr ? 'لا أعمال بعد' : 'No work yet'} />
              ) : (
                <div className="art-grid">
                  {pieces.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="art-tile"
                      style={{ background: `linear-gradient(140deg, ${PALETTE[2]}, color-mix(in srgb, ${PALETTE[2]} 55%, #000))` }}
                    >
                      <span className="art-stage-chip">{mediumLabel(p.medium, isAr)}</span>
                      <span className="art-tile-caption">
                        <span className="block font-[var(--fw-semibold)] text-[var(--fs-sm)] truncate">{p.title}</span>
                        <span className="block text-[var(--fs-micro)] opacity-90 font-mono">
                          {p.completedDate} · {p.durationMinutes}m
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </StudioSection>
          </div>
        </div>
      )}

      {/* ============================ PROJECTS ============================ */}
      {activeTab === 'projects' && !openProject && (
        <div className="space-y-[var(--sp-4)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
              {projects.length} {isAr ? 'مشروع' : 'projects'}
            </span>
            <Button variant="primary" size="sm" icon="plus" onClick={openNewProject}>
              {isAr ? 'مشروع جديد' : 'New project'}
            </Button>
          </div>

          {projects.length === 0 ? (
            <StudioSection>
              <StudioEmpty
                icon="layers"
                title={isAr ? 'لا مشاريع بعد' : 'No projects yet'}
                description={isAr ? 'أنشئ مشروعاً لتجميع أعمالك حوله.' : 'Create a project to group your work.'}
                action={
                  <Button variant="primary" size="sm" icon="plus" onClick={openNewProject}>
                    {isAr ? 'إنشاء مشروع' : 'Create project'}
                  </Button>
                }
              />
            </StudioSection>
          ) : (
            <div className="grid gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div key={p.id} className="studio-tile flex flex-col gap-2">
                  <button type="button" className="text-start" onClick={() => setOpenProjectId(p.id)}>
                    <span
                      className="block h-24 rounded-[var(--r-sm)] mb-2"
                      style={{ background: `linear-gradient(140deg, ${p.thumbnailColor || PALETTE[0]}, color-mix(in srgb, ${p.thumbnailColor || PALETTE[0]} 55%, #000))` }}
                      aria-hidden="true"
                    />
                    <span className="block text-[var(--fs-sm)] font-[var(--fw-semibold)] text-[var(--text-primary)] truncate">{p.title}</span>
                    <span className="block text-[var(--fs-micro)] text-[var(--text-secondary)] font-mono">
                      {stageLabel(p.stage, isAr)} · {mediumLabel(p.medium, isAr)}
                    </span>
                  </button>
                  {p.description && <p className="text-[var(--fs-xs)] text-[var(--text-secondary)] line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between text-[var(--fs-micro)] text-[var(--text-tertiary)] font-mono mt-auto pt-2 border-t border-[var(--studio-line)]">
                    <span>{p.sessionsCount || 0} {isAr ? 'جلسات' : 'sessions'} · {p.totalMinutesSpent || 0}m</span>
                    <span>{p.startedDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================ PROJECT DETAILS ============================ */}
      {activeTab === 'projects' && openProject && (
        <div className="space-y-[var(--sp-4)]">
          <Button variant="ghost" size="sm" icon="arrow" onClick={() => setOpenProjectId(null)}>
            {isAr ? 'كل المشاريع' : 'All projects'}
          </Button>

          <StudioSection
            title={openProject.title}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon="edit" onClick={() => openEditProject(openProject)}>
                  {isAr ? 'تعديل' : 'Edit'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="brush"
                  onClick={() => {
                    setPieceProject(openProject.id);
                    setActiveTab('practice');
                  }}
                >
                  {isAr ? 'تسجيل جلسة' : 'Log session'}
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StudioStat label={isAr ? 'المرحلة' : 'Stage'} value={stageLabel(openProject.stage, isAr)} tone="accent" />
              <StudioStat label={isAr ? 'الوسيط' : 'Medium'} value={mediumLabel(openProject.medium, isAr)} />
              <StudioStat label={isAr ? 'وقت العمل' : 'Time spent'} value={`${openProject.totalMinutesSpent || 0}m`} />
              <StudioStat label={isAr ? 'الجلسات' : 'Sessions'} value={openProject.sessionsCount || 0} />
            </div>
            {openProject.description && (
              <p className="text-[var(--fs-sm)] text-[var(--text-secondary)] leading-relaxed mt-3">{openProject.description}</p>
            )}
            {openProject.tags && openProject.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {openProject.tags.map((t) => (
                  <span key={t} className="px-2 h-5 inline-flex items-center rounded-[var(--r-full)] border border-[var(--studio-line)] text-[var(--fs-micro)] text-[var(--text-secondary)]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </StudioSection>

          <StudioSection title={isAr ? 'أعمال هذا المشروع' : 'Work in this project'}>
            {projectPieces.length === 0 ? (
              <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">
                {isAr ? 'لا جلسات مرتبطة بعد.' : 'No linked sessions yet.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {projectPieces.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-[var(--fs-xs)] border-b border-[var(--studio-line)] last:border-0 pb-2 last:pb-0">
                    <span className="min-w-0">
                      <span className="block text-[var(--text-primary)] font-[var(--fw-semibold)] truncate">{p.title}</span>
                      <span className="block text-[var(--text-secondary)] font-mono">
                        {p.completedDate} · {p.durationMinutes}m · {mediumLabel(p.medium, isAr)}
                      </span>
                    </span>
                    <span className="text-[var(--fs-micro)] text-[var(--text-tertiary)]">{stageLabel(p.stage || 'sketching', isAr)}</span>
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>

          <div className="flex justify-end">
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              onClick={() => {
                if (confirm(isAr ? 'حذف هذا المشروع؟ ستصبح أعماله مستقلة.' : 'Delete this project? Its pieces become standalone.')) {
                  deleteArtProject(drawingHabit.id, openProject.id);
                  setOpenProjectId(null);
                }
              }}
            >
              {isAr ? 'حذف المشروع' : 'Delete project'}
            </Button>
          </div>
        </div>
      )}

      {/* ============================ PRACTICE ============================ */}
      {activeTab === 'practice' && (
        <div className="space-y-[var(--sp-4)]">
          <StudioSection title={isAr ? 'تسجيل جلسة تدريب' : 'Log a practice session'}>
            <form onSubmit={submitPiece} className="grid gap-3 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'عنوان العمل أو السكتش' : 'Title'}</span>
                <input value={pieceTitle} onChange={(e) => setPieceTitle(e.target.value)} className="input w-full text-[var(--fs-xs)]" placeholder={isAr ? 'دراسة إضاءة، منظور معماري…' : 'e.g. Anatomy study, landscape sketch'} required />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'الوسيط' : 'Medium'}</span>
                <select className="select w-full text-[var(--fs-xs)]" value={pieceMedium} onChange={(e) => setPieceMedium(e.target.value as ArtMedium)}>
                  {(Object.keys(MEDIUM_LABEL) as ArtMedium[]).map((m) => (
                    <option key={m} value={m}>
                      {mediumLabel(m, isAr)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'المدة (دقائق)' : 'Minutes'}</span>
                <input type="number" min={1} value={pieceDuration} onChange={(e) => setPieceDuration(Number(e.target.value))} className="input w-full font-mono tabular-nums" required />
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'المشروع المرتبط' : 'Linked project'}</span>
                <select className="select w-full text-[var(--fs-xs)]" value={pieceProject} onChange={(e) => setPieceProject(e.target.value)}>
                  <option value="">{isAr ? 'عمل حر مستقل' : 'Standalone piece'}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'المرحلة' : 'Stage'}</span>
                <select className="select w-full text-[var(--fs-xs)]" value={pieceStage} onChange={(e) => setPieceStage(e.target.value as ProjectStage)}>
                  {(['ideation', 'sketching', 'inking', 'coloring', 'polishing', 'completed'] as ProjectStage[]).map((s) => (
                    <option key={s} value={s}>
                      {stageLabel(s, isAr)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field sm:col-span-2">
                <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'ملاحظات وتقنيات' : 'Notes / techniques'}</span>
                <textarea value={pieceNotes} onChange={(e) => setPieceNotes(e.target.value)} rows={2} className="textarea w-full text-[var(--fs-xs)]" />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <Button variant="primary" size="sm" type="submit" icon="check">
                  {isAr ? 'حفظ العمل' : 'Save piece'}
                </Button>
              </div>
            </form>
          </StudioSection>

          <StudioSection title={isAr ? 'جلسات التدريب الأخيرة' : 'Recent practice'}>
            {pieces.length === 0 ? (
              <StudioEmpty icon="brush" title={isAr ? 'لا جلسات بعد' : 'No sessions yet'} />
            ) : (
              <ul className="space-y-2">
                {pieces.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-[var(--fs-xs)] border-b border-[var(--studio-line)] last:border-0 pb-2 last:pb-0">
                    <span className="min-w-0">
                      <span className="block text-[var(--text-primary)] font-[var(--fw-semibold)] truncate">{p.title}</span>
                      <span className="block text-[var(--text-secondary)] font-mono">
                        {p.completedDate} · {p.durationMinutes}m · {mediumLabel(p.medium, isAr)}
                        {p.projectTitle ? ` · ${p.projectTitle}` : ''}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      aria-label={isAr ? 'حذف العمل' : 'Delete piece'}
                      onClick={() => {
                        if (confirm(isAr ? 'حذف هذا العمل؟' : 'Delete this piece?')) deleteArtworkPiece(drawingHabit.id, p.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </StudioSection>
        </div>
      )}

      {/* ============================ GALLERY ============================ */}
      {activeTab === 'gallery' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', ...(Object.keys(MEDIUM_LABEL) as ArtMedium[])] as ('all' | ArtMedium)[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={galleryMedium === m}
                onClick={() => setGalleryMedium(m)}
                className="px-3 h-8 rounded-[var(--r-full)] border text-[var(--fs-xs)] transition-colors"
                style={
                  galleryMedium === m
                    ? { borderColor: 'var(--studio-accent-line)', background: 'var(--studio-accent-soft)', color: 'var(--studio-accent-ink)' }
                    : { borderColor: 'var(--studio-line)', color: 'var(--text-secondary)' }
                }
              >
                {m === 'all' ? (isAr ? 'الكل' : 'All') : mediumLabel(m, isAr)}
              </button>
            ))}
          </div>

          {filteredGallery.length === 0 ? (
            <StudioSection>
              <StudioEmpty
                icon="image"
                title={isAr ? 'المعرض فارغ' : 'Gallery is empty'}
                description={isAr ? 'سجّل عملاً ليظهر في المعرض.' : 'Log a piece to see it in the gallery.'}
                action={
                  <Button variant="primary" size="sm" icon="brush" onClick={() => setActiveTab('practice')}>
                    {isAr ? 'تسجيل عمل' : 'Log a piece'}
                  </Button>
                }
              />
            </StudioSection>
          ) : (
            <div className="art-grid">
              {filteredGallery.map((p, i) => {
                const color = PALETTE[i % PALETTE.length];
                return (
                  <figure
                    key={p.id}
                    className="art-tile"
                    style={{ background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
                  >
                    <span className="art-stage-chip">{mediumLabel(p.medium, isAr)}</span>
                    <figcaption className="art-tile-caption">
                      <span className="block font-[var(--fw-semibold)] text-[var(--fs-sm)] truncate">{p.title}</span>
                      <span className="block text-[var(--fs-micro)] opacity-90 font-mono">
                        {p.completedDate} · {p.durationMinutes}m
                        {p.projectTitle ? ` · ${p.projectTitle}` : ''}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================ PROGRESS ============================ */}
      {activeTab === 'progress' && (
        <div className="space-y-[var(--sp-4)]">
          <div className="grid gap-[var(--sp-4)] sm:grid-cols-2 lg:grid-cols-4">
            <StudioStat label={isAr ? 'إجمالي الساعات' : 'Total hours'} value={`${totalHours}h`} icon="clock" tone="accent" />
            <StudioStat label={isAr ? 'الأعمال' : 'Pieces'} value={pieces.length} />
            <StudioStat label={isAr ? 'المشاريع' : 'Projects'} value={projects.length} />
            <StudioStat label={isAr ? 'الوسيط المفضل' : 'Favourite medium'} value={mediumLabel((drawingData.favoriteMedium as ArtMedium) || 'sketch', isAr)} />
          </div>

          <StudioSection title={isAr ? 'التدفق هذا الأسبوع' : 'Flow this week'}>
            <StudioBars data={weekBars} unit={isAr ? 'دقيقة' : 'min'} />
          </StudioSection>

          <div className="grid gap-[var(--sp-4)] lg:grid-cols-2">
            <StudioSection title={isAr ? 'الوقت حسب الوسيط' : 'Time by medium'}>
              {Object.keys(mediumBreakdown).length === 0 ? (
                <p className="text-[var(--fs-xs)] text-[var(--text-secondary)]">{isAr ? 'لا بيانات بعد.' : 'No data yet.'}</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(mediumBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([m, mins]) => {
                      const max = Math.max(...Object.values(mediumBreakdown));
                      return (
                        <li key={m} className="text-[var(--fs-xs)]">
                          <div className="flex justify-between mb-1">
                            <span className="text-[var(--text-primary)]">{mediumLabel(m as ArtMedium, isAr)}</span>
                            <span className="font-mono text-[var(--text-secondary)]">{mins}m</span>
                          </div>
                          <div className="h-1.5 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden">
                            <div className="h-full rounded-[var(--r-full)]" style={{ width: `${(mins / max) * 100}%`, background: 'var(--studio-accent)' }} />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </StudioSection>

            <StudioSection title={isAr ? 'هدف التدفق الأسبوعي' : 'Weekly flow target'}>
              <form onSubmit={saveTargets} className="flex items-end gap-3">
                <label className="field flex-1">
                  <span className="text-[var(--fs-xs)] text-[var(--text-secondary)] block mb-1">{isAr ? 'ساعات أسبوعية' : 'Hours / week'}</span>
                  <input type="number" min={1} max={40} value={targetHours} onChange={(e) => setTargetHours(Number(e.target.value))} className="input w-full font-mono tabular-nums" />
                </label>
                <Button variant="secondary" size="sm" type="submit">
                  {isAr ? 'حفظ' : 'Save'}
                </Button>
              </form>
              <div className="mt-3">
                <div className="flex justify-between text-[var(--fs-micro)] text-[var(--text-secondary)] mb-1">
                  <span>{isAr ? 'هذا الأسبوع' : 'This week'}</span>
                  <span className="font-mono">
                    {(weekMinutes / 60).toFixed(1)} / {targetHours}h
                  </span>
                </div>
                <div className="h-1.5 rounded-[var(--r-full)] bg-[var(--surface-track)] overflow-hidden">
                  <div
                    className="h-full rounded-[var(--r-full)]"
                    style={{ width: `${Math.min(100, (weekMinutes / 60 / Math.max(1, targetHours)) * 100)}%`, background: 'var(--studio-accent)' }}
                  />
                </div>
              </div>
              {targetsSaved && (
                <p role="status" className="text-[var(--fs-xs)] text-[var(--state-success)] mt-2">
                  {isAr ? 'تم الحفظ.' : 'Saved.'}
                </p>
              )}
            </StudioSection>
          </div>
        </div>
      )}

      {/* project editor modal */}
      <Modal
        open={isNewProject || !!editingProject}
        onClose={() => {
          setIsNewProject(false);
          setEditingProject(null);
        }}
        title={isNewProject ? (isAr ? 'مشروع جديد' : 'New project') : isAr ? 'تعديل المشروع' : 'Edit project'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsNewProject(false); setEditingProject(null); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={(e) => saveProject(e as never)}>
              {isAr ? 'حفظ' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={saveProject} className="space-y-3">
          <Field label={isAr ? 'عنوان المشروع' : 'Title'} htmlFor="pr-title" required>
            <Input id="pr-title" value={projTitle} onChange={(e) => setProjTitle(e.target.value)} autoFocus />
          </Field>
          <Field label={isAr ? 'الوصف' : 'Description'} htmlFor="pr-desc">
            <Textarea id="pr-desc" rows={2} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isAr ? 'الوسيط' : 'Medium'} htmlFor="pr-medium">
              <Select id="pr-medium" value={projMedium} onChange={(e) => setProjMedium(e.target.value as ArtMedium)}>
                {(Object.keys(MEDIUM_LABEL) as ArtMedium[]).map((m) => (
                  <option key={m} value={m}>
                    {mediumLabel(m, isAr)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={isAr ? 'المرحلة' : 'Stage'} htmlFor="pr-stage">
              <Select id="pr-stage" value={projStage} onChange={(e) => setProjStage(e.target.value as ProjectStage)}>
                {(['ideation', 'sketching', 'inking', 'coloring', 'polishing', 'completed', 'archived'] as ProjectStage[]).map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s, isAr)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={isAr ? 'لون المشروع' : 'Project colour'} htmlFor="pr-color">
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={projColor === c}
                  onClick={() => setProjColor(c)}
                  className="w-8 h-8 rounded-[var(--r-sm)] border-2"
                  style={{ background: c, borderColor: projColor === c ? 'var(--text-primary)' : 'transparent' }}
                />
              ))}
            </div>
          </Field>
          <Field label={isAr ? 'وسوم (مفصولة بفاصلة)' : 'Tags (comma separated)'} htmlFor="pr-tags">
            <Input id="pr-tags" value={projTags} onChange={(e) => setProjTags(e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Toast open={!!toast} message={toast || ''} tone="success" onClose={() => setToast(null)} />
    </StudioFrame>
  );
};

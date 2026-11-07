import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { ArtMedium, ArtProject, ProjectStage } from '../types';
import { NuqtaIcon } from './NuqtaIcon';
import { TabBar } from './ui';

const STUDIO_TABS = [
  { id: 'dashboard', ar: 'لوحة المرسم', en: 'Studio Dashboard' },
  { id: 'session', ar: 'تسجيل عمل جديد', en: 'Log Artwork' },
  { id: 'projects', ar: 'مشاريع المرسم', en: 'Projects Vault' },
  { id: 'gallery', ar: 'معرض الأعمال', en: 'Gallery' },
  { id: 'targets', ar: 'أهداف التدفق', en: 'Creative Targets' }
];

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
  const todayStr = new Date().toISOString().split('T')[0];

  const drawingHabit = habits.find((h) => h.specializedType === 'drawing');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'projects' | 'gallery' | 'targets'>('dashboard');

  const drawingData = drawingHabit?.drawingData || {
    pieces: [],
    projects: [],
    weeklyTargetHours: 3,
    totalDrawingMinutes: 0,
    totalSketches: 0,
    favoriteMedium: 'sketch'
  };

  // Session Logger State
  const [pieceTitle, setPieceTitle] = useState('');
  const [pieceMedium, setPieceMedium] = useState<ArtMedium>('sketch');
  const [pieceDuration, setPieceDuration] = useState(30);
  const [pieceProject, setPieceProject] = useState<string>('');
  const [pieceStage, setPieceStage] = useState<ProjectStage>('sketching');
  const [pieceNotes, setPieceNotes] = useState('');
  const [showLogSuccess, setShowLogSuccess] = useState(false);

  // Project modal state
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projMedium, setProjMedium] = useState<ArtMedium>('sketch');
  const [projColor, setProjColor] = useState('#7c3aed');

  // Targets state
  const [targetHours, setTargetHours] = useState(drawingData.weeklyTargetHours || 3);
  const [targetsSaved, setTargetsSaved] = useState(false);

  const handleInitDrawingHabit = () => {
    createHabit({
      name: isAr ? 'اسكتش ورسم إبداعي يومي' : 'Daily Creative Sketch',
      anchor: isAr ? 'في المساء -> أرسم لمدة 20 دقيقة' : 'In the evening -> draw 20 min sketch',
      category: 'mind',
      timeOfDay: 'evening',
      specializedType: 'drawing'
    });
  };

  const handleSubmitPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingHabit || !pieceTitle.trim()) return;

    const matchedProject = drawingData.projects?.find((p) => p.id === pieceProject);

    logDrawingSession(drawingHabit.id, {
      title: pieceTitle.trim(),
      medium: pieceMedium,
      durationMinutes: Number(pieceDuration),
      projectId: pieceProject || undefined,
      projectTitle: matchedProject?.title,
      stage: pieceStage,
      notes: pieceNotes.trim() || undefined
    });

    setShowLogSuccess(true);
    setPieceTitle('');
    setPieceNotes('');
    setTimeout(() => {
      setShowLogSuccess(false);
      setActiveTab('dashboard');
    }, 1800);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingHabit || !projTitle.trim()) return;

    addOrUpdateArtProject(drawingHabit.id, {
      id: 'proj-' + crypto.randomUUID().slice(0, 8),
      title: projTitle.trim(),
      description: projDesc.trim() || undefined,
      stage: 'sketching',
      medium: projMedium,
      startedDate: todayStr,
      thumbnailColor: projColor,
      totalMinutesSpent: 0,
      sessionsCount: 0,
      tags: ['Creative']
    });

    setProjTitle('');
    setProjDesc('');
    setIsAddingProject(false);
  };

  if (!drawingHabit) {
    return (
      <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="page-heading">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="line"></span>
              <span className="font-mono text-[var(--d-drawing-accent)]">NUQTA / CREATIVE ART STUDIO</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
              {isAr ? 'مرسم الإبداع والفن' : 'Creative Art Studio'}
            </h1>
            <p className="text-sm text-muted">
              {isAr ? 'مساحة التدفق البصري، تتبع ساعات الرسم، وإدارة المشاريع الفنية والمعرض.' : 'Creative flow sanctuary, sketches archive, and art projects.'}
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl border border-purple-500/30 bg-[var(--d-drawing-raised)] text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-[var(--d-drawing-accent)] flex items-center justify-center text-3xl mx-auto border border-purple-500/30">
            🎨
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'ابدأ مرسمك الإبداعي اليومي' : 'Initialize Creative Art Studio'}
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            {isAr
              ? 'وثق لوحاتك، واسكتشاتك السريعة، وساعات التدفق في الرسم بانتظام دون تشتت.'
              : 'Autonomous art workspace tracking sketch iterations, projects, and flow state.'}
          </p>
          <button
            onClick={handleInitDrawingHabit}
            className="btn primary px-6 py-2.5 text-sm font-bold shadow-lg"
          >
            <span>+</span>
            <span>{isAr ? 'تفعيل مرسم الفن الآن' : 'Enable Art Studio'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 1. Page Heading */}
      <div className="page-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="line"></span>
            <span className="font-mono text-[var(--d-drawing-accent)]">NUQTA / CREATIVE ART STUDIO</span>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)]">
            {isAr ? 'مرسم الإبداع والفن' : 'Creative Art Studio'}
          </h1>
          <p className="text-xs md:text-sm text-muted">
            {isAr
              ? 'مساحة التدفق البصري، توثيق الاسكتشات واللوحات، وتتبع مشاريع المرسم الجارية.'
              : 'Visual flow container tracking daily sketches, projects, and drawing hours.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('session')}
            className="btn primary small text-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isAr ? 'تسجيل عمل جديد' : 'Log Artwork'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('archive')}
            className="btn subtle small text-xs flex items-center gap-1.5"
            title={isAr ? 'فتح أرشيف وسجل المرسم والأعمال الفنية' : 'Open Art Archive & History'}
          >
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>
          <button
            onClick={() => setActiveNavTab('habits')}
            className="btn subtle small text-xs"
          >
            <span>{isAr ? 'كل العادات' : 'All Habits'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Artworks */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-[var(--d-drawing-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الأعمال والاسكتشات' : 'Artworks & Sketches'}</span>
            <span className="text-[var(--d-drawing-accent)] text-xs">🎨</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--d-drawing-accent)]">
              {drawingData.pieces.length || drawingData.totalSketches || 0}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'عمل' : 'pieces'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'معرض الأعمال المكتملة' : 'Completed gallery'}
          </span>
        </div>

        {/* Active Projects */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-[var(--d-drawing-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'المشاريع الجارية' : 'Active Projects'}</span>
            <span className="text-blue-400 text-xs">📁</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {(drawingData.projects || []).length}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'مشاريع' : 'projects'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'خطوات إنتاج مستمرة' : 'In pipeline'}
          </span>
        </div>

        {/* Total Flow Hours */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-[var(--d-drawing-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'ساعات التدفق' : 'Flow Hours'}</span>
            <span className="text-[var(--state-warning)] text-xs">⌛</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-[var(--state-warning-strong)]">
              {Math.round((drawingData.totalDrawingMinutes || 0) / 60)}h
            </strong>
            <span className="text-xs text-muted">{(drawingData.totalDrawingMinutes || 0) % 60}m</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'الهدف الأسبوعي:' : 'Target:'} {drawingData.weeklyTargetHours || 3}h {isAr ? 'أسبوعياً' : '/wk'}
          </span>
        </div>

        {/* Streak */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-[var(--d-drawing-surface)] space-y-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الانتظام في الرسم' : 'Current Streak'}</span>
            <span className="text-accent text-xs">♨</span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-xl font-bold font-mono text-accent">
              {drawingHabit.currentStreak || 0}
            </strong>
            <span className="text-xs text-muted">{isAr ? 'أيام' : 'days'}</span>
          </div>
          <span className="text-[10px] text-muted block">
            {isAr ? 'أطول سلسلة:' : 'Best:'} {drawingHabit.longestStreak || 0} {isAr ? 'يوم' : 'd'}
          </span>
        </div>

        {/* Favorite Medium */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-[var(--d-drawing-surface)] space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-muted block flex items-center justify-between">
            <span>{isAr ? 'الوسيط المفضل' : 'Favorite Medium'}</span>
            <span className="text-[var(--d-drawing-accent)] text-xs">✏️</span>
          </span>
          <strong className="text-xs font-bold text-[var(--text-primary)] block capitalize truncate">
            {drawingData.favoriteMedium || 'Pencil / Sketch'}
          </strong>
          <span className="text-[10px] text-muted block">
            {isAr ? 'الرسم والتدريب اليدوي' : 'Traditional / Digital'}
          </span>
        </div>
      </div>

      {/* 3. Studio Navigation Tabs */}
            <TabBar
        items={STUDIO_TABS.map((t) => ({ id: t.id, label: isAr ? t.ar : t.en }))}
        value={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* =========================================================================
          TAB 1: DASHBOARD
         ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Flow Launcher */}
            <div className="p-5 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[var(--d-drawing-chip)] via-[var(--d-drawing-surface)] to-[var(--d-drawing-chip)] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-purple-500/20 text-[var(--d-drawing-accent)] flex items-center justify-center font-bold text-lg border border-purple-500/30">
                    🎨
                  </span>
                  <div>
                    <span className="text-[10px] font-mono tracking-wider text-[var(--d-drawing-accent)] uppercase block">
                      {isAr ? 'جلسة التدفق الإبداعي' : 'CREATIVE FLOW SESSION'}
                    </span>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {isAr ? 'سكتشات سريعة وتدريب يدوي (20 دقيقة)' : 'Daily Quick Sketch & Studies'}
                    </h2>
                    <span className="text-xs text-muted block mt-0.5">
                      {isAr ? 'تحرير العقل، تدريب العين على النسب والظلال، دون سعي للكمال.' : 'Freehand flow without perfectionism.'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('session')}
                  className="btn primary small text-xs flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]"
                >
                  <span>▶</span>
                  <span>{isAr ? 'تسجيل عمل' : 'Log Artwork'}</span>
                </button>
              </div>
            </div>

            {/* Recent Artworks */}
            <div className="p-5 rounded-2xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-drawing-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>🖼️</span>
                  <span>{isAr ? 'الأعمال والاسكتشات الأخيرة' : 'Recent Artworks'}</span>
                </h3>
                <button onClick={() => setActiveTab('gallery')} className="text-link text-xs">
                  <span>{isAr ? 'كل المعرض' : 'View gallery'}</span>
                  <span>→</span>
                </button>
              </div>

              {drawingData.pieces.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted border border-dashed border-[var(--d-drawing-border)] rounded-xl">
                  {isAr ? 'لا توجد أعمال مسجلة بعد. ابدأ بأول سكتش اليوم!' : 'No artworks logged yet.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {drawingData.pieces.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-raised)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-[var(--text-primary)] block truncate">{p.title}</strong>
                        <span className="text-[11px] text-muted flex items-center gap-2 mt-0.5 font-mono">
                          <span>{p.completedDate}</span>
                          <span>· {p.durationMinutes}m</span>
                          <span>· {p.medium}</span>
                          {p.projectTitle ? <span>· {p.projectTitle}</span> : null}
                        </span>
                        {p.notes && <p className="text-[11px] text-muted/80 mt-1 italic">"{p.notes}"</p>}
                      </div>
                      <span className="text-[var(--d-drawing-accent)] font-mono text-xs font-bold">
                        {p.durationMinutes}m {isAr ? 'تدفق' : 'flow'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Projects list */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-surface)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--d-drawing-border-soft)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>📁</span>
                  <span>{isAr ? 'مشاريع المرسم' : 'Projects in Pipeline'}</span>
                </h3>
                <button onClick={() => setActiveTab('projects')} className="text-link text-xs">
                  <span>{isAr ? 'إدارة المشاريع' : 'Manage'}</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-2">
                {(drawingData.projects || []).slice(0, 3).map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-raised)] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--text-primary)] truncate block">{proj.title}</strong>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-[var(--d-drawing-accent-strong)]">
                        {proj.medium}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted block">
                      {proj.sessionsCount || 0} {isAr ? 'جلسات' : 'sessions'} · {proj.totalMinutesSpent || 0}m {isAr ? 'تدفق' : 'spent'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LOG ARTWORK
         ========================================================================= */}
      {activeTab === 'session' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-purple-500/30 bg-[var(--d-drawing-surface)] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--d-drawing-border)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>🎨</span>
                <span>{isAr ? 'توثيق عمل فني / سكتش جديد' : 'Log Artwork / Sketch'}</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isAr ? 'احفظ تفاصيل سكتشك أو عملك الفني مع ربطه التلقائي بساعات التدفق.' : 'Record your piece, medium, and flow minutes.'}
              </p>
            </div>
            <button onClick={() => setActiveTab('dashboard')} className="text-muted hover:text-[var(--text-primary)] text-sm">
              ✕
            </button>
          </div>

          {showLogSuccess && (
            <div className="p-3 rounded-xl border border-purple-500/30 bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-strong)] text-xs">
              {isAr ? 'تم حفظ العمل الفني وتحديث سجل التدفق بنجاح!' : 'Artwork recorded successfully!'}
            </div>
          )}

          <form onSubmit={handleSubmitPiece} className="space-y-4">
            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'عنوان العمل أو السكتش:' : 'Artwork Title:'}</label>
              <input
                type="text"
                value={pieceTitle}
                onChange={(e) => setPieceTitle(e.target.value)}
                placeholder={isAr ? 'مثال: دراسة إضاءة وظلال، منظور معماري...' : 'e.g. Anatomy study, landscape sketch'}
                className="input w-full text-xs font-semibold"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'الوسيط الفني:' : 'Medium:'}</label>
                <select
                  className="select w-full text-xs"
                  value={pieceMedium}
                  onChange={(e) => setPieceMedium(e.target.value as ArtMedium)}
                >
                  <option value="sketch">{isAr ? 'رصاص وسكتش (Pencil)' : 'Pencil / Sketch'}</option>
                  <option value="ink">{isAr ? 'حبر وتحبير (Ink)' : 'Ink'}</option>
                  <option value="watercolor">{isAr ? 'ألوان مائية (Watercolor)' : 'Watercolor'}</option>
                  <option value="digital">{isAr ? 'رسم رقمي (Digital)' : 'Digital'}</option>
                  <option value="oil">{isAr ? 'ألوان زيتية (Oil)' : 'Oil'}</option>
                  <option value="mixed">{isAr ? 'وسائط مختلطة (Mixed)' : 'Mixed Media'}</option>
                </select>
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مدة الجلسة (دقائق):' : 'Duration (mins):'}</label>
                <input
                  type="number"
                  min={5}
                  value={pieceDuration}
                  onChange={(e) => setPieceDuration(Number(e.target.value))}
                  className="input w-full font-mono text-xs font-bold text-[var(--d-drawing-accent)]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'المشروع المرتبط (اختياري):' : 'Project Link:'}</label>
                <select
                  className="select w-full text-xs"
                  value={pieceProject}
                  onChange={(e) => setPieceProject(e.target.value)}
                >
                  <option value="">{isAr ? 'عمل حر مستقل' : 'Standalone Piece'}</option>
                  {(drawingData.projects || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="text-xs text-muted block mb-1">{isAr ? 'مرحلة العمل:' : 'Stage:'}</label>
                <select
                  className="select w-full text-xs"
                  value={pieceStage}
                  onChange={(e) => setPieceStage(e.target.value as ProjectStage)}
                >
                  <option value="sketching">{isAr ? 'تخطيط وسكتش (Sketching)' : 'Sketching'}</option>
                  <option value="inking">{isAr ? 'تحبير (Inking)' : 'Inking'}</option>
                  <option value="coloring">{isAr ? 'تلوين (Coloring)' : 'Coloring'}</option>
                  <option value="completed">{isAr ? 'مكتمل (Completed)' : 'Completed'}</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label className="text-xs text-muted block mb-1">{isAr ? 'ملاحظات إبداعية وتقنيات مستخدمة:' : 'Creative Notes:'}</label>
              <textarea
                value={pieceNotes}
                onChange={(e) => setPieceNotes(e.target.value)}
                placeholder={isAr ? 'التركيز على النسب، زوايا المنظور، تدريب التظليل...' : 'Notes on technique, shadows, perspective...'}
                className="textarea w-full text-xs"
                rows={2}
              />
            </div>

            <div className="pt-3 border-t border-[var(--d-drawing-border)] flex justify-end gap-2">
              <button type="button" onClick={() => setActiveTab('dashboard')} className="btn subtle small text-xs">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="btn primary small text-xs px-5 py-2 font-bold bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]">
                <span>✓</span>
                <span>{isAr ? 'حفظ العمل الفني' : 'Save Piece'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PROJECTS VAULT
         ========================================================================= */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-surface)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)]">
              {isAr ? `إجمالي المشاريع الجارية: ${(drawingData.projects || []).length}` : `Active Projects: ${(drawingData.projects || []).length}`}
            </span>
            <button onClick={() => setIsAddingProject(true)} className="btn primary small text-xs bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]">
              + {isAr ? 'مشروع مرسم جديد' : 'New Project'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(drawingData.projects || []).map((proj) => (
              <div
                key={proj.id}
                className="p-4 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-raised)] space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-[var(--d-drawing-accent-strong)]">
                      {proj.medium}
                    </span>
                    <span className="text-[10px] text-muted">{proj.startedDate}</span>
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-sm">{proj.title}</h3>
                  {proj.description && <p className="text-xs text-muted mt-1">{proj.description}</p>}
                </div>

                <div className="pt-2 border-t border-[var(--d-drawing-border-soft)] flex items-center justify-between text-[11px] text-muted">
                  <span>{proj.sessionsCount || 0} {isAr ? 'جلسات' : 'sessions'} · {proj.totalMinutesSpent || 0}m</span>
                  <button
                    onClick={() => {
                      if (drawingHabit && confirm(isAr ? 'حذف هذا المشروع؟' : 'Delete project?')) {
                        deleteArtProject(drawingHabit.id, proj.id);
                      }
                    }}
                    className="text-muted hover:text-[var(--state-danger)]"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          {isAddingProject && (
            <div className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="modal w-full max-w-md bg-[var(--d-drawing-surface)] border border-[var(--d-drawing-border)] rounded-2xl p-6 shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-[var(--text-primary)]">{isAr ? 'مشروع فني جديد' : 'New Art Project'}</h3>
                <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
                  <div className="field">
                    <label className="text-muted block mb-1">{isAr ? 'عنوان المشروع:' : 'Project Title:'}</label>
                    <input
                      type="text"
                      value={projTitle}
                      onChange={(e) => setProjTitle(e.target.value)}
                      className="input w-full text-xs font-semibold"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label className="text-muted block mb-1">{isAr ? 'وصف المشروع والرؤية الفنية:' : 'Description:'}</label>
                    <textarea
                      value={projDesc}
                      onChange={(e) => setProjDesc(e.target.value)}
                      className="textarea w-full text-xs"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-[var(--d-drawing-border)]">
                    <button type="button" onClick={() => setIsAddingProject(false)} className="btn subtle small text-xs">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" className="btn primary small text-xs bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]">
                      {isAr ? 'حفظ المشروع' : 'Save Project'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: GALLERY
         ========================================================================= */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-surface)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)]">
              {isAr ? `إجمالي الأعمال في المعرض: ${drawingData.pieces.length}` : `Artworks in Gallery: ${drawingData.pieces.length}`}
            </span>
            <button onClick={() => setActiveTab('session')} className="btn primary small text-xs bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]">
              + {isAr ? 'إضافة عمل' : 'Add Piece'}
            </button>
          </div>

          {drawingData.pieces.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted border border-dashed border-[var(--d-drawing-border)] rounded-2xl">
              {isAr ? 'لا توجد أعمال في المعرض بعد.' : 'No artworks in gallery yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {drawingData.pieces.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-[var(--d-drawing-border)] bg-[var(--d-drawing-raised)] space-y-2 text-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-[var(--d-drawing-accent-strong)]">
                        {p.medium}
                      </span>
                      <span className="text-[10px] text-muted">{p.completedDate}</span>
                    </div>
                    <strong className="text-[var(--text-primary)] block text-sm">{p.title}</strong>
                    {p.projectTitle && <span className="text-[11px] text-muted block mt-0.5">{p.projectTitle}</span>}
                    {p.notes && <p className="text-[11px] text-muted/80 mt-1 italic">"{p.notes}"</p>}
                  </div>

                  <div className="pt-2 border-t border-[var(--d-drawing-border-soft)] flex items-center justify-between text-[11px]">
                    <span className="font-mono text-[var(--d-drawing-accent)]">{p.durationMinutes}m {isAr ? 'تدفق' : 'flow'}</span>
                    <button
                      onClick={() => {
                        if (drawingHabit && confirm(isAr ? 'حذف هذا العمل؟' : 'Delete piece?')) {
                          deleteArtworkPiece(drawingHabit.id, p.id);
                        }
                      }}
                      className="text-muted hover:text-[var(--state-danger)]"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: CREATIVE TARGETS
         ========================================================================= */}
      {activeTab === 'targets' && (
        <div className="max-w-xl mx-auto p-6 rounded-2xl border border-purple-500/30 bg-[var(--d-drawing-surface)] space-y-4">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>🎯</span>
            <span>{isAr ? 'أهداف التدفق وساعات الرسم' : 'Creative Flow Targets'}</span>
          </h2>
          {targetsSaved && (
            <div className="p-3 rounded-xl border border-purple-500/30 bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-strong)] text-xs">
              {isAr ? 'تم حفظ أهداف التدفق بنجاح!' : 'Targets saved!'}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (drawingHabit) {
                updateDrawingTargets(drawingHabit.id, { weeklyTargetHours: Number(targetHours) });
                setTargetsSaved(true);
                setTimeout(() => setTargetsSaved(false), 2000);
              }
            }}
            className="space-y-4 text-xs"
          >
            <div className="field">
              <label className="text-muted block mb-1">{isAr ? 'ساعات التدفق الأسبوعية (ساعات/أسبوع):' : 'Weekly Flow Hours Target:'}</label>
              <input
                type="number"
                min={1}
                max={40}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="input w-full font-mono text-xs font-bold text-[var(--d-drawing-accent)]"
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn primary small text-xs px-5 py-2 bg-purple-600 hover:bg-purple-500 text-[var(--text-on-state)]">
                {isAr ? 'حفظ الأهداف' : 'Save Targets'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

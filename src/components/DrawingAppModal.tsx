import React, { useState } from 'react';
import { Habit, ArtworkPiece, ArtProject, ArtMedium, ProjectStage } from '../types';
import { useNuqtaStore } from '../store/nuqtaStore';

interface DrawingAppModalProps {
  habit: Habit;
  onClose: () => void;
}

export const DrawingAppModal: React.FC<DrawingAppModalProps> = ({ habit, onClose }) => {
  const {
    profile,
    logDrawingSession,
    deleteArtworkPiece,
    addOrUpdateArtProject,
    deleteArtProject,
    updateDrawingTargets
  } = useNuqtaStore();

  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  const drawingData = habit.drawingData || {
    pieces: [],
    projects: [],
    weeklyTargetHours: 3,
    totalDrawingMinutes: 180,
    totalSketches: 4,
    favoriteMedium: 'sketch'
  };

  const projects = drawingData.projects || [];
  const pieces = drawingData.pieces || [];

  const [activeTab, setActiveTab] = useState<'dashboard' | 'session' | 'projects' | 'gallery'>('dashboard');

  // Session state
  const [pieceTitle, setPieceTitle] = useState('');
  const [medium, setMedium] = useState<ArtMedium>('sketch');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [targetStage, setTargetStage] = useState<ProjectStage>('sketching');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [promptTheme, setPromptTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Gallery filter state
  const [mediumFilter, setMediumFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Target Editing state
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [tempWeeklyHours, setTempWeeklyHours] = useState(drawingData.weeklyTargetHours || 3);

  // New Project Modal state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ArtProject | null>(null);
  const [projTitle, setProjTitle] = useState('');
  const [projDescription, setProjDescription] = useState('');
  const [projMedium, setProjMedium] = useState<ArtMedium>('sketch');
  const [projStage, setProjStage] = useState<ProjectStage>('ideation');
  const [projThumbnailColor, setProjThumbnailColor] = useState('#8b5cf6');
  const [projTags, setProjTags] = useState('');

  // Suggested creative prompts
  const creativePromptsAr = [
    'رسم تفاصيل مقهى هادئ أو فنجان قهوة بنسب حقيقية',
    'بورتريه سريع بأسلوب الخط الواحد (Continuous Line)',
    'دراسة إضاءة وظلال لكائن طبيعي (نبات أو صخرة)',
    'تخيل زاوية معمارية وتراثية بزاوية منظور واسعة',
    'اسكتش تشريحي لحركة اليد أو وضعية جسد ديناميكية',
    'رسم رقمي لتدرج لوني في وقت الغروب (Color Palette Study)'
  ];

  const creativePromptsEn = [
    'Continuous-line sketch of a desktop coffee cup',
    'Dynamic light and cast-shadow study of a succulent',
    'Architectural heritage archway with two-point perspective',
    'Anatomical gesture study of hand resting on surface',
    'Atmospheric digital sunset color palette composition',
    'Cross-hatching texture study of aged wooden texture'
  ];

  const mediumMeta: Record<ArtMedium, { ar: string; en: string; icon: string; badge: string; color: string }> = {
    sketch: { ar: 'رصاص وفحم', en: 'Pencil / Charcoal', icon: '✏️', badge: 'bg-zinc-800 text-[var(--text-secondary)] border-zinc-700', color: '#a1a1aa' },
    ink: { ar: 'حبر وتحبير (Ink)', en: 'Ink & Linework', icon: '✒️', badge: 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-strong)] border-[var(--d-drawing-border-strong)]', color: '#c084fc' },
    watercolor: { ar: 'ألوان مائية', en: 'Watercolor', icon: '🎨', badge: 'bg-[var(--d-drawing-chip)] text-[var(--state-info-strong)] border-[var(--d-drawing-border-strong)]', color: '#38bdf8' },
    digital: { ar: 'رسم رقمي', en: 'Digital Art', icon: '💻', badge: 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-strong)] border-[var(--d-drawing-border-strong)]', color: '#22d3ee' },
    acrylic: { ar: 'أكريليك وزيتي', en: 'Acrylic & Oil', icon: '🖌️', badge: 'bg-[var(--d-drawing-chip)] text-[var(--state-warning-strong)] border-[var(--d-drawing-border-strong)]', color: '#fbbf24' },
    oil: { ar: 'ألوان زيتية', en: 'Oil Painting', icon: '🖼️', badge: 'bg-[var(--d-drawing-chip)] text-[var(--state-danger-strong)] border-[var(--d-drawing-border-strong)]', color: '#fb7185' },
    mixed: { ar: 'وسائط متعددة', en: 'Mixed Media', icon: '✨', badge: 'bg-[var(--d-drawing-chip)] text-[var(--state-success-strong)] border-[var(--d-drawing-border-strong)]', color: '#34d399' }
  };

  const stageMeta: Record<ProjectStage, { ar: string; en: string; step: number; color: string }> = {
    ideation: { ar: 'توليد الفكرة والبحث', en: 'Ideation & Moodboard', step: 1, color: 'text-[var(--state-warning)]' },
    sketching: { ar: 'التخطيط والسكتش الأولي', en: 'Rough Sketching', step: 2, color: 'text-blue-400' },
    inking: { ar: 'التحبير وبناء الخطوط', en: 'Inking & Linework', step: 3, color: 'text-[var(--d-drawing-accent)]' },
    coloring: { ar: 'التلوين والظلال', en: 'Coloring & Shading', step: 4, color: 'text-pink-400' },
    polishing: { ar: 'اللمسات النهائية والتهذيب', en: 'Polishing & Highlights', step: 5, color: 'text-[var(--state-info)]' },
    completed: { ar: 'عمل مكتمل ومنجز', en: 'Completed Artwork', step: 6, color: 'text-[var(--state-success)]' },
    archived: { ar: 'مشروع مؤرشف ومحفوظ', en: 'Archived Project', step: 7, color: 'text-[var(--text-tertiary)]' }
  };

  const handlePickPrompt = (p: string) => {
    setPromptTheme(p);
    if (!pieceTitle) {
      setPieceTitle(p.slice(0, 32));
    }
  };

  const handleSelectProjectForSession = (projId: string) => {
    setSelectedProjectId(projId);
    if (!projId) return;
    const found = projects.find((p) => p.id === projId);
    if (found) {
      setMedium(found.medium);
      setTargetStage(found.stage);
      if (!pieceTitle) {
        setPieceTitle(found.title + (isAr ? ' - تقدم عمل' : ' - Session Progress'));
      }
    }
  };

  const handleOpenProjectModal = (proj?: ArtProject) => {
    if (proj) {
      setProjectToEdit(proj);
      setProjTitle(proj.title);
      setProjDescription(proj.description || '');
      setProjMedium(proj.medium);
      setProjStage(proj.stage);
      setProjThumbnailColor(proj.thumbnailColor || '#8b5cf6');
      setProjTags((proj.tags || []).join(', '));
    } else {
      setProjectToEdit(null);
      setProjTitle('');
      setProjDescription('');
      setProjMedium('sketch');
      setProjStage('ideation');
      setProjThumbnailColor('#8b5cf6');
      setProjTags('');
    }
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projTitle.trim()) return;

    const tags = projTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (projectToEdit) {
      const updated: ArtProject = {
        ...projectToEdit,
        title: projTitle.trim(),
        description: projDescription.trim() || undefined,
        medium: projMedium,
        stage: projStage,
        thumbnailColor: projThumbnailColor,
        tags,
        completedDate: projStage === 'completed' && !projectToEdit.completedDate ? todayStr : projectToEdit.completedDate
      };
      addOrUpdateArtProject(habit.id, updated);
    } else {
      const newProj: ArtProject = {
        id: 'proj-' + crypto.randomUUID().slice(0, 8),
        title: projTitle.trim(),
        description: projDescription.trim() || undefined,
        medium: projMedium,
        stage: projStage,
        startedDate: todayStr,
        thumbnailColor: projThumbnailColor,
        totalMinutesSpent: 0,
        sessionsCount: 0,
        tags
      };
      addOrUpdateArtProject(habit.id, newProj);
    }

    setIsProjectModalOpen(false);
  };

  const handleFinishDrawingSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pieceTitle.trim()) return;

    const linkedProj = projects.find((p) => p.id === selectedProjectId);

    logDrawingSession(habit.id, {
      title: pieceTitle.trim(),
      medium,
      projectId: selectedProjectId || undefined,
      projectTitle: linkedProj?.title || undefined,
      stage: selectedProjectId ? targetStage : undefined,
      durationMinutes: Number(durationMinutes) || 30,
      promptTheme: promptTheme.trim() || undefined,
      notes: notes.trim() || undefined
    });

    setShowSuccess(true);
    setPieceTitle('');
    setNotes('');
    setPromptTheme('');
    setSelectedProjectId('');

    setTimeout(() => {
      setShowSuccess(false);
      setActiveTab('gallery');
    }, 1200);
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    updateDrawingTargets(habit.id, {
      weeklyTargetHours: Math.max(1, Number(tempWeeklyHours) || 3)
    });
    setIsEditingTargets(false);
  };

  // Calculations for studio dashboard
  const totalHours = Math.round((drawingData.totalDrawingMinutes / 60) * 10) / 10;
  const weeklyTargetHours = drawingData.weeklyTargetHours || 3;
  // Let's compute hours logged in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekCutoff = sevenDaysAgo.toISOString().split('T')[0];
  const thisWeekMinutes = pieces
    .filter((p) => p.completedDate >= weekCutoff)
    .reduce((acc, p) => acc + p.durationMinutes, 0);
  const thisWeekHours = Math.round((thisWeekMinutes / 60) * 10) / 10;
  const weeklyProgressPercent = Math.min(100, Math.round((thisWeekHours / weeklyTargetHours) * 100));

  const completedProjectsCount = projects.filter((p) => p.stage === 'completed').length;
  const inProgressProjects = projects.filter((p) => p.stage !== 'completed');
  const activeSpotlightProject = inProgressProjects[0] || projects[0];

  // Medium distribution
  const mediumCounts: Record<string, number> = {};
  pieces.forEach((p) => {
    mediumCounts[p.medium] = (mediumCounts[p.medium] || 0) + 1;
  });

  const filteredPieces = pieces.filter((p) => {
    if (mediumFilter !== 'all' && p.medium !== mediumFilter) return false;
    if (projectFilter !== 'all' && p.projectId !== projectFilter) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md">
      <div
        className="panel max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-[var(--d-drawing-border-strong)] shadow-2xl bg-[var(--d-drawing-deep)]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-[var(--d-drawing-accent)] font-bold text-xl shadow-inner">
              🎨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-purple-500/20 text-[var(--d-drawing-accent-strong)] font-semibold border border-purple-500/30">
                  {isAr ? 'مرسم الإبداع والرسم المتقدم' : 'CREATIVE STUDIO & VAULT'}
                </span>
                <span className="text-xs text-muted">· {habit.name}</span>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                {isAr ? 'مرسم وتوثيق المشاريع الفنية المستقلة' : 'Drawing & Visual Art Sanctuary'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex p-1 rounded-xl bg-[var(--d-drawing-deep)] border border-[var(--d-drawing-border-strong)]">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeTab === 'dashboard' ? 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] font-bold shadow' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'المرسم والتحليلات' : 'Studio'}
              </button>
              <button
                onClick={() => setActiveTab('session')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeTab === 'session' ? 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] font-bold shadow' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? 'جلسة إبداع' : 'Log Flow'}
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeTab === 'projects' ? 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] font-bold shadow' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? `المشاريع (${projects.length})` : `Projects (${projects.length})`}
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeTab === 'gallery' ? 'bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] font-bold shadow' : 'text-muted hover:text-[var(--text-primary)]'
                }`}
              >
                {isAr ? `المعرض (${pieces.length})` : `Gallery (${pieces.length})`}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <span className="text-xl font-bold px-1.5">✕</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-gradient-to-b from-[var(--d-drawing-deep)] to-[var(--d-drawing-deep)]">
          {/* TAB 1: STUDIO DASHBOARD & TARGETS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Active Project Spotlight Hero */}
              {activeSpotlightProject ? (
                <div className="panel p-5 sm:p-6 border border-[var(--d-drawing-border-accent)] bg-gradient-to-br from-[var(--d-drawing-chip)] via-[var(--d-drawing-raised)] to-[var(--d-drawing-deep)] rounded-2xl relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 end-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: activeSpotlightProject.thumbnailColor || '#8b5cf6' }}
                        />
                        <span className="text-xs uppercase font-mono tracking-wider text-[var(--d-drawing-accent-strong)] font-semibold">
                          {isAr ? 'المشروع قيد العمل حالياً' : 'ACTIVE PROJECT IN PROGRESS'}
                        </span>
                        <span className="text-xs text-muted">· {mediumMeta[activeSpotlightProject.medium]?.ar || activeSpotlightProject.medium}</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                        {activeSpotlightProject.title}
                      </h3>
                      {activeSpotlightProject.description && (
                        <p className="text-xs text-muted/90 max-w-xl">
                          {activeSpotlightProject.description}
                        </p>
                      )}

                      {/* Current Stage Indicator */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">{isAr ? 'المرحلة الحالية:' : 'Current Stage:'}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-md font-semibold bg-[var(--d-drawing-chip)] border border-[var(--d-drawing-border-accent)] ${stageMeta[activeSpotlightProject.stage]?.color}`}>
                          ✦ {stageMeta[activeSpotlightProject.stage]?.step}/6 · {isAr ? stageMeta[activeSpotlightProject.stage]?.ar : stageMeta[activeSpotlightProject.stage]?.en}
                        </span>
                        <span className="text-xs text-muted">
                          ({activeSpotlightProject.sessionsCount} {isAr ? 'جلسات' : 'sessions'} · {Math.round(activeSpotlightProject.totalMinutesSpent / 60 * 10) / 10}h)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
                      <button
                        onClick={() => {
                          handleSelectProjectForSession(activeSpotlightProject.id);
                          setActiveTab('session');
                        }}
                        className="btn primary bg-purple-600 hover:bg-purple-500 border-purple-400 text-[var(--text-on-state)] font-bold px-5 py-2.5 shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
                      >
                        <span>{isAr ? 'متابعة العمل في المشروع' : 'Continue Artwork'}</span>
                        <span>✏️</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('projects')}
                        className="btn subtle text-xs border-[var(--d-drawing-border-accent)] text-[var(--d-drawing-accent-bright)] hover:bg-[var(--d-drawing-chip)]"
                      >
                        {isAr ? 'عرض كل المشاريع' : 'All Projects'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="panel p-5 border border-[var(--d-drawing-border-accent)] bg-[var(--d-drawing-raised)] rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-base">{isAr ? 'ابدأ أول مشروع إبداعي متكامل' : 'Start Your First Art Project'}</h3>
                    <p className="text-xs text-muted mt-1">{isAr ? 'نظّم رسوماتك في مشاريع مرحلية تبدأ من السكتش حتى الإخراج النهائي.' : 'Organize sketches into multistage projects from draft to polished piece.'}</p>
                  </div>
                  <button onClick={() => handleOpenProjectModal()} className="btn primary small bg-purple-600">
                    + {isAr ? 'مشروع جديد' : 'New Project'}
                  </button>
                </div>
              )}

              {/* 4 Compounding Studio Metric Tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{isAr ? 'ساعات التدفق' : 'Flow Hours'}</span>
                    <span className="text-sm">⏳</span>
                  </div>
                  <div className="my-2">
                    <strong className="text-2xl font-mono text-[var(--d-drawing-accent-strong)] font-bold block">
                      {totalHours}h
                    </strong>
                    <span className="text-[11px] text-muted">
                      {drawingData.totalDrawingMinutes} {isAr ? 'دقيقة إجمالية' : 'total minutes'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--d-drawing-accent-strong)] font-medium">
                    {thisWeekHours}h {isAr ? 'هذا الأسبوع' : 'this week'}
                  </div>
                </div>

                <div className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{isAr ? 'الأعمال والسكتشات' : 'Artworks Logged'}</span>
                    <span className="text-sm">🖼️</span>
                  </div>
                  <div className="my-2">
                    <strong className="text-2xl font-mono text-[var(--text-primary)] font-bold block">
                      {drawingData.totalSketches}
                    </strong>
                    <span className="text-[11px] text-muted">
                      {isAr ? 'قطعة في المعرض' : 'preserved pieces'}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    {completedProjectsCount} {isAr ? 'مشاريع مكتملة' : 'completed projects'}
                  </div>
                </div>

                <div className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{isAr ? 'معدل الجلسة' : 'Avg Session'}</span>
                    <span className="text-sm">⚡</span>
                  </div>
                  <div className="my-2">
                    <strong className="text-2xl font-mono text-[var(--state-warning-strong)] font-bold block">
                      {drawingData.totalSketches > 0
                        ? Math.round(drawingData.totalDrawingMinutes / drawingData.totalSketches)
                        : 30}m
                    </strong>
                    <span className="text-[11px] text-muted">
                      {isAr ? 'دقائق لكل جلسة رسم' : 'minutes per session'}
                    </span>
                  </div>
                  <div className="text-[11px] text-accent font-medium">
                    {isAr ? 'تركيز وانغماس عالي' : 'Deep focus index'}
                  </div>
                </div>

                <div className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{isAr ? 'الوسيط الأبرز' : 'Favorite Medium'}</span>
                    <span className="text-sm">🖌️</span>
                  </div>
                  <div className="my-2">
                    <strong className="text-base font-bold text-[var(--state-info-strong)] block truncate">
                      {mediumMeta[drawingData.favoriteMedium as ArtMedium]?.ar || drawingData.favoriteMedium}
                    </strong>
                    <span className="text-[11px] text-muted">
                      {isAr ? 'أعلى استمرارية' : 'highest cadence'}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {projects.length} {isAr ? 'مشاريع قيد المتابعة' : 'projects in vault'}
                  </div>
                </div>
              </div>

              {/* Weekly Practice Target Gauge */}
              <div className="panel p-5 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-base">
                      {isAr ? 'هدف ساعات الرسم الأسبوعي (Weekly Flow KPI)' : 'Weekly Creative Flow Target'}
                    </h4>
                    <p className="text-xs text-muted mt-0.5">
                      {isAr
                        ? 'الالتزام بساعات تدفق أسبوعية يحول الممارسة الفنية من إلهام عشوائي إلى عادة تراكمية.'
                        : 'Calibrate steady weekly flow hours to transform artistic practice into lasting mastery.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTempWeeklyHours(weeklyTargetHours);
                      setIsEditingTargets(!isEditingTargets);
                    }}
                    className="text-xs text-[var(--d-drawing-accent-strong)] hover:text-[var(--d-drawing-accent-bright)] underline"
                  >
                    {isEditingTargets ? (isAr ? 'إلغاء' : 'Cancel') : (isAr ? 'تعديل الهدف ⚙️' : 'Edit Target ⚙️')}
                  </button>
                </div>

                {isEditingTargets ? (
                  <form onSubmit={handleSaveTargets} className="p-3 bg-[var(--d-drawing-chip)] rounded-lg border border-[var(--d-drawing-border-accent)] flex items-center gap-3">
                    <label className="text-xs text-muted">{isAr ? 'الهدف الأسبوعي (ساعات):' : 'Weekly Goal (Hours):'}</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={tempWeeklyHours}
                      onChange={(e) => setTempWeeklyHours(Number(e.target.value))}
                      className="input w-24 text-center font-mono font-bold"
                    />
                    <button type="submit" className="btn primary small bg-purple-600">
                      {isAr ? 'حفظ الهدف' : 'Save'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--d-drawing-accent-strong)] font-semibold">
                        {thisWeekHours} {isAr ? 'ساعات منجزة هذا الأسبوع' : 'hours logged this week'}
                      </span>
                      <span className="text-muted font-mono">
                        {isAr ? `الهدف: ${weeklyTargetHours} ساعات (${weeklyProgressPercent}%)` : `Target: ${weeklyTargetHours}h (${weeklyProgressPercent}%)`}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--d-drawing-chip)] rounded-full h-3 overflow-hidden border border-[var(--d-drawing-border-accent)]">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${weeklyProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Mediums Breakdown & Flow Philosophy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="panel p-5 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl space-y-3">
                  <h4 className="font-bold text-[var(--text-primary)] text-sm">
                    {isAr ? 'توزيع الوسائط الفنية المستخدمة' : 'Artistic Mediums Distribution'}
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(mediumMeta).map(([medKey, meta]) => {
                      const count = mediumCounts[medKey] || 0;
                      const percent = pieces.length > 0 ? Math.round((count / pieces.length) * 100) : 0;
                      return (
                        <div key={medKey} className="flex items-center justify-between text-xs py-1 border-b border-[var(--d-drawing-border-soft)] last:border-0">
                          <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                            <span>{meta.icon}</span>
                            <span>{isAr ? meta.ar : meta.en}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted font-mono">{count} {isAr ? 'أعمال' : 'pcs'}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-strong)] border border-[var(--d-drawing-border-accent)]">
                              {percent}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="panel p-5 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] text-sm">
                      {isAr ? 'قانون اليد والعين: عادة الملاحظة اليومية' : 'Eye-Hand Calibration Law'}
                    </h4>
                    <p className="text-xs text-muted leading-relaxed mt-2">
                      {isAr
                        ? 'الرسم ليس مجرد موهبة فطرية، بل عادة بصرية عصبية تُبنى برسم خطوط واعية لمدة 15-20 دقيقة يومياً. مع كل سكتش جديد، تُدرّب عينك على التقاط نسب الواقع وعقلك على الدخول في حالة التدفق الخالص (Flow State).'
                        : 'Artistry is not mere raw genius; it is a neurological eye-hand coordination habit built by drawing conscious lines for 15-20 minutes daily. Every sketch calibrates spatial acuity and elevates your deep flow state.'}
                    </p>
                  </div>
                  <div className="p-3 bg-[var(--d-drawing-chip)] rounded-lg border border-[var(--d-drawing-border-accent)] text-[11px] text-[var(--d-drawing-accent-bright)]">
                    💡 {isAr ? 'نصيحة اليوم: لا تبحث عن اللوحة المثالية في البداية؛ ركّز على تدفق الخط وحرية الحركة.' : 'Pro-tip: Never aim for perfection on the initial pass; prioritize energetic gesture and stroke confidence.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOG ARTWORK / PRACTICE SESSION */}
          {activeTab === 'session' && (
            <form onSubmit={handleFinishDrawingSession} className="space-y-5">
              <div className="panel p-5 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] space-y-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-base">
                      {isAr ? 'توثيق جلسة رسم أو عمل إبداعي جديد' : 'Document Today\'s Artwork Session'}
                    </h3>
                    <p className="text-xs text-muted">
                      {isAr
                        ? 'سجّل وقت الإبداع والأسلوب الفني واربط الجلسة بمشروعك الجاري للحفاظ على تقدمك.'
                        : 'Capture creative flow duration, chosen medium, and thoughts into your private studio vault.'}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[var(--d-drawing-accent-strong)] bg-purple-500/15 px-2.5 py-1 rounded border border-purple-500/30">
                    +35 XP & Habit Streak
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'عنوان العمل أو موضوع الرسمة' : 'Artwork Title / Subject'}
                    </label>
                    <input
                      type="text"
                      value={pieceTitle}
                      onChange={(e) => setPieceTitle(e.target.value)}
                      className="input w-full text-xs font-semibold"
                      placeholder={isAr ? 'مثال: دراسة ملامح بورتريه سريع بالفحم' : 'e.g. Minimalist Charcoal Portrait Study'}
                      required
                    />
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'الوسيط الفني (Medium)' : 'Medium'}
                    </label>
                    <select
                      className="select w-full text-xs"
                      value={medium}
                      onChange={(e) => setMedium(e.target.value as ArtMedium)}
                    >
                      <option value="sketch">{isAr ? '✏️ رصاص / فحم / سكتش' : 'Pencil / Charcoal'}</option>
                      <option value="ink">{isAr ? '✒️ حبر وتحبير (Ink)' : 'Ink & Linework'}</option>
                      <option value="watercolor">{isAr ? '🎨 ألوان مائية (Watercolor)' : 'Watercolor'}</option>
                      <option value="digital">{isAr ? '💻 رسم رقمي (Digital)' : 'Digital Art'}</option>
                      <option value="acrylic">{isAr ? '🖌️ أكريليك وزيتي' : 'Acrylic & Oil'}</option>
                      <option value="mixed">{isAr ? '✨ وسائط متعددة (Mixed)' : 'Mixed Media'}</option>
                    </select>
                  </div>
                </div>

                {/* Project Linking & Stage Progression */}
                <div className="p-3.5 bg-[var(--d-drawing-chip)] rounded-xl border border-[var(--d-drawing-border-accent)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--d-drawing-accent-strong)]">
                      {isAr ? 'ربط الجلسة بمشروع فني قائم (اختياري):' : 'Link Session to an Ongoing Art Project (Optional):'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenProjectModal()}
                      className="text-[11px] text-accent hover:underline"
                    >
                      + {isAr ? 'مشروع جديد' : 'New Project'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <select
                        className="select w-full text-xs"
                        value={selectedProjectId}
                        onChange={(e) => handleSelectProjectForSession(e.target.value)}
                      >
                        <option value="">{isAr ? '-- تمرين حر / دراسة مستقلة --' : '-- Standalone Study / Free Practice --'}</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.title} ({stageMeta[proj.stage]?.ar || proj.stage})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedProjectId && (
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-muted whitespace-nowrap">
                            {isAr ? 'تحديث مرحلة المشروع إلى:' : 'Update Project Stage:'}
                          </label>
                          <select
                            className="select w-full text-xs"
                            value={targetStage}
                            onChange={(e) => setTargetStage(e.target.value as ProjectStage)}
                          >
                            <option value="ideation">{isAr ? '1. فكرة وبحث' : '1. Ideation'}</option>
                            <option value="sketching">{isAr ? '2. سكتش أولي' : '2. Sketching'}</option>
                            <option value="inking">{isAr ? '3. تحبير وخطوط' : '3. Inking'}</option>
                            <option value="coloring">{isAr ? '4. تلوين وظلال' : '4. Coloring'}</option>
                            <option value="polishing">{isAr ? '5. لمسات نهائية' : '5. Polishing'}</option>
                            <option value="completed">{isAr ? '6. مكتمل ومنجز 🏆' : '6. Completed 🏆'}</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'مدة الجلسة بالدقائق' : 'Session Duration (Minutes)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="input w-full font-mono font-bold text-accent"
                        required
                      />
                      <span className="absolute end-3 top-2.5 text-xs text-muted pointer-events-none">
                        {isAr ? 'دقيقة' : 'mins'}
                      </span>
                    </div>
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'فكرة أو موضوع التحدي' : 'Prompt / Theme Reference'}
                    </label>
                    <input
                      type="text"
                      value={promptTheme}
                      onChange={(e) => setPromptTheme(e.target.value)}
                      className="input w-full text-xs"
                      placeholder={isAr ? 'مثال: منظور ثلاثي الأبعاد، تباين الظلال' : 'e.g. Atmospheric Perspective'}
                    />
                  </div>
                </div>

                {/* Prompt Inspiration Badges */}
                <div className="pt-2 border-t border-[var(--d-drawing-border-strong)]">
                  <span className="text-[11px] text-muted block mb-2">
                    {isAr ? 'أفكار ومحفزات إبداعية مقترحة لليوم:' : 'Creative Sparks & Practice Prompts:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(isAr ? creativePromptsAr : creativePromptsEn).map((prompt, pIdx) => (
                      <button
                        type="button"
                        key={pIdx}
                        onClick={() => handlePickPrompt(prompt)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--d-drawing-chip)] hover:bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] border border-[var(--d-drawing-border-accent)] transition-colors"
                      >
                        ✦ {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field pt-2">
                  <label className="text-xs text-muted mb-1 block">
                    {isAr ? 'ملاحظات فنية أو خلاصة تقنية' : 'Artistic Reflections & Technical Notes'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="input w-full text-xs"
                    placeholder={
                      isAr
                        ? 'ما التجربة أو التقنية الجديدة التي جربتها اليوم في الظلال أو النسب والخطوط؟'
                        : 'What breakthrough or subtle improvement did you explore in tonight’s lines?'
                    }
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex items-center justify-between">
                <div>
                  {showSuccess ? (
                    <span className="text-xs text-[var(--d-drawing-accent-strong)] font-semibold flex items-center gap-1.5 animate-pulse">
                      ✓ {isAr ? 'تم توثيق العمل الفني وتحديث سلسلة العادة بنجاح!' : 'Artwork preserved & streak updated!'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      {isAr
                        ? 'تُحسب الجلسة كإنجاز فوري لعادة الرسم لليوم وتُسجل بالمعرض.'
                        : 'Auto-qualifies habit execution for today and stores in vault.'}
                    </span>
                  )}
                </div>

                <button type="submit" className="btn primary bg-purple-600 hover:bg-purple-500 border-purple-400">
                  <span>{isAr ? 'حفظ العمل في المرسم' : 'Preserve to Studio Vault'}</span>
                  <span>🎨</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ART PROJECTS PIPELINE */}
          {activeTab === 'projects' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'مشاريع المرسم ومسار الإنجاز' : 'Art Projects & Progression Pipeline'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr
                      ? 'تتبع اللوحات والمشاريع المعقدة عبر 6 مراحل متتالية من الفكرة حتى الإخراج النهائي.'
                      : 'Structured tracking for complex creative works across 6 development stages.'}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenProjectModal()}
                  className="btn primary small bg-purple-600 hover:bg-purple-500"
                >
                  + {isAr ? 'مشروع جديد' : 'New Project'}
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="p-10 text-center panel border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-deep)] space-y-3 rounded-2xl">
                  <div className="text-4xl">🎨</div>
                  <strong className="text-[var(--text-primary)] block text-base">{isAr ? 'لا توجد مشاريع فنية بعد' : 'No art projects in progress'}</strong>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    {isAr
                      ? 'أنشئ أول مشروع فني (مثل: لوحة شخصية، دفتر دراسات، أو مشهد رقمي) لتبدأ تتبعه مرحلياً.'
                      : 'Initiate your first multi-stage art project to track continuous progress from sketch to final polish.'}
                  </p>
                  <button onClick={() => handleOpenProjectModal()} className="btn primary small bg-purple-600 mt-2">
                    {isAr ? 'إنشاء أول مشروع' : 'Create First Project'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((proj) => {
                    const stage = stageMeta[proj.stage] || stageMeta.ideation;
                    const meta = mediumMeta[proj.medium] || mediumMeta.sketch;
                    const isDone = proj.stage === 'completed';

                    return (
                      <div
                        key={proj.id}
                        className="panel p-5 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: proj.thumbnailColor || '#8b5cf6' }}
                              />
                              <h4 className="font-bold text-[var(--text-primary)] text-base leading-snug">{proj.title}</h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenProjectModal(proj)}
                                className="text-muted hover:text-[var(--d-drawing-accent-strong)] text-xs p-1"
                                title={isAr ? 'تعديل' : 'Edit'}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteArtProject(habit.id, proj.id)}
                                className="text-muted hover:text-red-400 text-xs p-1"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {proj.description && (
                            <p className="text-xs text-muted/90 line-clamp-2">
                              {proj.description}
                            </p>
                          )}

                          {/* Stage Progress Bar */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-semibold ${stage.color}`}>
                                {isAr ? stage.ar : stage.en}
                              </span>
                              <span className="text-muted font-mono">{stage.step}/6</span>
                            </div>
                            <div className="w-full bg-[var(--d-drawing-chip)] rounded-full h-2 overflow-hidden border border-[var(--d-drawing-border-accent)]">
                              <div
                                className="bg-gradient-to-r from-purple-600 to-accent h-full rounded-full transition-all duration-300"
                                style={{ width: `${(stage.step / 6) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted">
                            <span className={`px-2 py-0.5 rounded border ${meta.badge}`}>
                              {meta.icon} {isAr ? meta.ar : meta.en}
                            </span>
                            <span>· {proj.sessionsCount} {isAr ? 'جلسات' : 'sessions'}</span>
                            <span>· {Math.round(proj.totalMinutesSpent / 60 * 10) / 10}h</span>
                            {proj.tags && proj.tags.length > 0 && (
                              <div className="flex gap-1">
                                {proj.tags.map((tg, idx) => (
                                  <span key={idx} className="bg-[var(--d-drawing-chip)] text-[var(--d-drawing-accent-bright)] px-1.5 py-0.5 rounded text-[10px]">
                                    #{tg}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-[var(--d-drawing-border-strong)] flex items-center justify-between">
                          <span className="text-[11px] text-muted font-mono">
                            {isDone
                              ? (isAr ? `✓ اكتمل في ${proj.completedDate}` : `✓ Completed ${proj.completedDate}`)
                              : (isAr ? `بدأ في ${proj.startedDate}` : `Started ${proj.startedDate}`)}
                          </span>

                          <button
                            onClick={() => {
                              handleSelectProjectForSession(proj.id);
                              setActiveTab('session');
                            }}
                            className="btn subtle small text-[var(--d-drawing-accent-strong)] border-[var(--d-drawing-border-accent)] hover:bg-[var(--d-drawing-chip)]"
                          >
                            <span>{isAr ? 'تسجيل جلسة' : 'Log Session'}</span>
                            <span>✏️</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARTWORK GALLERY */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] text-base">
                    {isAr ? 'معرض الأعمال والدراسات الفنية' : 'Artwork Archive & Gallery'}
                  </h3>
                  <p className="text-xs text-muted">
                    {isAr ? 'سجل رحلتك البصرية وتطور مستواك عبر الأيام.' : 'Your progressive visual journey over time.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Filter by Medium */}
                  <select
                    className="select text-xs py-1"
                    value={mediumFilter}
                    onChange={(e) => setMediumFilter(e.target.value)}
                  >
                    <option value="all">{isAr ? 'كل الوسائط' : 'All Mediums'}</option>
                    <option value="sketch">{isAr ? 'رصاص وفحم' : 'Pencil / Sketch'}</option>
                    <option value="ink">{isAr ? 'حبر' : 'Ink'}</option>
                    <option value="watercolor">{isAr ? 'مائي' : 'Watercolor'}</option>
                    <option value="digital">{isAr ? 'رقمي' : 'Digital'}</option>
                    <option value="acrylic">{isAr ? 'أكريليك' : 'Acrylic'}</option>
                  </select>

                  <button
                    onClick={() => setActiveTab('session')}
                    className="btn primary small bg-purple-600 hover:bg-purple-500"
                  >
                    + {isAr ? 'عمل جديد' : 'New Piece'}
                  </button>
                </div>
              </div>

              {filteredPieces.length === 0 ? (
                <div className="p-10 text-center panel border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-deep)] space-y-3 rounded-2xl">
                  <div className="text-3xl">🎨</div>
                  <strong className="text-[var(--text-primary)] block">{isAr ? 'لا توجد أعمال فنية مطابقة للفلاتر' : 'No artworks matching filter'}</strong>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    {isAr
                      ? 'سجّل أول سكتش أو لوحة اليوم لتراقب تدرج خطوطك وإبداعك.'
                      : 'Log your daily sketch or digital illustration to initiate your creative archive.'}
                  </p>
                  <button onClick={() => setActiveTab('session')} className="btn primary small bg-purple-600 mt-2">
                    {isAr ? 'توثيق أول عمل' : 'Record First Sketch'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredPieces.map((piece) => {
                    const meta = mediumMeta[piece.medium] || mediumMeta.sketch;
                    return (
                      <div
                        key={piece.id}
                        className="panel p-4 border border-[var(--d-drawing-border-strong)] bg-[var(--d-drawing-raised)] rounded-xl space-y-3 flex flex-col justify-between hover:border-purple-500/30 transition-all shadow-md"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${meta.badge}`}>
                              {meta.icon} {isAr ? meta.ar : meta.en}
                            </span>
                            <button
                              onClick={() => deleteArtworkPiece(habit.id, piece.id)}
                              className="text-muted hover:text-red-400 text-xs px-1"
                              title={isAr ? 'حذف العمل' : 'Delete'}
                            >
                              ✕
                            </button>
                          </div>

                          <h4 className="font-bold text-[var(--text-primary)] text-sm">{piece.title}</h4>
                          <span className="text-[11px] text-muted font-mono block mt-0.5">
                            {piece.completedDate} · {piece.durationMinutes} {isAr ? 'دقيقة' : 'mins'}
                          </span>

                          {piece.projectTitle && (
                            <span className="text-[11px] text-[var(--d-drawing-accent-strong)] font-medium block mt-1">
                              📂 {piece.projectTitle}
                            </span>
                          )}

                          {piece.promptTheme && (
                            <div className="mt-2 text-[11px] text-[var(--d-drawing-accent-strong)]/80 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                              ✦ {piece.promptTheme}
                            </div>
                          )}

                          {piece.notes && (
                            <p className="mt-2 text-xs text-muted/90 italic border-s-2 border-purple-500/40 ps-2 line-clamp-3">
                              "{piece.notes}"
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[var(--d-drawing-border-strong)] flex items-center justify-between text-[11px] text-muted">
                          <span>{isAr ? 'حالة التدفق' : 'Creative flow'}</span>
                          <span className="text-[var(--d-drawing-accent-strong)] font-mono font-medium">100% Depth</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal for Creating / Editing Project */}
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
            <div className="panel max-w-lg w-full p-5 border border-[var(--d-drawing-border-accent)] bg-[var(--d-drawing-raised)] rounded-2xl space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--d-drawing-border-strong)] pb-3">
                <h3 className="font-bold text-[var(--text-primary)] text-base">
                  {projectToEdit
                    ? (isAr ? 'تعديل المشروع الفني' : 'Edit Art Project')
                    : (isAr ? 'إنشاء مشروع فني جديد' : 'New Art Project')}
                </h3>
                <button
                  onClick={() => setIsProjectModalOpen(false)}
                  className="text-muted hover:text-[var(--text-primary)] text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4">
                <div className="field">
                  <label className="text-xs text-muted mb-1 block">
                    {isAr ? 'اسم المشروع' : 'Project Title'}
                  </label>
                  <input
                    type="text"
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    className="input w-full text-xs font-semibold"
                    placeholder={isAr ? 'مثال: مشهد أندلسي تراثي رقمي' : 'e.g. Neo-Gothic Architectural Sketchbook'}
                    required
                  />
                </div>

                <div className="field">
                  <label className="text-xs text-muted mb-1 block">
                    {isAr ? 'وصف المشروع وفكرته' : 'Description & Vision'}
                  </label>
                  <textarea
                    value={projDescription}
                    onChange={(e) => setProjDescription(e.target.value)}
                    rows={2}
                    className="input w-full text-xs"
                    placeholder={isAr ? 'خطة المشروع والهدف الفني منه...' : 'Vision notes, reference concepts...'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'الوسيط الأساسي' : 'Primary Medium'}
                    </label>
                    <select
                      className="select w-full text-xs"
                      value={projMedium}
                      onChange={(e) => setProjMedium(e.target.value as ArtMedium)}
                    >
                      <option value="sketch">{isAr ? '✏️ رصاص وفحم' : 'Pencil / Charcoal'}</option>
                      <option value="ink">{isAr ? '✒️ حبر وتحبير' : 'Ink'}</option>
                      <option value="watercolor">{isAr ? '🎨 ألوان مائية' : 'Watercolor'}</option>
                      <option value="digital">{isAr ? '💻 رسم رقمي' : 'Digital'}</option>
                      <option value="acrylic">{isAr ? '🖌️ أكريليك وزيتي' : 'Acrylic & Oil'}</option>
                      <option value="mixed">{isAr ? '✨ وسائط متعددة' : 'Mixed Media'}</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'المرحلة الأولية' : 'Starting Stage'}
                    </label>
                    <select
                      className="select w-full text-xs"
                      value={projStage}
                      onChange={(e) => setProjStage(e.target.value as ProjectStage)}
                    >
                      <option value="ideation">{isAr ? '1. فكرة وبحث' : '1. Ideation'}</option>
                      <option value="sketching">{isAr ? '2. سكتش أولي' : '2. Sketching'}</option>
                      <option value="inking">{isAr ? '3. تحبير' : '3. Inking'}</option>
                      <option value="coloring">{isAr ? '4. تلوين' : '4. Coloring'}</option>
                      <option value="polishing">{isAr ? '5. لمسات نهائية' : '5. Polishing'}</option>
                      <option value="completed">{isAr ? '6. مكتمل' : '6. Completed'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'لون شارة المشروع' : 'Badge Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={projThumbnailColor}
                        onChange={(e) => setProjThumbnailColor(e.target.value)}
                        className="w-10 h-8 rounded border border-[var(--d-drawing-border-accent)] cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted">{projThumbnailColor}</span>
                    </div>
                  </div>

                  <div className="field">
                    <label className="text-xs text-muted mb-1 block">
                      {isAr ? 'وسوم (مفصولة بفواصل)' : 'Tags (comma separated)'}
                    </label>
                    <input
                      type="text"
                      value={projTags}
                      onChange={(e) => setProjTags(e.target.value)}
                      className="input w-full text-xs"
                      placeholder="Anatomy, Portrait, Digital"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--d-drawing-border-strong)]">
                  <button
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="btn subtle text-xs"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" className="btn primary small bg-purple-600 hover:bg-purple-500">
                    {projectToEdit ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء المشروع' : 'Create Project')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

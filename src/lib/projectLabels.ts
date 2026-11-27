/**
 * Projects vocabulary, in one place.
 *
 * Every user-visible string for the Projects section lives here rather than inline in
 * the views, so the Arabic and English read as the same product and a wording change
 * cannot land in one screen but not another.
 */

import type { IconName } from '../components/NuqtaIcon';
import type { ProjectCategory, ProjectNoteKind, ProjectStatus, ProjectStepStatus } from '../types';
import type { ProjectHealth } from './projectProgress';

export interface Label {
  ar: string;
  en: string;
}

export const statusLabel: Record<ProjectStatus, Label> = {
  planned: { ar: 'مخطَّط', en: 'Planned' },
  active: { ar: 'قيد التنفيذ', en: 'Active' },
  on_hold: { ar: 'متوقّف مؤقتاً', en: 'On hold' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  archived: { ar: 'مؤرشف', en: 'Archived' }
};

export const statusIcon: Record<ProjectStatus, IconName> = {
  planned: 'compass',
  active: 'rocket',
  on_hold: 'pause',
  completed: 'check',
  archived: 'archive'
};

/** Tone token suffix, so the badge colour follows the status rather than a hash. */
export const statusTone: Record<ProjectStatus, string> = {
  planned: 'info',
  active: 'brand',
  on_hold: 'warning',
  completed: 'success',
  archived: 'neutral'
};

export const categoryLabel: Record<ProjectCategory, Label & { icon: IconName }> = {
  personal: { ar: 'شخصي', en: 'Personal', icon: 'user' },
  learning: { ar: 'تعلّم', en: 'Learning', icon: 'book-open' },
  creative: { ar: 'إبداعي', en: 'Creative', icon: 'palette' },
  technical: { ar: 'تقني', en: 'Technical', icon: 'blocks' },
  financial: { ar: 'مالي', en: 'Financial', icon: 'wallet' },
  administrative: { ar: 'إداري', en: 'Administrative', icon: 'briefcase' },
  other: { ar: 'أخرى', en: 'Other', icon: 'layers' }
};

export const stepStatusLabel: Record<ProjectStepStatus, Label> = {
  open: { ar: 'مفتوحة', en: 'Open' },
  done: { ar: 'منجزة', en: 'Done' },
  blocked: { ar: 'متعطّلة', en: 'Blocked' }
};

export const noteKindLabel: Record<ProjectNoteKind, Label & { icon: IconName }> = {
  note: { ar: 'ملاحظة', en: 'Note', icon: 'notebook' },
  idea: { ar: 'فكرة', en: 'Idea', icon: 'sparkle' },
  decision: { ar: 'قرار', en: 'Decision', icon: 'flag' },
  question: { ar: 'سؤال مفتوح', en: 'Open question', icon: 'compass' },
  research: { ar: 'بحث', en: 'Research', icon: 'search' },
  meeting: { ar: 'اجتماع', en: 'Meeting', icon: 'user' },
  observation: { ar: 'ملاحظة ميدانية', en: 'Observation', icon: 'eye' }
};

export const healthLabel: Record<ProjectHealth, Label> = {
  on_track: { ar: 'على المسار', en: 'On track' },
  at_risk: { ar: 'معرَّض للخطر', en: 'At risk' },
  stalled: { ar: 'متوقّف', en: 'Stalled' },
  complete: { ar: 'مكتمل', en: 'Complete' },
  unknown: { ar: 'لا توجد إشارات', en: 'No signals' }
};

export const healthTone: Record<ProjectHealth, string> = {
  on_track: 'success',
  at_risk: 'danger',
  stalled: 'warning',
  complete: 'success',
  unknown: 'neutral'
};

/** Chrome strings for the two project screens. */
export const ui = {
  hubEyebrow: { ar: 'نُقطة / المشاريع', en: 'NUQTA / PROJECTS' },
  hubTitle: { ar: 'المشاريع', en: 'Projects' },
  hubDescription: {
    ar: 'كل مشروع يجمع مراحله وخطواته وملاحظاته وموارده في مكان واحد، ويرتبط بمهامك وأهدافك بدل أن ينسخها.',
    en: 'Each project gathers its phases, steps, notes and resources in one place, and links to your tasks and goals instead of copying them.'
  },
  newProject: { ar: 'مشروع جديد', en: 'New project' },
  searchPlaceholder: { ar: 'ابحث في المشاريع...', en: 'Search projects...' },
  noProjects: { ar: 'لا توجد مشاريع بعد', en: 'No projects yet' },
  noProjectsBody: {
    ar: 'المشروع هو عمل له بداية ونهاية. أنشئ واحداً لتحويل هدف كبير إلى مراحل وخطوات قابلة للتنفيذ.',
    en: 'A project is a body of work with a beginning and an end. Create one to turn a large goal into phases and executable steps.'
  },
  noMatch: { ar: 'لا توجد مشاريع مطابقة', en: 'No matching projects' },
  noMatchBody: {
    ar: 'جرّب تغيير الفلتر أو كلمة البحث.',
    en: 'Try a different filter or search term.'
  },
  back: { ar: 'كل المشاريع', en: 'All projects' },
  tabs: {
    overview: { ar: 'نظرة عامة', en: 'Overview' },
    plan: { ar: 'الخطة', en: 'Plan' },
    notes: { ar: 'الملاحظات والأفكار', en: 'Notes & Ideas' },
    timeline: { ar: 'الجدول الزمني', en: 'Timeline' },
    resources: { ar: 'الموارد', en: 'Resources' },
    activity: { ar: 'النشاط', en: 'Activity' }
  },
  progress: { ar: 'التقدّم', en: 'Progress' },
  progressFromSteps: { ar: 'محسوب من الخطوات', en: 'From steps' },
  progressFromTasks: { ar: 'محسوب من المهام', en: 'From tasks' },
  progressManual: { ar: 'تقدير يدوي', en: 'Manual estimate' },
  progressNone: { ar: 'لا توجد خطوات أو مهام بعد', en: 'No steps or tasks yet' },
  nextAction: { ar: 'الخطوة التالية', en: 'Next action' },
  noNextAction: { ar: 'لم تُحدَّد خطوة تالية', en: 'No next action defined' },
  phases: { ar: 'المراحل', en: 'Phases' },
  steps: { ar: 'الخطوات', en: 'Steps' },
  tasks: { ar: 'المهام', en: 'Tasks' },
  notes: { ar: 'الملاحظات', en: 'Notes' },
  goals: { ar: 'الأهداف المرتبطة', en: 'Linked goals' },
  addPhase: { ar: 'إضافة مرحلة', en: 'Add phase' },
  addStep: { ar: 'إضافة خطوة', en: 'Add step' },
  addNote: { ar: 'إضافة ملاحظة', en: 'Add note' },
  addResource: { ar: 'إضافة مورد', en: 'Add resource' },
  markDone: { ar: 'إنجاز', en: 'Mark done' },
  reopen: { ar: 'إعادة فتح', en: 'Reopen' },
  block: { ar: 'تعطيل', en: 'Block' },
  delete: { ar: 'حذف', en: 'Delete' },
  emptyPlan: { ar: 'لا توجد مراحل أو خطوات بعد', en: 'No phases or steps yet' },
  emptyPlanBody: {
    ar: 'قسّم المشروع إلى مراحل، ثم أضف خطوات قابلة للتنفيذ داخل كل مرحلة.',
    en: 'Split the project into phases, then add executable steps inside each phase.'
  },
  emptyNotes: { ar: 'لا توجد ملاحظات بعد', en: 'No notes yet' },
  emptyNotesBody: {
    ar: 'سجّل الأفكار والقرارات والأسئلة المفتوحة. الفكرة يمكن تحويلها لاحقاً إلى خطوة أو مهمة.',
    en: 'Record ideas, decisions and open questions. An idea can later become a step or a task.'
  },
  emptyResources: { ar: 'لا توجد موارد بعد', en: 'No resources yet' },
  emptyResourcesBody: {
    ar: 'أضف روابط أو ملفات أو مراجع يحتاجها المشروع.',
    en: 'Add links, files or references the project needs.'
  },
  emptyActivity: { ar: 'لا يوجد نشاط مسجَّل', en: 'No recorded activity' },
  emptyActivityBody: {
    ar: 'يُسجَّل النشاط بدءاً من الآن: تغيير الحالة، وإنجاز الخطوات، وتحويل الأفكار.',
    en: 'Activity is recorded from now on: status changes, completed steps and converted ideas.'
  },
  emptyTasks: { ar: 'لا توجد مهام مرتبطة', en: 'No linked tasks' },
  emptyTasksBody: {
    ar: 'اربط مهمة موجودة من قسم المهام، أو حوّل فكرة إلى مهمة من تبويب الملاحظات.',
    en: 'Link an existing task from the Tasks section, or turn an idea into a task from Notes.'
  },
  emptyGoals: { ar: 'لا يوجد هدف مرتبط', en: 'No linked goal' },
  emptyGoalsBody: {
    ar: 'اربط المشروع بهدف لترى كيف يخدم هذا العمل رؤيتك الكبرى.',
    en: 'Link the project to a goal to show how this work serves the bigger picture.'
  },
  emptyTimeline: { ar: 'لا توجد تواريخ محددة', en: 'No dates set' },
  emptyTimelineBody: {
    ar: 'حدّد تاريخ بداية أو هدفاً زمنياً للمشروع أو لمرحلة منه ليظهر على الخط الزمني.',
    en: 'Set a start date or a target date for the project or a phase to see it on the timeline.'
  },
  deleteProjectTitle: { ar: 'حذف المشروع؟', en: 'Delete project?' },
  deleteProjectBody: {
    ar: 'ستُحذف مراحل المشروع وخطواته وملاحظاته. المهام المرتبطة لن تُحذف، لكنها ستفقد الارتباط بالمشروع.',
    en: 'The project’s phases, steps and notes will be removed. Linked tasks are kept, but lose their link to the project.'
  },
  convertToStep: { ar: 'تحويل إلى خطوة', en: 'Turn into step' },
  convertToTask: { ar: 'تحويل إلى مهمة', en: 'Turn into task' },
  convertedToStep: { ar: 'حُوّلت إلى خطوة', en: 'Converted to a step' },
  convertedToTask: { ar: 'حُوّلت إلى مهمة', en: 'Converted to a task' },
  overdue: { ar: 'متأخر', en: 'Overdue' },
  dueToday: { ar: 'اليوم', en: 'Today' },
  manualOverride: { ar: 'تقدير يدوي', en: 'Manual' },
  clearOverride: { ar: 'رجوع إلى الحساب التلقائي', en: 'Use derived value' }
} as const;

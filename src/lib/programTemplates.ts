import { TrainingSplit, ProgramGoal } from '../types';

/**
 * Starting points for the Program Builder.
 *
 * A template is only a skeleton of *named days* — the user fills each day from
 * the exercise library. This keeps templates flexible (no forced prescriptions)
 * while removing the blank-page problem for the common splits.
 */

export interface ProgramTemplateDay {
  name: string;
  nameAr: string;
  focus?: string;
  isRest?: boolean;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  split: TrainingSplit;
  goal: ProgramGoal;
  days: ProgramTemplateDay[];
}

const day = (name: string, nameAr: string, focus?: string, isRest?: boolean): ProgramTemplateDay => ({
  name,
  nameAr,
  focus,
  isRest
});

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'tpl-full-body-3',
    name: 'Full body · 3 days',
    nameAr: 'الجسم كامل · ٣ أيام',
    description: 'Three balanced full-body sessions with recovery days between.',
    descriptionAr: 'ثلاث حصص متوازنة للجسم كامل مع أيام راحة بينها.',
    split: 'full_body',
    goal: 'general',
    days: [day('Full body A', 'الجسم كامل أ', 'Full body'), day('Rest', 'راحة', undefined, true), day('Full body B', 'الجسم كامل ب', 'Full body'), day('Rest', 'راحة', undefined, true), day('Full body C', 'الجسم كامل ج', 'Full body'), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true)]
  },
  {
    id: 'tpl-upper-lower-4',
    name: 'Upper / Lower · 4 days',
    nameAr: 'أعلى / أسفل · ٤ أيام',
    description: 'Two upper and two lower sessions — a proven strength-hypertrophy base.',
    descriptionAr: 'حصتان للجزء العلوي وحصتان للسفلي — أساس مثالي للقوة والتضخيم.',
    split: 'upper_lower',
    goal: 'hypertrophy',
    days: [day('Upper A', 'الجزء العلوي أ', 'Upper'), day('Lower A', 'الجزء السفلي أ', 'Lower'), day('Rest', 'راحة', undefined, true), day('Upper B', 'الجزء العلوي ب', 'Upper'), day('Lower B', 'الجزء السفلي ب', 'Lower'), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true)]
  },
  {
    id: 'tpl-ppl-6',
    name: 'Push · Pull · Legs · 6 days',
    nameAr: 'دفع · سحب · أرجل · ٦ أيام',
    description: 'The classic PPL run twice per week for higher frequency.',
    descriptionAr: 'تقسيم دفع/سحب/أرجل الكلاسيكي مرتين أسبوعياً لزيادة التكرار.',
    split: 'ppl',
    goal: 'hypertrophy',
    days: [day('Push A', 'دفع أ', 'Push'), day('Pull A', 'سحب أ', 'Pull'), day('Legs A', 'أرجل أ', 'Legs'), day('Push B', 'دفع ب', 'Push'), day('Pull B', 'سحب ب', 'Pull'), day('Legs B', 'أرجل ب', 'Legs'), day('Rest', 'راحة', undefined, true)]
  },
  {
    id: 'tpl-ppl-3',
    name: 'Push · Pull · Legs · 3 days',
    nameAr: 'دفع · سحب · أرجل · ٣ أيام',
    description: 'One pass through PPL each week — great for beginners or busy weeks.',
    descriptionAr: 'دورة واحدة أسبوعياً من دفع/سحب/أرجل — مناسبة للمبتدئين أو الأسابيع المزدحمة.',
    split: 'ppl',
    goal: 'general',
    days: [day('Push', 'دفع', 'Push'), day('Pull', 'سحب', 'Pull'), day('Legs', 'أرجل', 'Legs'), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true)]
  },
  {
    id: 'tpl-mobility-3',
    name: 'Mobility & core · 3 days',
    nameAr: 'مرونة وجذع · ٣ أيام',
    description: 'Short mobility and core sessions to complement any program.',
    descriptionAr: 'حصص قصيرة للمرونة والجذع تكمّل أي برنامج.',
    split: 'custom',
    goal: 'mobility',
    days: [day('Mobility flow', 'تدفق مرونة', 'Mobility'), day('Rest', 'راحة', undefined, true), day('Core & stability', 'الجذع والثبات', 'Core'), day('Rest', 'راحة', undefined, true), day('Mobility flow', 'تدفق مرونة', 'Mobility'), day('Rest', 'راحة', undefined, true), day('Rest', 'راحة', undefined, true)]
  }
];

export const templateById = (id: string): ProgramTemplate | undefined => PROGRAM_TEMPLATES.find((t) => t.id === id);

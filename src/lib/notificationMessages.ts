/**
 * Notification copy.
 *
 * Notifications are rendered from a `messageId` plus params rather than only storing a
 * finished sentence. That matters because a stored notification outlives the language it
 * was created in: switching NUQTA to Arabic must not leave a week of English rows behind.
 * The resolved `title`/`body` are still stored on the record, so a notification whose id
 * is not in this table (or one authored by future code) still renders fine.
 */

export type NotificationMessageId =
  | 'task.due'
  | 'task.overdue'
  | 'habit.morning'
  | 'habit.evening'
  | 'focus.complete'
  | 'goal.milestone'
  | 'goal.completed'
  | 'health.hydration'
  | 'finance.savings'
  | 'system.welcome'
  | 'system.storageFull'
  | 'system.test';

export interface NotificationText {
  title: string;
  body?: string;
}

type Renderer = (params: Record<string, string | number | boolean>) => NotificationText;

const str = (v: string | number | boolean | undefined, fallback = ''): string =>
  v === undefined || v === null ? fallback : String(v);

const EN: Record<NotificationMessageId, Renderer> = {
  'task.due': (p) => ({
    title: `Task due: ${str(p.title)}`,
    body: p.priority ? `Priority ${str(p.priority)} · estimated ${str(p.estimatedMinutes, '25')}m` : undefined
  }),
  'task.overdue': (p) => ({
    title: `Overdue: ${str(p.title)}`,
    body: p.daysLate ? `Scheduled ${str(p.daysLate)} day(s) ago.` : undefined
  }),
  'habit.morning': (p) => ({
    title: 'Morning habit ritual',
    body: `You have ${str(p.count)} morning habit(s) ready, starting with ${str(p.first)}.`
  }),
  'habit.evening': () => ({
    title: 'Evening wind-down',
    body: 'Review what went well today and clear your mind before sleep.'
  }),
  'focus.complete': (p) => ({
    title: 'Focus session complete',
    body: p.minutes ? `${str(p.minutes)} minutes of deep work banked.` : undefined
  }),
  'goal.milestone': (p) => ({
    title: `Milestone reached: ${str(p.title)}`,
    body: p.goal ? `Part of "${str(p.goal)}".` : undefined
  }),
  'goal.completed': (p) => ({
    title: `Goal completed: ${str(p.title)}`,
    body: 'Every key result is done. Take a moment to mark the win.'
  }),
  'health.hydration': (p) => ({
    title: 'Hydration check',
    body: `You are at ${str(p.current)} of ${str(p.target)} ml today.`
  }),
  'finance.savings': (p) => ({
    title: `Savings goal reached: ${str(p.title)}`,
    body: 'You hit the amount you set for this goal.'
  }),
  'system.welcome': () => ({
    title: 'Notifications are on',
    body: 'Your reminders will appear here, inside NUQTA, whether or not the app is open.'
  }),
  'system.storageFull': () => ({
    title: 'Changes could not be saved',
    body: 'Local storage may be full. Export a backup from Settings to keep your data safe.'
  }),
  'system.test': () => ({
    title: 'Test notification',
    body: 'This is how a NUQTA notification looks.'
  })
};

const AR: Record<NotificationMessageId, Renderer> = {
  'task.due': (p) => ({
    title: `حان وقت المهمة: ${str(p.title)}`,
    body: p.priority ? `الأولوية ${str(p.priority)} · الوقت المتوقع ${str(p.estimatedMinutes, '25')} دقيقة` : undefined
  }),
  'task.overdue': (p) => ({
    title: `متأخرة: ${str(p.title)}`,
    body: p.daysLate ? `كانت مجدولة قبل ${str(p.daysLate)} يوم.` : undefined
  }),
  'habit.morning': (p) => ({
    title: 'طاقة الصباح والعادات',
    body: `لديك ${str(p.count)} عادات صباحية جاهزة، نبدأ بـ ${str(p.first)}.`
  }),
  'habit.evening': () => ({
    title: 'جلسة الهدوء واليوميات',
    body: 'سجّل ما سار على ما يرام اليوم، وامنح عقلك صفاءً قبل النوم.'
  }),
  'focus.complete': (p) => ({
    title: 'اكتملت جلسة التركيز',
    body: p.minutes ? `${str(p.minutes)} دقيقة من العمل العميق.` : undefined
  }),
  'goal.milestone': (p) => ({
    title: `تحقق إنجاز: ${str(p.title)}`,
    body: p.goal ? `ضمن هدف "${str(p.goal)}".` : undefined
  }),
  'goal.completed': (p) => ({
    title: `اكتمل الهدف: ${str(p.title)}`,
    body: 'كل النتائج الرئيسية منجزة. خذ لحظة لتحتفي بالإنجاز.'
  }),
  'health.hydration': (p) => ({
    title: 'تذكير بشرب الماء',
    body: `أنجزت ${str(p.current)} من ${str(p.target)} مل اليوم.`
  }),
  'finance.savings': (p) => ({
    title: `بلغت هدف الادخار: ${str(p.title)}`,
    body: 'وصلت إلى المبلغ الذي حددته لهذا الهدف.'
  }),
  'system.welcome': () => ({
    title: 'الإشعارات مفعّلة',
    body: 'ستظهر تنبيهاتك هنا داخل نقطة، سواء كان التطبيق مفتوحاً أو لا.'
  }),
  'system.storageFull': () => ({
    title: 'تعذّر حفظ التغييرات',
    body: 'قد تكون مساحة التخزين ممتلئة. صدّر نسخة احتياطية من الإعدادات لحماية بياناتك.'
  }),
  'system.test': () => ({
    title: 'إشعار تجريبي',
    body: 'هكذا يبدو الإشعار في نقطة.'
  })
};

/** True when the id is one this module knows how to re-render. */
export function isKnownMessageId(id: string): id is NotificationMessageId {
  return Object.prototype.hasOwnProperty.call(EN, id);
}

/**
 * Resolve a notification's copy in the requested language.
 *
 * Falls back to the stored strings whenever the id is unknown or a renderer throws, so a
 * rendering problem can never blank out a notification the user already received.
 */
export function renderNotificationText(
  messageId: string | undefined,
  params: Record<string, string | number | boolean> | undefined,
  stored: NotificationText,
  isAr: boolean
): NotificationText {
  if (!messageId || !isKnownMessageId(messageId)) return stored;
  try {
    const table = isAr ? AR : EN;
    const rendered = table[messageId](params || {});
    return { title: rendered.title || stored.title, body: rendered.body ?? stored.body };
  } catch {
    return stored;
  }
}

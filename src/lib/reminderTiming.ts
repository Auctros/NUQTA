/** Minutes since midnight for "HH:mm", or null if malformed. */
export function minutesOfDay(hhmm: string | undefined | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * A reminder is due once its time has arrived and stays due for `windowMinutes`.
 * Matching the exact minute misses reminders whenever the browser throttles timers
 * (background tabs, sleeping laptop); a catch-up window delivers them late instead.
 * De-duplication is the caller's job.
 */
export function isReminderDue(
  scheduledTime: string | undefined | null,
  nowMinutes: number,
  windowMinutes = 15
): boolean {
  const at = minutesOfDay(scheduledTime);
  if (at === null) return false;
  return nowMinutes >= at && nowMinutes - at <= windowMinutes;
}

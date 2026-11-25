import { localDateKey } from './dateKey';
import { isReminderDue } from './reminderTiming';
import { isHabitDueOn } from './habitSchedule';
import { isTaskPending } from './taskStatus';
import { useEffect, useRef } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { renderNotificationText } from './notificationMessages';
import type { NotificationDraft } from './notificationEngine';

/** Eisenhower quadrants, spelled out for the notification body. */
const PRIORITY_LABEL_EN: Record<number, string> = {
  1: 'Urgent & important',
  2: 'Important',
  3: 'Urgent',
  4: 'Neither'
};
const PRIORITY_LABEL_AR: Record<number, string> = {
  1: 'عاجل ومهم',
  2: 'مهم',
  3: 'عاجل',
  4: 'غير عاجل وغير مهم'
};

/**
 * Monitors tasks and the habit schedule, raising an in-app notification when something
 * becomes due.
 *
 * Only items that are actually *due today* fire: a pending task scheduled for today, a
 * habit whose schedule says it is due today, or a recurring task whose occurrence lands on
 * today. Off-schedule days never nudge.
 *
 * De-duplication is owned by the notification engine, not by this hook: the `dedupeKey`
 * is stable per occurrence, so the 20-second ticker cannot repeat a reminder and a reload
 * cannot re-notify something the user already saw. The ref is only a cheap short-circuit
 * so one tick does not rebuild copy for something it just raised.
 */
export function useNuqtaReminders() {
  const tasks = useNuqtaStore((s) => s.tasks);
  const habits = useNuqtaStore((s) => s.habits);
  const isAr = useNuqtaStore((s) => s.profile.language === 'ar');
  const notify = useNuqtaStore((s) => s.notify);
  const raisedThisSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const todayStr = localDateKey(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const raise = (dedupeKey: string, build: () => NotificationDraft | null) => {
        if (raisedThisSession.current.has(dedupeKey)) return;
        const draft = build();
        if (!draft) return;
        raisedThisSession.current.add(dedupeKey);
        notify(draft);
      };

      // 1. Task reminders — pending tasks scheduled for today at their due time.
      tasks.forEach((task) => {
        if (
          !isTaskPending(task) ||
          task.scheduledDate !== todayStr ||
          !isReminderDue(task.scheduledTime, nowMinutes)
        ) {
          return;
        }
        const dedupeKey = `task:${task.id}:due:${todayStr}:${task.scheduledTime}`;
        raise(dedupeKey, () => {
          const params = {
            title: task.title,
            priority: isAr ? PRIORITY_LABEL_AR[task.priority] : PRIORITY_LABEL_EN[task.priority],
            estimatedMinutes: task.estimatedMinutes || 25
          };
          const text = renderNotificationText('task.due', params, { title: task.title }, isAr);
          return {
            category: 'task',
            // Eisenhower 1–2 are the quadrants worth interrupting for.
            priority: task.priority <= 2 ? 'high' : 'normal',
            title: text.title,
            body: text.body,
            route: { nav: 'tasks', entityId: task.id },
            actionLabel: isAr ? 'افتح المهمة' : 'Open task',
            dedupeKey,
            messageId: 'task.due',
            params
          };
        });
      });

      // 2. Morning habit cue (08:00) — only habits actually due today.
      if (isReminderDue('08:00', nowMinutes)) {
        const morningHabits = habits.filter(
          (h) =>
            h.timeOfDay === 'morning' &&
            !h.isArchived &&
            h.status !== 'archived' &&
            h.status !== 'paused' &&
            isHabitDueOn(h, todayStr) &&
            !h.completedDates.includes(todayStr)
        );
        if (morningHabits.length > 0) {
          const dedupeKey = `habit:morning:${todayStr}`;
          raise(dedupeKey, () => {
            const params = { count: morningHabits.length, first: morningHabits[0].name };
            const text = renderNotificationText('habit.morning', params, { title: morningHabits[0].name }, isAr);
            return {
              category: 'habit',
              priority: 'normal',
              title: text.title,
              body: text.body,
              route: { nav: 'habits' },
              actionLabel: isAr ? 'افتح العادات' : 'Open habits',
              dedupeKey,
              messageId: 'habit.morning',
              params
            };
          });
        }
      }

      // 3. Evening reflection (20:30).
      if (isReminderDue('20:30', nowMinutes)) {
        const dedupeKey = `habit:evening:${todayStr}`;
        raise(dedupeKey, () => {
          const text = renderNotificationText('habit.evening', {}, { title: '' }, isAr);
          return {
            category: 'habit',
            priority: 'low',
            title: text.title,
            body: text.body,
            route: { nav: 'journal' },
            actionLabel: isAr ? 'افتح اليوميات' : 'Open journal',
            dedupeKey,
            messageId: 'habit.evening'
          };
        });
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 20000);
    return () => clearInterval(interval);
  }, [tasks, habits, isAr, notify]);
}

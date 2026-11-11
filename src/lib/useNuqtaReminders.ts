import { localDateKey } from './dateKey';
import { isReminderDue } from './reminderTiming';
import { useEffect, useRef } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaNotificationEngine } from './notifications';

/**
 * Hook to monitor tasks and habit schedule intervals,
 * emitting ambient notifications and synth audio chimes when due.
 */
export function useNuqtaReminders() {
  const { tasks, habits, profile } = useNuqtaStore();
  const firedRemindersRef = useRef<Set<string>>(new Set());

  const isAr = profile.language === 'ar';

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const todayStr = localDateKey(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // 1. Task Reminders
      tasks.forEach((task) => {
        if (
          task.status !== 'completed' &&
          task.scheduledDate === todayStr &&
          isReminderDue(task.scheduledTime, nowMinutes)
        ) {
          const key = `task-${task.id}-${todayStr}-${task.scheduledTime}`;
          if (!firedRemindersRef.current.has(key)) {
            firedRemindersRef.current.add(key);
            NuqtaNotificationEngine.notify({
              title: isAr ? `حان وقت المهمة: ${task.title}` : `Task Due: ${task.title}`,
              body: isAr
                ? `الأولوية ${task.priority} · الوقت المتوقع: ${task.estimatedMinutes || 25} دقيقة`
                : `Priority ${task.priority} · Estimated: ${task.estimatedMinutes || 25}m`,
              tag: `task-${task.id}`,
              chime: 'task-reminder'
            });
          }
        }
      });

      // 2. Morning Habit Cue (default 08:00 AM)
      if (isReminderDue('08:00', nowMinutes)) {
        const key = `habit-morning-${todayStr}`;
        if (!firedRemindersRef.current.has(key)) {
          firedRemindersRef.current.add(key);
          const morningHabits = habits.filter(
            (h) => h.timeOfDay === 'morning' && !h.completedDates.includes(todayStr)
          );
          if (morningHabits.length > 0) {
            NuqtaNotificationEngine.notify({
              title: isAr ? 'طاقة الصباح والعادات' : 'Morning Habit Ritual',
              body: isAr
                ? `لديك ${morningHabits.length} عادات صباحية جاهزة للانطلاق: ${morningHabits[0].name}`
                : `You have ${morningHabits.length} morning habits ready: ${morningHabits[0].name}`,
              tag: 'morning-habits',
              chime: 'habit-cue'
            });
          }
        }
      }

      // 3. Evening Reflection & Habit Cue (default 20:30 PM)
      if (isReminderDue('20:30', nowMinutes)) {
        const key = `habit-evening-${todayStr}`;
        if (!firedRemindersRef.current.has(key)) {
          firedRemindersRef.current.add(key);
          NuqtaNotificationEngine.notify({
            title: isAr ? 'جلسة الهدوء واليوميات' : 'Evening Wind-down & Journal',
            body: isAr
              ? 'سجّل ما سار على ما يرام اليوم، وامنح عقلك صفاءً قبل النوم.'
              : 'Review what went well today and clear your mind before sleep.',
            tag: 'evening-ritual',
            chime: 'gentle-bell'
          });
        }
      }
    };

    // Initial check and periodic ticker every 20 seconds
    checkSchedule();
    const interval = setInterval(checkSchedule, 20000);
    return () => clearInterval(interval);
  }, [tasks, habits, isAr]);
}

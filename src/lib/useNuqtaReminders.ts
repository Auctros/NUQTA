import { useEffect, useRef } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaNotificationEngine } from './notifications';
import { localDateKey } from './storage';

/**
 * Hook to monitor tasks and habit schedule intervals,
 * emitting ambient notifications and synth audio chimes when due.
 *
 * Reminder logic: fires when current time >= scheduled time and the reminder
 * hasn't fired yet today. This avoids missing reminders due to tab throttling
 * or exact-minute matching.
 */
export function useNuqtaReminders() {
  const { tasks, habits, profile } = useNuqtaStore();
  const firedRemindersRef = useRef<Set<string>>(new Set());

  const isAr = profile.language === 'ar';

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const todayStr = localDateKey(now);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentHHmm = `${hours}:${minutes}`;

      // 1. Task Reminders — fire when current time >= scheduled time
      tasks.forEach((task) => {
        if (
          task.status !== 'completed' &&
          task.scheduledDate === todayStr &&
          task.scheduledTime &&
          currentHHmm >= task.scheduledTime
        ) {
          const key = `task-${task.id}-${todayStr}`;
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
      if (currentHHmm >= '08:00' && currentHHmm < '08:01') {
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
      if (currentHHmm >= '20:30' && currentHHmm < '20:31') {
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

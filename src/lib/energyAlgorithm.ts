import { HealthMetric, Task } from '../types';

/**
 * Biological Energy Calculation Algorithm
 * Combines sleep quality, hydration deficit, workout status, mood, and pending urgent cognitive load.
 * Returns a normalized score between 10 and 100.
 */
export function computeDailyEnergyScore(health: HealthMetric, tasks: Task[]): number {
  let score = 50;

  // 1. Sleep duration impact (optimal 7 - 9 hrs)
  if (health.sleepHours >= 7 && health.sleepHours <= 8.5) {
    score += 20;
  } else if (health.sleepHours > 8.5) {
    score += 15;
  } else if (health.sleepHours >= 6) {
    score += 5;
  } else {
    // Under 6 hours is heavily penalizing
    score -= 20;
  }

  // 2. Sleep subjective quality (1 to 5)
  score += (health.sleepQuality - 3) * 5;

  // 3. Hydration progress (target ~2500ml)
  const hydrationPct = Math.min(1.2, health.hydrationMl / (health.targetHydrationMl || 2500));
  if (hydrationPct >= 0.8) {
    score += 10;
  } else if (hydrationPct < 0.4) {
    score -= 10;
  }

  // 4. Workout endorphins
  if (health.workoutLogged) {
    score += 8;
  }

  // 5. Subjective mood (1 to 5)
  score += (health.moodRating - 3) * 4;

  // 6. Cognitive strain: Completed tasks restore feeling of momentum; urgent pending drain energy
  const todayStr = new Date().toISOString().split('T')[0];
  const completedToday = tasks.filter(
    (t) => t.status === 'completed' && t.completedAt?.startsWith(todayStr)
  ).length;

  const urgentPending = tasks.filter(
    (t) => t.status === 'todo' && t.priority === 1 && (!t.scheduledDate || t.scheduledDate <= todayStr)
  ).length;

  score += Math.min(15, completedToday * 3);
  score -= Math.min(20, urgentPending * 5);

  return Math.min(100, Math.max(10, Math.round(score)));
}

/**
 * Heuristic Smart Rescheduler:
 * When tasks are overdue or skipped, suggests realistic slots based on energy levels and historical load.
 */
export function suggestSmartReschedule(
  overdueTasks: Task[],
  currentEnergyScore: number
): { taskId: string; proposedDate: string; reason: string }[] {
  const suggestions: { taskId: string; proposedDate: string; reason: string }[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const inTwoDaysStr = inTwoDays.toISOString().split('T')[0];

  overdueTasks.forEach((task) => {
    if (task.energyLevelRequired === 'high' && currentEnergyScore < 60) {
      suggestions.push({
        taskId: task.id,
        proposedDate: tomorrowStr,
        reason: 'Current biological energy is under 60%. Defer high-cognitive load to tomorrow morning.'
      });
    } else if (task.priority >= 3) {
      suggestions.push({
        taskId: task.id,
        proposedDate: inTwoDaysStr,
        reason: 'Low urgency task. Batch into open buffer slot later this week.'
      });
    } else {
      suggestions.push({
        taskId: task.id,
        proposedDate: tomorrowStr,
        reason: 'Keep priority focus anchor for start of next day.'
      });
    }
  });

  return suggestions;
}


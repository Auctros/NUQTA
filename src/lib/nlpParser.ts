import { PriorityLevel } from '../types';

export interface ParsedTaskDraft {
  title: string;
  scheduledDate?: string;
  scheduledTime?: string;
  estimatedMinutes?: number;
  priority: PriorityLevel;
  tags: string[];
  energyLevelRequired?: 'low' | 'medium' | 'high';
}

/**
 * High-performance, zero-latency natural language parser.
 * Handles inputs like:
 * "Pitch deck revision tomorrow at 3pm for 90m !high #work #strategy"
 * "Walk in the park today for 30m !p3 #health"
 * "Review pull request at 14:00 #dev"
 */
export function parseNaturalLanguageTask(raw: string): ParsedTaskDraft {
  let text = raw.trim();
  const tags: string[] = [];
  let priority: PriorityLevel = 4;
  let estimatedMinutes = 30;
  let scheduledDate: string | undefined = undefined;
  let scheduledTime: string | undefined = undefined;
  let energyLevelRequired: 'low' | 'medium' | 'high' = 'medium';

  const now = new Date();
  const todayStr = formatDate(now);

  // 1. Tags extraction (#work, #health, etc.)
  text = text.replace(/#([\w\u0600-\u06FF-]+)/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return '';
  });

  // 2. Priority extraction (!p1, !p2, !high, !urgent, !low)
  if (/!(p1|high|urgent|vital)/i.test(text)) {
    priority = 1;
    text = text.replace(/!(p1|high|urgent|vital)/gi, '');
  } else if (/!(p2|medium|med|important)/i.test(text)) {
    priority = 2;
    text = text.replace(/!(p2|medium|med|important)/gi, '');
  } else if (/!(p3|low)/i.test(text)) {
    priority = 3;
    text = text.replace(/!(p3|low)/gi, '');
  } else if (/!(p4|someday)/i.test(text)) {
    priority = 4;
    text = text.replace(/!(p4|someday)/gi, '');
  }

  // 3. Energy tag extraction (!energy:high, !deep, !quick)
  if (/!(deep|deepwork|high-energy)/i.test(text)) {
    energyLevelRequired = 'high';
    text = text.replace(/!(deep|deepwork|high-energy)/gi, '');
  } else if (/!(quick|low-energy|light)/i.test(text)) {
    energyLevelRequired = 'low';
    text = text.replace(/!(quick|low-energy|light)/gi, '');
  }

  // 4. Duration parser ("for 45m", "for 1.5h", "for 90 min", "for 2 hours")
  const durMatch = text.match(/\bfor\s+(\d+(\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hours?)\b/i);
  if (durMatch) {
    const val = parseFloat(durMatch[1]);
    const unit = durMatch[3].toLowerCase();
    estimatedMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
    text = text.replace(durMatch[0], '');
  }

  // 5. Date parser ("today", "tonight", "tomorrow", "in 2 days", "next monday", etc.)
  if (/\b(today|tonight)\b/i.test(text)) {
    scheduledDate = todayStr;
    text = text.replace(/\b(today|tonight)\b/gi, '');
  } else if (/\btomorrow\b/i.test(text)) {
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    scheduledDate = formatDate(tmrw);
    text = text.replace(/\btomorrow\b/gi, '');
  } else {
    // Check for days of week (e.g. "on friday", "monday")
    const daysMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    const dayMatch = text.match(/\b(on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (dayMatch) {
      const targetDay = daysMap[dayMatch[2].toLowerCase()];
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + diff);
      scheduledDate = formatDate(targetDate);
      text = text.replace(dayMatch[0], '');
    }
  }

  // 6. Time parser ("at 3pm", "at 14:30", "at 9:00 AM", "at 11am")
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3]?.toLowerCase();

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;

    scheduledTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    if (!scheduledDate) scheduledDate = todayStr;
    text = text.replace(timeMatch[0], '');
  }

  // Clean extra spaces & punctuation
  const cleanTitle = text.replace(/\s+/g, ' ').replace(/^[-:,\s]+|[-:,\s]+$/g, '').trim();

  return {
    title: cleanTitle || raw.trim(),
    scheduledDate,
    scheduledTime,
    estimatedMinutes,
    priority,
    tags,
    energyLevelRequired
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

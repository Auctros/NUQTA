import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';

export const CalendarView: React.FC = () => {
  const { tasks, habits, focusSessions, goals, toggleTaskStatus, updateTask, profile, setActiveNavTab } = useNuqtaStore();
  const isAr = profile.language === 'ar';

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const todayStr = new Date().toISOString().split('T')[0];

  const shiftMonth = (delta: number) => {
    setCurrentMonthDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      return next;
    });
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  // Build 42 grid days for current month view
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayIndex = firstDayOfMonth.getDay(); // 0 is Sunday
  const startDate = new Date(year, month, 1 - startDayIndex);

  const cells = Array.from({ length: 42 }).map((_, idx) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + idx);
    const key = d.toISOString().split('T')[0];
    const isCurrentMonth = d.getMonth() === month;
    const isToday = key === todayStr;
    const isSelected = key === selectedDate;
    const dayTasks = tasks.filter((t) => !t.isArchived && t.status !== 'archived' && t.scheduledDate === key && t.status !== 'completed');

    return {
      date: d,
      key,
      dayNum: d.getDate(),
      isCurrentMonth,
      isToday,
      isSelected,
      tasks: dayTasks
    };
  });

  const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNames = isAr ? dayNamesAr : dayNamesEn;

  const monthLabel = currentMonthDate.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Selected date agenda tasks
  const agendaTasks = tasks
    .filter((t) => !t.isArchived && t.status !== 'archived' && t.scheduledDate === selectedDate && t.status !== 'completed')
    .sort((a, b) => (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99'));

  // Selected date historical life events (sessions & achievements)
  const dayHistoricalEvents: Array<{ id: string; title: string; meta: string; icon: string; color: string }> = [];

  // A. Quran Sessions
  habits.forEach((h) => {
    (h.quranData?.sessions || []).forEach((qs) => {
      if (qs.date === selectedDate) {
        dayHistoricalEvents.push({
          id: `qs-${qs.id}`,
          title: `${qs.surahName} (${qs.ayahStart}-${qs.ayahEnd})`,
          meta: `${qs.durationMinutes} دقيقة • ${qs.type === 'new_memorization' ? 'حفظ' : 'مراجعة'}`,
          icon: '📖',
          color: 'text-emerald-400 bg-emerald-950/30 border-emerald-800/30'
        });
      }
    });

    // B. Reading Sessions
    (h.readingData?.sessions || []).forEach((rs) => {
      if (rs.date === selectedDate) {
        dayHistoricalEvents.push({
          id: `rs-${rs.id}`,
          title: rs.bookTitle,
          meta: `${rs.pagesRead} صفحة • ${rs.durationMinutes} دقيقة`,
          icon: '📚',
          color: 'text-sky-400 bg-sky-950/30 border-sky-800/30'
        });
      }
    });

    // C. Workout Sessions
    (h.workoutData?.sessions || []).forEach((ws) => {
      if (ws.date === selectedDate) {
        dayHistoricalEvents.push({
          id: `ws-${ws.id}`,
          title: ws.title,
          meta: `${ws.durationMinutes} دقيقة • حجم ${ws.volumeKg} كغ`,
          icon: '⚡',
          color: 'text-orange-400 bg-orange-950/30 border-orange-800/30'
        });
      }
    });

    // D. Art pieces
    (h.drawingData?.pieces || []).forEach((ap) => {
      if (ap.completedDate === selectedDate) {
        dayHistoricalEvents.push({
          id: `ap-${ap.id}`,
          title: ap.title,
          meta: `${ap.durationMinutes} دقيقة • وسيط ${ap.medium}`,
          icon: '🎨',
          color: 'text-purple-400 bg-purple-950/30 border-purple-800/30'
        });
      }
    });
  });

  // E. Focus Sessions
  focusSessions.forEach((fs) => {
    if (fs.completedAt?.startsWith(selectedDate)) {
      dayHistoricalEvents.push({
        id: `fs-${fs.id}`,
        title: fs.taskTitle ? `جلسة تركيز: ${fs.taskTitle}` : 'جلسة عمل عميق',
        meta: `${fs.durationMinutes} دقيقة • إنتاجية ${fs.productivityScore}/5`,
        icon: '⏱️',
        color: 'text-indigo-400 bg-indigo-950/30 border-indigo-800/30'
      });
    }
  });

  // F. Milestones achieved
  goals.forEach((g) => {
    (g.milestones || []).forEach((m) => {
      if (m.isCompleted && m.completedDate === selectedDate) {
        dayHistoricalEvents.push({
          id: `ms-${m.id}`,
          title: `مرحلة منجزة: ${m.title}`,
          meta: `ضمن هدف: ${g.title}`,
          icon: '🚩',
          color: 'text-amber-400 bg-amber-950/30 border-amber-800/30'
        });
      }
    });
  });

  // Heuristic auto-scheduler: assigns unassigned tasks to open time slots
  const handleAutoSchedule = () => {
    const unassigned = tasks.filter((t) => t.status === 'todo' && !t.scheduledTime);
    let startHour = 9;
    unassigned.forEach((t) => {
      if (startHour <= 17) {
        updateTask(t.id, {
          scheduledDate: selectedDate,
          scheduledTime: `${String(startHour).padStart(2, '0')}:00`
        });
        startHour += (t.estimatedMinutes || 30) > 60 ? 2 : 1;
      }
    });
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / TIME</span>
          </div>
          <h1>{isAr ? 'التقويم وتوزيع الوقت' : 'Calendar & Time Blocks'}</h1>
          <p>
            {isAr
              ? 'رؤية شهرية شاملة، تخطيط للأيام، وحجب الوقت لتقليل الفوضى الذهنية.'
              : 'Full calendar distribution, day-to-day agenda, and zero-friction time blocking.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn subtle small" onClick={jumpToToday}>
            {isAr ? 'اليوم' : 'Today'}
          </button>
          <button className="btn primary" onClick={handleAutoSchedule}>
            <span>✳</span>
            <span>{isAr ? 'جدولة ذكية للمهام' : 'Auto Schedule'}</span>
          </button>
          <button className="btn subtle" onClick={() => setActiveNavTab('archive')}>
            <span>🗄️</span>
            <span>{isAr ? 'الذاكرة والأرشيف' : 'Archive'}</span>
          </button>
          <button className="btn subtle" onClick={() => setActiveNavTab('tasks')}>
            <span className="btn-icon">+</span>
            <span>{isAr ? 'إضافة مهمة' : 'Add Task'}</span>
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        {/* Left Calendar Grid Panel */}
        <section className="panel calendar-panel">
          <div className="calendar-month-head">
            <button
              className="icon-btn"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <NuqtaIcon name={isAr ? 'chevronRight' : 'chevronLeft'} className="w-4 h-4" />
            </button>
            <strong className="text-sm font-bold text-text">{monthLabel}</strong>
            <button
              className="icon-btn"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <NuqtaIcon name={isAr ? 'chevronLeft' : 'chevronRight'} className="w-4 h-4" />
            </button>
          </div>

          <div className="calendar-days">
            {dayNames.map((name) => (
              <div key={name} className="calendar-day-label">
                {name}
              </div>
            ))}

            {cells.map((cell) => (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDate(cell.key)}
                className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${cell.isSelected ? 'selected' : ''}`}
              >
                <span className="day-num">{cell.dayNum}</span>
                <span className="cal-events">
                  {cell.tasks.slice(0, 2).map((t) => (
                    <span key={t.id} className="cal-event-chip">
                      {t.title}
                    </span>
                  ))}
                </span>
                {cell.tasks.length > 2 && (
                  <span className="event-count">+{cell.tasks.length - 2}</span>
                )}
              </button>
            ))}
          </div>

          <p className="fine-print">
            {isAr
              ? 'مبدأ حجب الوقت (Time-Blocking): تحديد موعد دقيق لكل مهمة يقضي على التشتت ويحمي طاقتك من الاستنزاف.'
              : 'Time-Blocking principle: Anchoring tasks into discrete time containers prevents open-loop cognitive drag.'}
          </p>
        </section>

        {/* Right Day Agenda Panel */}
        <aside className="panel day-agenda">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'جدول اليوم' : "Selected Day's Agenda"}</h2>
              <p>{isAr ? 'المهام المرتبة زمنياً' : 'Chronological schedule'}</p>
            </div>
            <span className="tag">{agendaTasks.length}</span>
          </div>

          <div className="agenda-date">
            {new Date(selectedDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>

          {agendaTasks.length === 0 ? (
            <div className="empty-inline">
              {isAr ? 'لا توجد مهام مجدولة لهذا اليوم' : 'No tasks scheduled for this day'}
              <br />
              <button
                className="btn small primary"
                style={{ marginTop: '10px' }}
                onClick={() => setActiveNavTab('tasks')}
              >
                + {isAr ? 'إضافة مهمة' : 'Add Task'}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {agendaTasks.map((t) => (
                <div key={t.id} className="agenda-item">
                  <span className="agenda-time">{t.scheduledTime || '—'}</span>
                  <span className="agenda-marker"></span>
                  <div className="agenda-main">
                    <strong>{t.title}</strong>
                    <small>
                      {t.estimatedMinutes ? `${t.estimatedMinutes} ${isAr ? 'دقيقة' : 'mins'}` : (isAr ? 'بدون تقدير وقت' : 'untimed')}
                      {t.isTopThree ? ` · ★ ${isAr ? 'أهم 3' : 'Top 3'}` : ''}
                    </small>
                    <div style={{ marginTop: '7px', display: 'flex', gap: '6px' }}>
                      <button
                        className="btn small subtle"
                        onClick={() => toggleTaskStatus(t.id)}
                      >
                        ✓ {isAr ? 'تم' : 'Done'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historical Life Events Logged on this day */}
          {dayHistoricalEvents.length > 0 && (
            <div className="pt-4 border-t border-[#1e2e24] space-y-2">
              <span className="text-[11px] font-mono font-bold text-accent uppercase tracking-wider block">
                {isAr ? `سجل الحياة والأنشطة لهذا اليوم (${dayHistoricalEvents.length})` : `Logged Life History (${dayHistoricalEvents.length})`}
              </span>
              <div className="space-y-1.5">
                {dayHistoricalEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between ${ev.color}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{ev.icon}</span>
                      <span className="font-semibold truncate">{ev.title}</span>
                    </div>
                    <span className="font-mono text-[10px] shrink-0 opacity-80">{ev.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};


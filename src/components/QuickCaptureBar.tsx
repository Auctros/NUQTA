import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';
import { parseNaturalLanguageTask } from '../lib/nlpParser';

export const QuickCaptureBar: React.FC = () => {
  const { addTaskFromNLP, profile } = useNuqtaStore();
  const [input, setInput] = useState('');

  const isAr = profile.language === 'ar';
  const preview = input.trim() ? parseNaturalLanguageTask(input) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addTaskFromNLP(input);
    setInput('');
  };

  return (
    <div className="w-full" dir={isAr ? 'rtl' : 'ltr'}>
      <form
        onSubmit={handleSubmit}
        className="capture-bar"
      >
        <span className="capture-icon">
          +
        </span>

        <input
          id="quick-capture-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isAr
              ? 'ما الذي يحتاج انتباهك؟ جرّب: "قراءة 10 صفحات بكرة الساعة 6 مساءً" أو "!p1 #work"'
              : 'What needs your attention? Try: "Read 10 pages tomorrow at 6 PM" or "!p1 #work"'
          }
        />

        <span className="capture-hint hidden sm:inline-block">
          {isAr ? 'Enter للالتقاط' : 'Enter to capture'}
        </span>

        <button
          type="submit"
          disabled={!input.trim()}
          aria-label={isAr ? 'التقاط' : 'Capture'}
          className="send-capture"
        >
          ↵
        </button>
      </form>

      {/* Live NLP Interpretation Bar */}
      {preview && input.trim().length > 3 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 text-[11px] animate-in fade-in duration-150">
          <span className="text-[10px] text-[var(--muted)] font-mono">
            {isAr ? 'تفسير الأمر:' : 'Interpreted:'}
          </span>

          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--panel-2)] border border-[var(--border)] px-2 py-0.5 text-[var(--text)]">
            <span className="font-semibold text-[var(--accent)]">{preview.title}</span>
          </span>

          {preview.scheduledDate && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--panel-2)] border border-[var(--border)] px-2 py-0.5 text-[var(--accent)]">
              <NuqtaIcon name="calendar" className="w-3 h-3" />
              <span>{preview.scheduledDate}</span>
            </span>
          )}

          {preview.scheduledTime && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--panel-2)] border border-[var(--border)] px-2 py-0.5 text-[var(--blue)]">
              <NuqtaIcon name="timer" className="w-3 h-3" />
              <span>{preview.scheduledTime}</span>
            </span>
          )}

          {preview.estimatedMinutes && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--panel-2)] border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
              <span>{preview.estimatedMinutes}m</span>
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[10px] font-mono border ${
              preview.priority === 1
                ? 'tag red'
                : preview.priority === 2
                ? 'tag orange'
                : 'tag'
            }`}
          >
            P{preview.priority}
          </span>

          {preview.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-[6px] bg-[var(--panel-2)] border border-[var(--border)] px-2 py-0.5 text-[var(--muted)] text-[10px]"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

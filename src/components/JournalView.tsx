import React, { useState } from 'react';
import { useNuqtaStore } from '../store/nuqtaStore';
import { NuqtaIcon } from './NuqtaIcon';
import confetti from 'canvas-confetti';

export const JournalView: React.FC = () => {
  const { journalEntries, saveJournalEntry, profile, setActiveNavTab } = useNuqtaStore();
  const isAr = profile.language === 'ar';
  const todayStr = new Date().toISOString().split('T')[0];

  const existingToday = journalEntries.find((j) => j.date === todayStr);

  const [mood, setMood] = useState<number>(existingToday?.mood || 4);
  const [well, setWell] = useState(existingToday?.whatWentWell || '');
  const [drained, setDrained] = useState(existingToday?.whatDrainedEnergy || '');
  const [tomorrow, setTomorrow] = useState(existingToday?.planForTomorrow || '');
  const [gratitude, setGratitude] = useState((existingToday?.gratitudeList || [])[0] || '');

  const moods = [
    { emoji: '😞', labelAr: 'مستنزف جداً', labelEn: 'Drained', val: 1 },
    { emoji: '😕', labelAr: 'طاقة منخفضة', labelEn: 'Low Energy', val: 2 },
    { emoji: '😐', labelAr: 'محايد ومستقر', labelEn: 'Neutral', val: 3 },
    { emoji: '🙂', labelAr: 'جيد وإيجابي', labelEn: 'Good', val: 4 },
    { emoji: '😊', labelAr: 'طاقة عالية ومزدهر', labelEn: 'Great', val: 5 }
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!well.trim() && !drained.trim() && !tomorrow.trim() && !gratitude.trim()) return;

    saveJournalEntry({
      date: todayStr,
      whatWentWell: well.trim(),
      whatDrainedEnergy: drained.trim(),
      planForTomorrow: tomorrow.trim(),
      gratitudeList: gratitude.trim() ? [gratitude.trim()] : [],
      mood: mood as any,
      isEncrypted: false
    });

    try {
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
    } catch {}

    alert(isAr ? 'تم حفظ تأمل اليوم بنجاح في جهازك!' : 'Reflection saved locally.');
  };

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="line"></span>
            <span>NUQTA / REFLECTION</span>
          </div>
          <h1>{isAr ? 'المذكرات والتأمل المسائي' : 'Journal & Reflection'}</h1>
          <p>
            {isAr
              ? 'مراجعة يومية موجزة تفرغ الذهن من الأفكار العالقة وتمنحك وضوحاً كاملاً لما هو قادم.'
              : 'A brief daily reflection to empty mental cache and sharpen what matters next.'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="btn subtle" onClick={() => setActiveNavTab('insights')}>
            <span>{isAr ? 'تحليلات الأنماط' : 'Insights'}</span>
            <NuqtaIcon name="arrow" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="journal-layout">
        {/* Left Column: Journal Form */}
        <section className="panel journal-editor">
          <div className="journal-date-row">
            <div>
              <span className="eyebrow">{isAr ? 'تأمل اليوم' : "TODAY'S ENTRY"}</span>
              <strong>
                {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </strong>
            </div>
            <span className="tag green">{isAr ? 'محلي وخاص' : 'Local Only'}</span>
          </div>

          <form onSubmit={handleSave}>
            {/* Mood Picker */}
            <div className="field">
              <label className="field-label">{isAr ? 'كيف كانت حالتك الذهنية والجسدية اليوم؟' : 'Overall State Today'}</label>
              <div className="mood-picker" role="group" aria-label="Mood picker">
                {moods.map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    className={`mood-button ${mood === m.val ? 'active' : ''}`}
                    onClick={() => setMood(m.val)}
                  >
                    <span>{m.emoji}</span>
                    <small>{isAr ? m.labelAr : m.labelEn}</small>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt 1 */}
            <div className="prompt-block">
              <label className="field-label" htmlFor="journal-well">
                01 — {isAr ? 'ما الذي سار بشكل جيد اليوم؟ (حتى لو كان بسيطاً)' : 'What went well today, however small?'}
              </label>
              <textarea
                id="journal-well"
                className="textarea"
                placeholder={isAr ? 'إنجاز مهمة، محادثة مريحة، المشي...' : 'A task completed, a quiet morning, a good conversation...'}
                value={well}
                onChange={(e) => setWell(e.target.value)}
              />
            </div>

            {/* Prompt 2 */}
            <div className="prompt-block">
              <label className="field-label" htmlFor="journal-drained">
                02 — {isAr ? 'ما الذي استنزف طاقتك أو أشتتك؟ (لاحظه دون أن تحاكم نفسك)' : 'What drained your energy or derailed focus?'}
              </label>
              <textarea
                id="journal-drained"
                className="textarea"
                placeholder={isAr ? 'تصفح غير واعٍ، قلق زائد، تسويف في مهمة...' : 'Aimless browsing, overthinking, an unclear meeting...'}
                value={drained}
                onChange={(e) => setDrained(e.target.value)}
              />
            </div>

            {/* Prompt 3 */}
            <div className="prompt-block">
              <label className="field-label" htmlFor="journal-tomorrow">
                03 — {isAr ? 'أولوية واحدة واضحة وخطوة صغيرة للغد؟' : 'One non-negotiable priority for tomorrow?'}
              </label>
              <textarea
                id="journal-tomorrow"
                className="textarea"
                placeholder={isAr ? 'الشيء الوحيد الذي إن أنجزته سيعتبر الغد ناجحاً...' : 'The single action that will make tomorrow successful...'}
                value={tomorrow}
                onChange={(e) => setTomorrow(e.target.value)}
              />
            </div>

            {/* Gratitude Prompt */}
            <div className="prompt-block">
              <label className="field-label" htmlFor="journal-gratitude">
                ✳ — {isAr ? 'شيء تشعر بالامتنان والتقدير لوجوده اليوم' : 'One thing you are genuinely grateful for'}
              </label>
              <input
                id="journal-gratitude"
                className="input"
                placeholder={isAr ? 'شخص، لحظة هدوء، صحة، كوب شاي...' : 'A person, a peaceful moment, good health...'}
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
              />
            </div>

            <div className="journal-actions">
              <span className="small-muted">
                {isAr ? '٣ دقائق مساءً تفرغ الذاكرة المؤقتة لمخك' : '3 minutes of evening reflection frees working memory'}
              </span>
              <button className="btn primary" type="submit">
                {isAr ? 'حفظ التأمل ✓' : 'Save Entry ✓'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: History & Privacy */}
        <aside className="panel panel-pad">
          <div className="panel-heading">
            <div>
              <h2>{isAr ? 'سجل التأملات السابقة' : 'Past Reflections'}</h2>
              <p>{isAr ? 'مذكراتك الخاصة' : 'Personal journal history'}</p>
            </div>
            <span className="tag">{journalEntries.length}</span>
          </div>

          {journalEntries.length === 0 ? (
            <div className="empty-inline">{isAr ? 'لا توجد تأملات مسجلة بعد' : 'No reflections logged yet'}</div>
          ) : (
            <div>
              {journalEntries.slice(0, 6).map((entry) => {
                const moodEmoji = ['😞', '😕', '😐', '🙂', '😊'][Number(entry.mood) - 1] || '🙂';
                const snippet = entry.whatWentWell || entry.planForTomorrow || (entry.gratitudeList || [])[0] || '—';
                return (
                  <div key={entry.id} className="journal-history-item">
                    <div className="journal-history-date">
                      <strong>{entry.date}</strong>
                      <small>{moodEmoji}</small>
                    </div>
                    <p>{snippet.slice(0, 140)}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="subtle-line"></div>

          {/* Privacy Note */}
          <div className="privacy-note">
            <span className="privacy-icon">
              <NuqtaIcon name="lock" className="w-4 h-4" />
            </span>
            <div>
              <strong>{isAr ? 'خصوصية مطلقة وتخزين محلي' : 'Absolute Privacy by Design'}</strong>
              <p>
                {isAr
                  ? 'تدويناتك وتأملاتك لا تغادر متصفحك أبداً. لا يتم إرسالها إلى أي سيرفر خارجي أو ذكاء اصطناعي.'
                  : 'Your journal stays strictly inside your browser local storage. Never uploaded, never mined.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};


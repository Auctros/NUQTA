import React, { useEffect, useState } from 'react';
import { getStorageIssues, subscribeStorageIssues, clearStorageIssues, StorageIssue } from '../lib/storage';

/** Tells the user when saving fails or saved data was unreadable, instead of failing silently. */
export const StorageIssueBanner: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const [issues, setIssues] = useState<StorageIssue[]>(() => getStorageIssues());

  useEffect(() => {
    setIssues(getStorageIssues());
    return subscribeStorageIssues(() => setIssues(getStorageIssues()));
  }, []);

  if (issues.length === 0) return null;
  const failed = issues.some((i) => i.kind === 'write_failed');
  const message = failed
    ? isAr
      ? 'تعذّر حفظ آخر تغييراتك (قد تكون مساحة التخزين ممتلئة). صدّر نسخة احتياطية الآن من الإعدادات.'
      : 'Your latest changes could not be saved (storage may be full). Export a backup from Settings now.'
    : isAr
      ? 'وُجدت بيانات تالفة وتم الاحتفاظ بنسخة منها بدل حذفها. لم يُفقد شيء.'
      : 'Some saved data was unreadable. A copy was preserved instead of being deleted.';

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 0, insetInline: 0, zIndex: 100, padding: '10px 16px',
        background: 'var(--state-danger)', color: 'var(--text-on-state)', fontSize: 13, display: 'flex',
        justifyContent: 'space-between', gap: 12, alignItems: 'center'
      }}
    >
      <span>{message}</span>
      <button
        onClick={() => { clearStorageIssues(); setIssues([]); }}
        style={{ background: 'transparent', color: 'var(--text-on-state)', border: '1px solid color-mix(in srgb, var(--text-on-state) 50%, transparent)', borderRadius: 6, padding: '2px 10px' }}
      >
        {isAr ? 'إخفاء' : 'Dismiss'}
      </button>
    </div>
  );
};

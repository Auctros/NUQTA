import { NuqtaStorageEngine, ImportResult } from './storage';
import { localDateKey } from './dateKey';
import type { BackupError } from './backupSchema';

/** Save text as a file using a Blob (data: URIs fail on large backups in some browsers). */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBackupFile(prefix = 'nuqta-backup'): void {
  downloadTextFile(
    `${prefix}_${localDateKey()}.json`,
    NuqtaStorageEngine.exportFullBackup(),
    'application/json;charset=utf-8'
  );
}

/** Neutralise spreadsheet formula injection and quote a CSV cell. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function backupErrorMessage(
  error: BackupError | 'write_failed',
  section: string | undefined,
  isAr: boolean
): string {
  switch (error) {
    case 'invalid_json':
      return isAr ? 'الملف ليس JSON صالحاً. لم يتم تغيير أي بيانات.' : 'This file is not valid JSON. Nothing was changed.';
    case 'not_nuqta':
      return isAr
        ? 'الملف لا يبدو نسخة احتياطية من نقطة. لم يتم تغيير أي بيانات.'
        : 'This does not look like a NUQTA backup. Nothing was changed.';
    case 'unsupported_version':
      return isAr
        ? 'هذه النسخة أُنشئت بإصدار أحدث من التطبيق. لم يتم تغيير أي بيانات.'
        : 'This backup was made by a newer version of NUQTA. Nothing was changed.';
    case 'invalid_section':
      return isAr
        ? `القسم "${section ?? ''}" في الملف تالف أو غير صالح. لم يتم تغيير أي بيانات.`
        : `The "${section ?? ''}" section of this file is invalid. Nothing was changed.`;
    case 'write_failed':
    default:
      return isAr
        ? 'تعذّرت الكتابة (ربما المساحة ممتلئة). أُعيدت بياناتك كما كانت.'
        : 'Saving failed (storage may be full). Your data was left as it was.';
  }
}

/**
 * Validate -> confirm -> download a safety copy -> atomic restore.
 * Returns the import result, or null if the user cancelled.
 */
export async function restoreBackupFromFile(
  file: File,
  isAr: boolean,
  setStatus: (message: string) => void
): Promise<ImportResult | null> {
  const content = await file.text();
  const check = NuqtaStorageEngine.validateBackup(content);
  if (!check.ok) {
    setStatus(backupErrorMessage(check.error, check.section, isAr));
    return { ok: false, error: check.error, section: check.section };
  }
  const proceed = window.confirm(
    isAr
      ? 'سيتم استبدال كل بياناتك الحالية بمحتوى هذا الملف. سننزّل أولاً نسخة أمان من بياناتك الحالية. هل تريد المتابعة؟'
      : 'This replaces ALL of your current data with the contents of this file. A safety copy of your current data will be downloaded first. Continue?'
  );
  if (!proceed) {
    setStatus('');
    return null;
  }
  downloadBackupFile('nuqta-before-restore');
  const result = NuqtaStorageEngine.importBackup(content);
  setStatus(
    result.ok
      ? isAr ? 'تمت الاستعادة بنجاح. جارٍ التحديث...' : 'Backup restored. Refreshing...'
      : backupErrorMessage(result.error, result.section, isAr)
  );
  return result;
}

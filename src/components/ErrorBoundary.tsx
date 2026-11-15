import React from 'react';
import { downloadBackupFile } from '../lib/backupActions';

/**
 * Last-resort guard so an unexpected render error never white-screens the whole app.
 *
 * User data lives in localStorage and is untouched by a render failure; the risk is that
 * the UI becomes unreachable, so the recovery screen offers an immediate backup export
 * and a reload. The message is bilingual and static (no store access) so it works even
 * when the failure happened while hydrating the store.
 */
interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('NUQTA: the interface hit an unexpected error.', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="auto"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--surface-page)',
          color: 'var(--text-primary)'
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <h1 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>
            Something went wrong · حدث خطأ غير متوقع
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
            Your data is safe on this device. Export a backup now, then reload the app.
            <br />
            بياناتك محفوظة على هذا الجهاز. صدّر نسخة احتياطية الآن ثم أعد تحميل التطبيق.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadBackupFile('nuqta-recovery-backup')}
              style={{
                background: 'var(--brand-strong)',
                color: 'var(--accent-ink, #fff)',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                padding: '8px 14px',
                cursor: 'pointer'
              }}
            >
              Export backup · تصدير نسخة احتياطية
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 14px',
                cursor: 'pointer'
              }}
            >
              Reload · إعادة التحميل
            </button>
          </div>
        </div>
      </div>
    );
  }
}

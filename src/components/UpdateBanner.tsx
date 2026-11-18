import React, { useEffect, useState } from 'react';
import { getPwaUpdateManager, PwaUpdateSnapshot } from '../lib/pwaUpdate';
import { NuqtaIcon } from './NuqtaIcon';

/**
 * Tells the user a new build is ready and lets them apply it. It never reloads on its own.
 * Applying is always explicit, because skipWaiting() is global: the other open NUQTA tabs
 * see the controller change too, and this design keeps them from being reloaded out from
 * under the user (see src/lib/pwaUpdate.ts).
 */
export const UpdateBanner: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const manager = getPwaUpdateManager();
  const [snapshot, setSnapshot] = useState<PwaUpdateSnapshot | null>(() => manager?.getSnapshot() ?? null);

  useEffect(() => {
    if (!manager) return;
    setSnapshot(manager.getSnapshot());
    return manager.subscribe(setSnapshot);
  }, [manager]);

  if (!manager || !snapshot || (snapshot.status !== 'available' && snapshot.status !== 'applying')) return null;

  const applying = snapshot.status === 'applying';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        insetInline: 0,
        zIndex: 100,
        padding: '10px 16px',
        background: 'var(--state-info)',
        color: 'var(--text-on-state)',
        fontSize: 13,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center'
      }}
    >
      <span>
        {isAr
          ? applying
            ? 'جارٍ تطبيق التحديث…'
            : 'يتوفّر إصدار جديد من NUQTA.'
          : applying
            ? 'Applying the update…'
            : 'A new version of NUQTA is ready.'}
      </span>
      {!applying && (
        <button
          type="button"
          onClick={() => manager.apply()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--text-on-state)',
            border: '1px solid color-mix(in srgb, var(--text-on-state) 50%, transparent)',
            borderRadius: 6,
            padding: '2px 10px',
            cursor: 'pointer'
          }}
        >
          <NuqtaIcon name="restore" className="w-4 h-4" />
          {isAr ? 'تطبيق التحديث' : 'Apply update'}
        </button>
      )}
    </div>
  );
};

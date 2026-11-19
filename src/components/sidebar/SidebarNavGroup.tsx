import React from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';

export type SidebarNavItem<T extends string = string> = {
  id: T;
  label: string;
  shortLabel?: string;
  icon: IconName;
  count?: number;
};

type SidebarNavGroupProps<T extends string> = {
  /** Group heading, also used as the <nav> accessible name. */
  label: string;
  items: SidebarNavItem<T>[];
  activeId: T;
  onNavigate: (id: T) => void;
  /** Id of the tooltip currently shown in the collapsed rail, if any. */
  tooltipId: string | null;
  onShowTooltip: (
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    id: string,
    label: string,
    badge?: string
  ) => void;
  onHideTooltip: () => void;
  /** Larger top margin, used by every group after the first. */
  spaced?: boolean;
};

export function SidebarNavGroup<T extends string>({
  label,
  items,
  activeId,
  onNavigate,
  tooltipId,
  onShowTooltip,
  onHideTooltip,
  spaced = false
}: SidebarNavGroupProps<T>) {
  return (
    <>
      <div className={spaced ? 'nav-label nav-label-spaced' : 'nav-label'}>
        <span>{label}</span>
      </div>
      <nav className="primary-nav" aria-label={label}>
        {items.map((item) => {
          const isActive = activeId === item.id;
          const badgeText = item.count !== undefined && item.count > 0 ? String(item.count) : undefined;
          return (
            <button
              type="button"
              key={item.id}
              data-sidebar-nav="true"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              aria-describedby={!isActive && tooltipId === item.id ? `sidebar-tip-${item.id}` : undefined}
              onClick={() => {
                onHideTooltip();
                onNavigate(item.id);
              }}
              onMouseEnter={(e) => {
                if (!isActive) onShowTooltip(e, item.id, item.label, badgeText);
              }}
              onMouseLeave={onHideTooltip}
              onFocus={(e) => {
                if (!isActive) onShowTooltip(e, item.id, item.label, badgeText);
              }}
              onBlur={onHideTooltip}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">
                <NuqtaIcon name={item.icon} className="w-4 h-4" />
              </span>
              <span className="nav-item-label truncate flex-1">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="nav-trailing tabular-nums">{item.count}</span>
              )}
              {isActive && (
                <span className="nav-active-mini-label" aria-hidden="true">
                  {item.shortLabel ?? item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

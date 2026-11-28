import React, { useCallback, useRef, useState } from 'react';
import { NuqtaIcon, IconName } from '../NuqtaIcon';
import { MovingHighlight, useMovingHighlight } from '../motion/MovingHighlight';

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

/**
 * One highlight surface travels between the items of a group instead of each
 * item painting its own hover. It follows the pointer *and* keyboard focus, so
 * tabbing through the rail reads the same as pointing at it.
 *
 * The highlight is a decorative layer: it never receives the click, never
 * carries `aria-current`, and navigation still runs through the real buttons
 * beneath it. The active destination keeps its own persistent styling, so
 * "where hover is" and "where I am" stay separately legible.
 */
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
  const navRef = useRef<HTMLElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Focus wins over hover: with the keyboard in use, the row the user is on is
  // the one the highlight must explain, even if the mouse rests elsewhere.
  const activeIndex = focusedIndex >= 0 ? focusedIndex : hoveredIndex;

  const highlightRect = useMovingHighlight({
    containerRef: navRef,
    activeIndex,
    itemSelector: '[data-sidebar-nav="true"]'
  });

  const clearFocus = useCallback(() => setFocusedIndex(-1), []);

  return (
    <>
      <div className={spaced ? 'nav-label nav-label-spaced' : 'nav-label'}>
        <span>{label}</span>
      </div>
      <nav
        className="primary-nav relative"
        aria-label={label}
        ref={navRef}
        onMouseLeave={() => setHoveredIndex(-1)}
        onBlur={(e) => {
          if (!navRef.current?.contains(e.relatedTarget as Node | null)) clearFocus();
        }}
      >
        <MovingHighlight rect={highlightRect} className="nav-hover-highlight" preset="bouncy" />
        {items.map((item, index) => {
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
                setHoveredIndex(index);
                if (!isActive) onShowTooltip(e, item.id, item.label, badgeText);
              }}
              onMouseLeave={onHideTooltip}
              onFocus={(e) => {
                setFocusedIndex(index);
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

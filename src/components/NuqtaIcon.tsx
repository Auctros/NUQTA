import React from 'react';

export type IconName =
  | 'grid'
  | 'check-square'
  | 'repeat'
  | 'target'
  | 'timer'
  | 'calendar'
  | 'wallet'
  | 'activity'
  | 'book-open'
  | 'chart'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'bell'
  | 'menu'
  | 'close'
  | 'lock'
  | 'plus'
  | 'search'
  | 'trash'
  | 'edit'
  | 'arrow'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'coffee'
  | 'flame'
  | 'leaf'
  | 'archive'
  | 'plusCircle';

const iconPaths: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  'check-square': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6M12 2v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <path d="M3 9h18M16 14h2" />
      <path d="M6 5V4a1 1 0 0 1 1-1h10" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  'book-open': (
    <>
      <path d="M12 7v14M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z" />
      <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5A2.5 2.5 0 0 1 21 23z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 6-7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.8Z"
        transform="translate(-1 -1) scale(1.08)"
      />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6" />,
  edit: <path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  coffee: (
    <>
      <path d="M10 2v2M14 2v2M4 8h14v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM18 10h1a3 3 0 0 1 0 6h-2" />
    </>
  ),
  flame: (
    <path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 0 3-2 4-2 4 1-4-1-8-5-11 0 5-4 7-4 13a7 7 0 0 0 7 7Z" />
  ),
  leaf: (
    <>
      <path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 8-8 8-16Z" />
      <path d="M4 21c2-5 5-8 11-11" />
    </>
  ),
  plusCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  archive: (
    <>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </>
  )
};

interface IconProps {
  name: IconName;
  className?: string;
}

export const NuqtaIcon: React.FC<IconProps> = ({ name, className = 'w-4 h-4' }) => {
  return (
    <svg
      className={`inline-block shrink-0 fill-none stroke-current ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name] || iconPaths.grid}
    </svg>
  );
};

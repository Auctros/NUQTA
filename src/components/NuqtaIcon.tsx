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
  | 'chevronDown'
  | 'coffee'
  | 'flame'
  | 'leaf'
  | 'archive'
  | 'plusCircle'
  | 'book'
  | 'layers'
  | 'compass'
  | 'dumbbell'
  | 'list'
  | 'trophy'
  | 'brush'
  | 'image'
  | 'play'
  | 'pause'
  | 'clock'
  | 'sparkle'
  | 'eye'
  | 'eyeOff'
  | 'star'
  | 'flag'
  | 'quote'
  | 'history'
  | 'mosque'
  | 'notebook'
  | 'user'
  | 'restore'
  | 'undo'
  | 'briefcase'
  | 'coin'
  | 'brain'
  | 'rocket'
  | 'alert'
  | 'scale'
  | 'trending-up'
  | 'trending-down'
  | 'blocks'
  | 'hourglass'
  | 'infinity'
  | 'palette'
  | 'sunrise'
  | 'minus'
  | 'snowflake'
  | 'save';

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
  chevronDown: <path d="m6 9 6 6 6-6" />,
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
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </>
  ),
  brush: (
    <>
      <path d="M9.5 14.5 3 21M14 4l6 6-8.5 8.5a3 3 0 0 1-4.24-4.24L14 4Z" />
      <path d="m14 4 3-3 6 6-3 3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  play: <path d="M6 4l14 8-14 8V4Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  star: <path d="m12 3 2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.8 6.5 19.6l1.4-6.1L3.2 9.3l6.2-.6L12 3Z" />,
  flag: (
    <>
      <path d="M5 21V4M5 4h11l-1.5 4L16 12H5" />
    </>
  ),
  quote: (
    <>
      <path d="M7 7h4v4a4 4 0 0 1-4 4V7ZM13 7h4v4a4 4 0 0 1-4 4V7Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 8v4l3 2" />
    </>
  ),
  mosque: (
    <>
      <path d="M4 21V11a8 8 0 0 1 16 0v10" />
      <path d="M4 21h16M12 3V6" />
      <path d="M12 3a1.5 1.5 0 0 1 1.5 1.5A1.5 1.5 0 0 1 12 6a1.5 1.5 0 0 1-1.5-1.5A1.5 1.5 0 0 1 12 3Z" />
      <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3" width="15" height="18" rx="2.5" />
      <path d="M9 3v18M13 8h4M13 12h4" />
      <path d="M5 7H3M5 12H3M5 17H3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.3" />
      <path d="M3 4v5h5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v1a6 6 0 0 1-6 6h-2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
  coin: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5.5a3 3 0 0 0-5.7 1.3A3 3 0 0 0 4.4 12a3 3 0 0 0 1.9 4.7A3 3 0 0 0 12 18.5Z" />
      <path d="M12 5.5a3 3 0 0 1 5.7 1.3A3 3 0 0 1 19.6 12a3 3 0 0 1-1.9 4.7A3 3 0 0 1 12 18.5Z" />
      <path d="M12 5.5v13" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c3 1.6 5 4.6 5 8.2V15l-2.4 1.6h-5.2L7 15v-3.8C7 7.6 9 4.6 12 3Z" />
      <circle cx="12" cy="10" r="1.7" />
      <path d="M9.4 16.6 8 21l3-1.4M14.6 16.6 16 21l-3-1.4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 21 20H3Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17.2" r="0.6" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16M7 20h10" />
      <path d="M6 6h12" />
      <path d="M6 6 3 12h6ZM18 6l-3 6h6Z" />
    </>
  ),
  'trending-up': (
    <>
      <path d="M3 17 9.5 10.5l3.5 3.5L21 6" />
      <path d="M15.5 6H21v5.5" />
    </>
  ),
  'trending-down': (
    <>
      <path d="M3 7 9.5 13.5l3.5-3.5L21 18" />
      <path d="M15.5 18H21v-5.5" />
    </>
  ),
  blocks: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21" />
    </>
  ),
  infinity: (
    <path d="M8.4 9.2a3.1 3.1 0 1 0 0 5.6c1.6-1.1 2.4-2.1 3.6-2.8 1.2.7 2 1.7 3.6 2.8a3.1 3.1 0 1 0 0-5.6c-1.6 1.1-2.4 2.1-3.6 2.8-1.2-.7-2-1.7-3.6-2.8Z" />
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-.9.7-1.6 1.6-1.6h1.1a4 4 0 0 0 4-4c0-3.8-3.4-6.8-7.5-6.8Z" />
      <circle cx="8" cy="10" r="1" />
      <circle cx="12" cy="8" r="1" />
      <circle cx="15.8" cy="10.4" r="1" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 3.5v4M5.6 9.6 4 8M18.4 9.6 20 8M3 15h3M18 15h3M8 15a4 4 0 0 1 8 0" />
      <path d="M3 19h18" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  snowflake: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5" />
      <path d="M12 6.4 9.8 4.6M12 6.4l2.2-1.8M12 17.6l-2.2 1.8M12 17.6l2.2 1.8" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13H5Z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
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

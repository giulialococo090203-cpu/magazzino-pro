const PATHS = {
  search: [
    'M21 21l-4.35-4.35',
    'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  ],
  notifications: [
    'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8',
    'M10 20h4',
  ],
  inventory_2: [
    'M4 7h16',
    'M6 7v13h12V7',
    'M9 11h6',
    'M9 15h6',
  ],
  inventory: [
    'M4 7h16',
    'M6 7v13h12V7',
    'M9 11h6',
  ],
  box: [
    'M21 8l-9-5-9 5 9 5 9-5Z',
    'M3 8v8l9 5 9-5V8',
    'M12 13v8',
  ],
  warning: [
    'M12 3l10 18H2L12 3Z',
    'M12 9v5',
    'M12 17h.01',
  ],
  block: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    'M5 5l14 14',
  ],
  assignment: [
    'M8 4h8',
    'M9 2h6v4H9V2Z',
    'M6 5h12v17H6V5Z',
    'M9 11h6',
    'M9 15h6',
  ],
  clipboard: [
    'M8 4h8',
    'M9 2h6v4H9V2Z',
    'M6 5h12v17H6V5Z',
  ],
  sell: [
    'M20 13l-7 7L4 11V4h7l9 9Z',
    'M7.5 7.5h.01',
  ],
  tag: [
    'M20 13l-7 7L4 11V4h7l9 9Z',
    'M7.5 7.5h.01',
  ],
  tags: [
    'M20 13l-7 7L4 11V4h7l9 9Z',
    'M7.5 7.5h.01',
  ],
  upload_file: [
    'M14 2H6v20h12V6l-4-4Z',
    'M14 2v4h4',
    'M12 17V9',
    'M9 12l3-3 3 3',
  ],
  file_upload: [
    'M14 2H6v20h12V6l-4-4Z',
    'M14 2v4h4',
    'M12 17V9',
    'M9 12l3-3 3 3',
  ],
  file: [
    'M14 2H6v20h12V6l-4-4Z',
    'M14 2v4h4',
  ],
  request_quote: [
    'M14 2H6v20h12V6l-4-4Z',
    'M14 2v4h4',
    'M12 8v8',
    'M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5S13.5 12 12 12s-2.5.5-2.5 1.5S10.5 15 12 15s2.5-.5 2.5-1.5',
  ],
  folder_open: [
    'M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
    'M3 11h18',
  ],
  analytics: [
    'M4 19V5',
    'M4 19h16',
    'M8 16v-5',
    'M12 16V8',
    'M16 16v-8',
  ],
  bar_chart: [
    'M4 19V5',
    'M4 19h16',
    'M8 16v-5',
    'M12 16V8',
    'M16 16v-8',
  ],
  dashboard: [
    'M4 13a8 8 0 1 1 16 0',
    'M12 13l4-4',
    'M5 20h14',
  ],
  trending_up: [
    'M3 17l6-6 4 4 8-8',
    'M15 7h6v6',
  ],
  bolt: [
    'M13 2L4 14h7l-1 8 10-13h-7l1-7Z',
  ],
  factory: [
    'M3 21V9l6 4V9l6 4V5h6v16H3Z',
    'M7 17h2',
    'M12 17h2',
    'M17 17h2',
  ],
  euro: [
    'M18 7a7 7 0 1 0 0 10',
    'M5 10h10',
    'M5 14h9',
  ],
  delete: [
    'M4 7h16',
    'M10 11v6',
    'M14 11v6',
    'M6 7l1 14h10l1-14',
    'M9 7V4h6v3',
  ],
  check_circle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    'M8 12l3 3 5-6',
  ],
  backup: [
    'M12 3a9 9 0 1 1-8 5',
    'M3 3v5h5',
    'M12 7v6l4 2',
  ],
  database: [
    'M4 6c0-2 16-2 16 0s-16 2-16 0Z',
    'M4 6v6c0 2 16 2 16 0V6',
    'M4 12v6c0 2 16 2 16 0v-6',
  ],
  straighten: [
    'M4 17h16',
    'M6 17v-4',
    'M10 17v-7',
    'M14 17v-4',
    'M18 17v-7',
  ],
  construction: [
    'M14 7l3-3 3 3-3 3',
    'M4 20l8-8',
    'M12 12l-2-2',
    'M4 4l16 16',
  ],
  manage_accounts: [
    'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M19 8v6',
    'M22 11h-6',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  history_edu: [
    'M3 12a9 9 0 1 0 3-6.7',
    'M3 4v6h6',
    'M12 7v5l3 2',
  ],
  history: [
    'M3 12a9 9 0 1 0 3-6.7',
    'M3 4v6h6',
    'M12 7v5l3 2',
  ],
  settings: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.1 7.4 7.4 0 0 1-1.7 1l-.3.1-.4-2a1.7 1.7 0 0 0-1.6-1.4h-.4a1.7 1.7 0 0 0-1.6 1.4l-.4 2-.3-.1a7.4 7.4 0 0 1-1.7-1 1.7 1.7 0 0 0-1.9-.1l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a7.7 7.7 0 0 1 0-2 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.1 7.4 7.4 0 0 1 1.7-1l.3-.1.4 2A1.7 1.7 0 0 0 12.3 10h.4a1.7 1.7 0 0 0 1.6-1.4l.4-2 .3.1a7.4 7.4 0 0 1 1.7 1 1.7 1.7 0 0 0 1.9.1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 7.7 7.7 0 0 1 0 2Z',
  ],
  filter_alt: [
    'M4 5h16l-6 7v6l-4 2v-8L4 5Z',
  ],
  shopping_cart: [
    'M4 4h2l2 12h10l2-8H7',
    'M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    'M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  ],
  move_to_inbox: [
    'M4 4h16v16H4V4Z',
    'M8 10l4 4 4-4',
    'M12 14V6',
    'M4 15h5',
    'M15 15h5',
  ],
  outbox: [
    'M4 4h16v16H4V4Z',
    'M8 10l4-4 4 4',
    'M12 6v8',
    'M4 15h5',
    'M15 15h5',
  ],
  sync: [
    'M21 12a9 9 0 0 1-15.5 6.2',
    'M3 12a9 9 0 0 1 15.5-6.2',
    'M18 3v5h-5',
    'M6 21v-5h5',
  ],
  edit_square: [
    'M4 20h4l10-10-4-4L4 16v4Z',
    'M13 7l4 4',
    'M14 4l6 6',
  ],
};

const ALIASES = {
  entrata: 'move_to_inbox',
  uscita: 'outbox',
  reintegro: 'sync',
  rettifica: 'edit_square',
  invoice: 'request_quote',
  archive: 'inventory_2',
  archive_box: 'inventory_2',
  file_upload: 'upload_file',
  supplier: 'factory',
  local_fire_department: 'bolt',
  push_pin: 'tag',
  chart: 'analytics',
  fa_box_open: 'move_to_inbox',
};

export default function AppIcon({ name, className = '', title }) {
  const key = ALIASES[name] || name || 'inventory_2';
  const paths = PATHS[key] || PATHS.inventory_2;

  return (
    <svg
      className={`app-svg-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

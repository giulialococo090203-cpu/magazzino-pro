const ICONS = {
  inventory_2: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.8 6.8 17.2 17.2" />
    </>
  ),
  assignment: (
    <>
      <path d="M8 4h8l1 2h2v15H5V6h2l1-2Z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </>
  ),
  sell: (
    <>
      <path d="M20 13 11 22 3 14V4h10l7 7Z" />
      <path d="M7.5 8.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 16.2 16.2" />
    </>
  ),
  move_to_inbox: (
    <>
      <path d="M4 14v5h16v-5" />
      <path d="M4 14h4l2 3h4l2-3h4" />
      <path d="M12 3v10" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
    </>
  ),
  outbox: (
    <>
      <path d="M4 14v5h16v-5" />
      <path d="M4 14h4l2 3h4l2-3h4" />
      <path d="M12 13V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
    </>
  ),
  upload_file: (
    <>
      <path d="M6 21h12V9l-5-5H6v17Z" />
      <path d="M13 4v5h5" />
      <path d="M12 17v-6" />
      <path d="M9.5 13.5 12 11l2.5 2.5" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V4h16v16H4Z" />
      <path d="M8 16v-4" />
      <path d="M12 16V8" />
      <path d="M16 16v-6" />
    </>
  ),
  fact_check: (
    <>
      <path d="M4 5h16v14H4V5Z" />
      <path d="M8 9h5" />
      <path d="M8 13h4" />
      <path d="m15 14 1.5 1.5L20 12" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7.3 7.3 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-1.7-1L14.5 3h-5L9.2 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.3 7.3 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 3h5l.3-3a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
    </>
  ),
  shopping_cart: (
    <>
      <path d="M4 5h2l2 11h10l2-8H8" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  request_quote: (
    <>
      <path d="M6 3h12v18H6V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M12 17c1.8 0 3-1 3-2.3S13.8 12.5 12 12.5s-3-1-3-2.3S10.2 8 12 8" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V10l6 3v-3l6 3V8h6v13H3Z" />
      <path d="M7 17h2" />
      <path d="M12 17h2" />
      <path d="M17 17h2" />
    </>
  ),
  euro: (
    <>
      <path d="M17 5.5A7 7 0 1 0 17 18.5" />
      <path d="M5 10h9" />
      <path d="M5 14h8" />
    </>
  ),
  sync: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M18 12a6 6 0 0 0-10.5-4" />
      <path d="M6 12a6 6 0 0 0 10.5 4" />
    </>
  ),
  delete: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V4h6v3" />
      <path d="M8 7l1 14h6l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  check_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  edit_square: (
    <>
      <path d="M5 5h10v14H5V5Z" />
      <path d="M14 4l6 6" />
      <path d="M13 13 20 6" />
    </>
  ),
  trending_up: (
    <>
      <path d="M4 16 9 11l4 4 7-8" />
      <path d="M15 7h5v5" />
    </>
  ),
  backup: (
    <>
      <path d="M12 3a7 7 0 0 1 7 7h2l-3 3-3-3h2a5 5 0 1 0-1.5 3.5" />
      <path d="M12 8v5l3 2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  straighten: (
    <>
      <path d="M4 17 17 4l3 3L7 20l-3-3Z" />
      <path d="M7 14l2 2" />
      <path d="M10 11l2 2" />
      <path d="M13 8l2 2" />
    </>
  ),
  bar_chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 17v-5" />
      <path d="M12 17V8" />
      <path d="M16 17v-7" />
    </>
  ),
  local_fire_department: (
    <>
      <path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-1 3-2 4 0-4-2-7-5-9 .5 4-3 6-3 11 0 5 3 8 7 8Z" />
    </>
  ),
  push_pin: (
    <>
      <path d="M14 4 20 10l-3 1-4 4-1 5-2-2 1-5-4-4-4 1 6-6 5 0Z" />
    </>
  ),
  construction: (
    <>
      <path d="M14 6 6 14" />
      <path d="M5 15l4 4" />
      <path d="M16 4l4 4" />
      <path d="M15 5l4 4" />
    </>
  ),
  manage_accounts: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c.7-4 3-6 6-6s5.3 2 6 6" />
      <circle cx="18" cy="15" r="2" />
      <path d="M18 11v1" />
      <path d="M18 18v1" />
      <path d="M14 15h1" />
      <path d="M21 15h1" />
    </>
  ),
  history_edu: (
    <>
      <path d="M4 19V5h10l6 6v8H4Z" />
      <path d="M14 5v6h6" />
      <path d="M8 15h8" />
    </>
  ),
  folder_open: (
    <>
      <path d="M3 19 5 8h6l2 2h8l-2 9H3Z" />
      <path d="M5 8V5h6l2 2h6v3" />
    </>
  ),
};

export default function Icon({ name, className = '', title, ...props }) {
  const content = ICONS[name] || ICONS.analytics;

  return (
    <svg
      className={`app-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  );
}

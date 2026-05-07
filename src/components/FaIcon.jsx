const ALIASES = {
  entrata: 'boxOpen',
  uscita: 'upload',
  reintegro: 'sync',
  rettifica: 'edit',

  move_to_inbox: 'boxOpen',
  outbox: 'upload',
  inventory: 'box',
  inventory_2: 'box',
  warning: 'warning',
  block: 'ban',
  assignment: 'clipboard',
  notifications: 'bell',
  sell: 'tag',
  search: 'search',
  upload_file: 'fileUpload',
  analytics: 'chart',
  fact_check: 'checkList',
  filter_alt: 'filter',
  shopping_cart: 'cart',
  request_quote: 'invoice',
  folder_open: 'folder',
  factory: 'factory',
  euro: 'euro',
  delete: 'trash',
  check_circle: 'checkCircle',
  trending_up: 'trend',
  backup: 'database',
  database: 'database',
  straighten: 'ruler',
  bar_chart: 'chart',
  local_fire_department: 'flame',
  push_pin: 'pin',
  construction: 'tools',
  manage_accounts: 'userGear',
  history_edu: 'history',
  settings: 'gear',
  bolt: 'bolt',

  'fa-box-open': 'boxOpen',
  'fa-arrow-up-from-bracket': 'upload',
  'fa-rotate': 'sync',
  'fa-rotate-right': 'sync',
  'fa-pen-to-square': 'edit',
  'fa-box-archive': 'box',
  'fa-triangle-exclamation': 'warning',
  'fa-ban': 'ban',
  'fa-clipboard-list': 'clipboard',
  'fa-bell': 'bell',
  'fa-tags': 'tag',
  'fa-magnifying-glass': 'search',
  'fa-file-arrow-up': 'fileUpload',
  'fa-chart-simple': 'chart',
  'fa-list-check': 'checkList',
  'fa-filter': 'filter',
  'fa-cart-shopping': 'cart',
  'fa-file-invoice-dollar': 'invoice',
  'fa-folder-open': 'folder',
  'fa-industry': 'factory',
  'fa-euro-sign': 'euro',
  'fa-trash-can': 'trash',
  'fa-circle-check': 'checkCircle',
  'fa-arrow-trend-up': 'trend',
  'fa-database': 'database',
  'fa-ruler': 'ruler',
  'fa-chart-column': 'chart',
  'fa-fire': 'flame',
  'fa-thumbtack': 'pin',
  'fa-screwdriver-wrench': 'tools',
  'fa-user-gear': 'userGear',
  'fa-clock-rotate-left': 'history',
  'fa-gear': 'gear',
};

const ICONS = {
  box: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  boxOpen: (
    <>
      <path d="M4 8h16v11H4V8Z" />
      <path d="M4 8l3-4h10l3 4" />
      <path d="M9 12h6" />
      <path d="M12 15V9" />
    </>
  ),
  upload: (
    <>
      <path d="M4 17v3h16v-3" />
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
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
  edit: (
    <>
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="M13 7l4 4" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.8 6.8 17.2 17.2" />
    </>
  ),
  clipboard: (
    <>
      <path d="M8 4h8l1 2h2v15H5V6h2l1-2Z" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </>
  ),
  tag: (
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
  fileUpload: (
    <>
      <path d="M6 21h12V9l-5-5H6v17Z" />
      <path d="M13 4v5h5" />
      <path d="M12 17v-6" />
      <path d="M9.5 13.5 12 11l2.5 2.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 17v-5" />
      <path d="M12 17V8" />
      <path d="M16 17v-7" />
    </>
  ),
  checkList: (
    <>
      <path d="M4 5h16v14H4V5Z" />
      <path d="M8 10h5" />
      <path d="M8 15h4" />
      <path d="m15 15 1.5 1.5L20 13" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
    </>
  ),
  cart: (
    <>
      <path d="M4 5h2l2 11h10l2-8H8" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M10 16h4" />
    </>
  ),
  folder: (
    <>
      <path d="M3 19 5 8h6l2 2h8l-2 9H3Z" />
      <path d="M5 8V5h6l2 2h6v3" />
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
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V4h6v3" />
      <path d="M8 7l1 14h6l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16 9 11l4 4 7-8" />
      <path d="M15 7h5v5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  ruler: (
    <>
      <path d="M4 17 17 4l3 3L7 20l-3-3Z" />
      <path d="M7 14l2 2" />
      <path d="M10 11l2 2" />
      <path d="M13 8l2 2" />
    </>
  ),
  flame: (
    <>
      <path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-1 3-2 4 0-4-2-7-5-9 .5 4-3 6-3 11 0 5 3 8 7 8Z" />
    </>
  ),
  pin: (
    <>
      <path d="M14 4 20 10l-3 1-4 4-1 5-2-2 1-5-4-4-4 1 6-6h5Z" />
    </>
  ),
  tools: (
    <>
      <path d="M14 6 6 14" />
      <path d="M5 15l4 4" />
      <path d="M16 4l4 4" />
      <path d="M15 5l4 4" />
    </>
  ),
  userGear: (
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
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7.3 7.3 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-1.7-1L14.5 3h-5L9.2 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.3 7.3 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 3h5l.3-3a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" />
    </>
  ),
};

export default function FaIcon({ name, className = '', title }) {
  const key = ALIASES[name] || name || 'box';
  const icon = ICONS[key] || ICONS.box;

  return (
    <svg
      className={`fa-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      {icon}
    </svg>
  );
}

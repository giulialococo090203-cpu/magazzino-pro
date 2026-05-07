const ICON_LABELS = {
  entrata: 'IN',
  move_to_inbox: 'IN',
  uscita: 'OUT',
  outbox: 'OUT',
  reintegro: '↻',
  sync: '↻',
  rettifica: 'ED',
  edit_square: 'ED',

  inventory: 'ST',
  inventory_2: 'ST',
  box: 'BX',
  archive: 'AR',
  archive_box: 'AR',

  warning: '!',
  block: 'NO',
  assignment: 'LS',
  clipboard: 'LS',
  notifications: 'NT',
  sell: 'TG',
  tag: 'TG',
  tags: 'TG',
  search: '⌕',

  upload_file: 'UP',
  file_upload: 'UP',
  file: 'DOC',
  request_quote: 'PO',
  invoice: 'INV',
  folder_open: 'DIR',

  analytics: 'CH',
  bar_chart: 'CH',
  chart: 'CH',
  dashboard: 'DB',
  trending_up: 'TR',
  bolt: '⚡',

  factory: 'FR',
  supplier: 'FR',
  euro: '€',
  delete: 'DEL',
  check_circle: 'OK',
  backup: 'BK',
  database: 'DB',
  straighten: 'UM',
  local_fire_department: 'TOP',
  push_pin: 'PIN',
  construction: 'MT',
  manage_accounts: 'UT',
  users: 'UT',
  history_edu: 'LOG',
  history: 'LOG',
  settings: 'SET',
  filter_alt: 'FLT',
  shopping_cart: 'ORD',

  // eventuali residui Font Awesome
  'fa-box-open': 'IN',
  'fa-arrow-up-from-bracket': 'OUT',
  'fa-rotate': '↻',
  'fa-rotate-right': '↻',
  'fa-pen-to-square': 'ED',
  'fa-box-archive': 'ST',
  'fa-triangle-exclamation': '!',
  'fa-ban': 'NO',
  'fa-clipboard-list': 'LS',
  'fa-bell': 'NT',
  'fa-tags': 'TG',
  'fa-magnifying-glass': '⌕',
  'fa-file-arrow-up': 'UP',
  'fa-chart-simple': 'CH',
  'fa-list-check': 'LS',
  'fa-filter': 'FLT',
  'fa-cart-shopping': 'ORD',
  'fa-file-invoice-dollar': 'INV',
  'fa-folder-open': 'DIR',
  'fa-industry': 'FR',
  'fa-euro-sign': '€',
  'fa-trash-can': 'DEL',
  'fa-circle-check': 'OK',
  'fa-arrow-trend-up': 'TR',
  'fa-database': 'DB',
  'fa-ruler': 'UM',
  'fa-chart-column': 'CH',
  'fa-fire': 'TOP',
  'fa-thumbtack': 'PIN',
  'fa-screwdriver-wrench': 'MT',
  'fa-user-gear': 'UT',
  'fa-clock-rotate-left': 'LOG',
  'fa-gear': 'SET',
};

export default function AppIcon({ name, className = '', title }) {
  const label = ICON_LABELS[name] || String(name || '•').slice(0, 3).toUpperCase();

  return (
    <span
      className={`app-text-icon ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      title={title}
    >
      {label}
    </span>
  );
}

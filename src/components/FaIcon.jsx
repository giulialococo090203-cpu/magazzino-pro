const ICON_MAP = {
  entrata: 'fa-box-open',
  uscita: 'fa-arrow-up-from-bracket',
  reintegro: 'fa-rotate',
  rettifica: 'fa-pen-to-square',

  move_to_inbox: 'fa-box-open',
  outbox: 'fa-arrow-up-from-bracket',
  sync: 'fa-rotate-right',
  edit_square: 'fa-pen-to-square',

  inventory: 'fa-box-archive',
  inventory_2: 'fa-box-archive',
  warning: 'fa-triangle-exclamation',
  block: 'fa-ban',
  assignment: 'fa-clipboard-list',
  notifications: 'fa-bell',
  sell: 'fa-tags',
  search: 'fa-magnifying-glass',
  upload_file: 'fa-file-arrow-up',
  analytics: 'fa-chart-simple',
  fact_check: 'fa-list-check',
  filter_alt: 'fa-filter',
  shopping_cart: 'fa-cart-shopping',
  request_quote: 'fa-file-invoice-dollar',
  folder_open: 'fa-folder-open',
  factory: 'fa-industry',
  euro: 'fa-euro-sign',
  delete: 'fa-trash-can',
  check_circle: 'fa-circle-check',
  trending_up: 'fa-arrow-trend-up',
  backup: 'fa-database',
  database: 'fa-database',
  straighten: 'fa-ruler',
  bar_chart: 'fa-chart-column',
  local_fire_department: 'fa-fire',
  push_pin: 'fa-thumbtack',
  construction: 'fa-screwdriver-wrench',
  manage_accounts: 'fa-user-gear',
  history_edu: 'fa-clock-rotate-left',
  settings: 'fa-gear',
};

export default function FaIcon({ name, className = '', title }) {
  const iconClass = ICON_MAP[name] || name || 'fa-circle';

  return (
    <i
      className={`fa-solid ${iconClass} fa-icon ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}

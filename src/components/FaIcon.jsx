const ICON_MAP = {
  entrata: 'fa-box-open',
  uscita: 'fa-arrow-up-from-bracket',
  reintegro: 'fa-rotate',
  rettifica: 'fa-pen-to-square',

  inventory: 'fa-box-archive',
  warning: 'fa-triangle-exclamation',
  block: 'fa-ban',
  movements: 'fa-clipboard-list',
  notifications: 'fa-bell',
  categories: 'fa-tags',
  search: 'fa-magnifying-glass',
  invoice: 'fa-file-invoice',
  quote: 'fa-file-invoice-dollar',
  folder: 'fa-folder-open',
  supplier: 'fa-industry',
  chart: 'fa-chart-simple',
  money: 'fa-euro-sign',
  settings: 'fa-gear',
  delete: 'fa-trash-can',
  check: 'fa-circle-check',
  sync: 'fa-rotate-right',
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

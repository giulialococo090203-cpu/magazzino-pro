import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Ban,
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  Download,
  Edit3,
  Euro,
  Factory,
  FileCheck2,
  FileInput,
  FileText,
  Filter,
  FolderOpen,
  Gauge,
  History,
  Package,
  PackageOpen,
  Pencil,
  RefreshCcw,
  RotateCw,
  Ruler,
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Tags,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Upload,
  UploadCloud,
  UserCog,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';

const ICONS = {
  // movimenti
  entrata: PackageOpen,
  uscita: Upload,
  reintegro: RefreshCcw,
  rettifica: Pencil,

  move_to_inbox: PackageOpen,
  outbox: Upload,
  sync: RotateCw,
  edit_square: Edit3,

  // magazzino / kpi
  inventory: Package,
  inventory_2: Package,
  box: Box,
  archive: Archive,
  archive_box: Archive,
  warning: TriangleAlert,
  block: Ban,
  assignment: ClipboardList,
  clipboard: ClipboardList,
  notifications: Bell,
  sell: Tag,
  tag: Tag,
  tags: Tags,
  search: Search,

  // file / fatture
  upload_file: FileInput,
  file_upload: FileInput,
  file: FileText,
  request_quote: FileCheck2,
  invoice: FileCheck2,
  folder_open: FolderOpen,

  // dashboard / analisi
  analytics: BarChart3,
  bar_chart: BarChart3,
  chart: BarChart3,
  dashboard: Gauge,
  trending_up: TrendingUp,
  bolt: Zap,

  // configurazione / admin
  factory: Factory,
  supplier: Factory,
  euro: Euro,
  delete: Trash2,
  check_circle: CheckCircle2,
  backup: Database,
  database: Database,
  straighten: Ruler,
  local_fire_department: Zap,
  push_pin: Tag,
  construction: Wrench,
  manage_accounts: UserCog,
  users: Users,
  history_edu: History,
  history: Clock3,
  settings: Settings,
  filter_alt: Filter,
  shopping_cart: ShoppingCart,

  // alternative già finite nel codice
  download: Download,
  upload: UploadCloud,

  // nomi Font Awesome eventualmente rimasti
  'fa-box-open': PackageOpen,
  'fa-arrow-up-from-bracket': Upload,
  'fa-rotate': RefreshCcw,
  'fa-rotate-right': RotateCw,
  'fa-pen-to-square': Edit3,
  'fa-box-archive': Package,
  'fa-triangle-exclamation': TriangleAlert,
  'fa-ban': Ban,
  'fa-clipboard-list': ClipboardList,
  'fa-bell': Bell,
  'fa-tags': Tags,
  'fa-magnifying-glass': Search,
  'fa-file-arrow-up': FileInput,
  'fa-chart-simple': BarChart3,
  'fa-list-check': ClipboardList,
  'fa-filter': Filter,
  'fa-cart-shopping': ShoppingCart,
  'fa-file-invoice-dollar': FileCheck2,
  'fa-folder-open': FolderOpen,
  'fa-industry': Factory,
  'fa-euro-sign': Euro,
  'fa-trash-can': Trash2,
  'fa-circle-check': CheckCircle2,
  'fa-arrow-trend-up': TrendingUp,
  'fa-database': Database,
  'fa-ruler': Ruler,
  'fa-chart-column': BarChart3,
  'fa-fire': Zap,
  'fa-thumbtack': Tag,
  'fa-screwdriver-wrench': Wrench,
  'fa-user-gear': UserCog,
  'fa-clock-rotate-left': History,
  'fa-gear': Settings,
};

export default function FaIcon({
  name,
  className = '',
  title,
  size,
  strokeWidth = 2,
}) {
  const IconComponent = ICONS[name] || Package;

  return (
    <IconComponent
      className={`fa-icon ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      size={size}
      strokeWidth={strokeWidth}
    >
      {title ? <title>{title}</title> : null}
    </IconComponent>
  );
}

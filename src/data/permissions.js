export const PERMISSIONS = [
  {
    key: 'canViewDashboard',
    label: 'Dashboard datore',
    description: 'Vede la dashboard completa di controllo e statistiche',
    group: 'Controllo',
  },
  {
    key: 'canViewInventory',
    label: 'Giacenza / inventario',
    description: 'Vede la lista materiali in giacenza',
    group: 'Magazzino',
  },
  {
    key: 'canMoveIn',
    label: 'Carico materiale',
    description: 'Può registrare entrate di materiale',
    group: 'Movimenti',
  },
  {
    key: 'canMoveOut',
    label: 'Scarico materiale',
    description: 'Può registrare uscite di materiale',
    group: 'Movimenti',
  },
  {
    key: 'canReintegrate',
    label: 'Reintegro materiale',
    description: 'Può registrare reintegri di materiale',
    group: 'Movimenti',
  },
  {
    key: 'canRectify',
    label: 'Rettifica inventario',
    description: 'Può correggere manualmente le quantità',
    group: 'Movimenti',
  },
  {
    key: 'canViewHistory',
    label: 'Storico movimenti',
    description: 'Vede lo storico completo dei movimenti',
    group: 'Controllo',
  },
  {
    key: 'canImportInvoices',
    label: 'Importa fatture / inserimento manuale',
    description: 'Può importare fatture o inserire componenti manualmente',
    group: 'Fatture',
  },
  {
    key: 'canManageCategories',
    label: 'Gestione categorie',
    description: 'Può creare e modificare categorie',
    group: 'Configurazione',
  },
  {
    key: 'canManageThresholds',
    label: 'Soglie scorta',
    description: 'Può modificare soglie minime e scorte',
    group: 'Configurazione',
  },
  {
    key: 'canViewNotifications',
    label: 'Notifiche',
    description: 'Può vedere e gestire le notifiche',
    group: 'Notifiche',
  },
  {
    key: 'canManageMaterials',
    label: 'Anagrafica materiali',
    description: 'Può modificare l’anagrafica completa dei materiali',
    group: 'Gestione',
  },
  {
    key: 'canManageUsers',
    label: 'Gestione utenti',
    description: 'Può creare, modificare, disattivare utenti e permessi',
    group: 'Gestione',
  },
  {
    key: 'canViewAuditLog',
    label: 'Audit log',
    description: 'Può vedere il registro modifiche',
    group: 'Gestione',
  },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  operaio: {
    canViewDashboard: false,
    canViewInventory: true,
    canMoveIn: false,
    canMoveOut: false,
    canReintegrate: false,
    canRectify: false,
    canViewHistory: false,
    canImportInvoices: false,
    canManageCategories: false,
    canManageThresholds: false,
    canViewNotifications: false,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  segretaria: {
    canViewDashboard: false,
    canViewInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: false,
    canViewHistory: false,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canViewNotifications: true,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  magazziniere: {
    canViewDashboard: false,
    canViewInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: false,
    canViewHistory: false,
    canImportInvoices: true,
    canManageCategories: false,
    canManageThresholds: false,
    canViewNotifications: true,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  datore: {
    canViewDashboard: true,
    canViewInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: true,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canViewNotifications: true,
    canManageMaterials: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },
};

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'admin') return 'datore';
  if (normalized === 'controllo') return 'datore';
  if (normalized === 'segreteria') return 'segretaria';
  if (normalized === 'operatore') return 'magazziniere';

  return normalized || 'operaio';
}

export function getDefaultPermissionsByRole(role) {
  const normalized = normalizeRole(role);

  return {
    ...(DEFAULT_ROLE_PERMISSIONS[normalized] || DEFAULT_ROLE_PERMISSIONS.operaio),
  };
}

export function getEffectivePermissions(user) {
  const role = normalizeRole(user?.role);
  const base = getDefaultPermissionsByRole(role);
  const custom =
    user?.permissions && typeof user.permissions === 'object'
      ? user.permissions
      : {};

  if (role === 'datore') {
    return {
      ...DEFAULT_ROLE_PERMISSIONS.datore,
      ...custom,
      canViewDashboard: true,
      canManageUsers: true,
    };
  }

  return {
    ...base,
    ...custom,
  };
}

export function hasPermission(user, permissionKey) {
  const permissions = getEffectivePermissions(user);
  return Boolean(permissions?.[permissionKey]);
}

export function getDefaultRouteForUser(user) {
  if (hasPermission(user, 'canViewDashboard')) return '/';
  if (hasPermission(user, 'canViewInventory')) return '/inventario';
  if (hasPermission(user, 'canImportInvoices')) return '/importa';
  if (hasPermission(user, 'canViewNotifications')) return '/controllo/notifiche';

  return '/inventario';
}

export function groupPermissions() {
  return PERMISSIONS.reduce((groups, permission) => {
    if (!groups[permission.group]) groups[permission.group] = [];
    groups[permission.group].push(permission);
    return groups;
  }, {});
}
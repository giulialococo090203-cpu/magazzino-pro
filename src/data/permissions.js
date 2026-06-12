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
    key: 'canExportInventory',
    label: 'Esporta inventario',
    description: 'Può esportare l\u2019inventario in Excel, CSV o PDF',
    group: 'Magazzino',
  },
  {
    key: 'canManageReorderProposals',
    label: 'Riordino automatico',
    description: 'Può generare proposte d\u2019ordine dai materiali sotto soglia',
    group: 'Magazzino',
  },
  {
    key: 'canPhysicalInventory',
    label: 'Inventario fisico',
    description: 'Può effettuare conteggi fisici, rilevare differenze e applicare rettifiche',
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
    label: 'Rettifica magazzino',
    description: 'Può correggere manualmente le quantità di magazzino',
    group: 'Movimenti',
  },
  {
    key: 'canViewHistory',
    label: 'Storico movimenti',
    description: 'Vede lo storico completo dei movimenti',
    group: 'Controllo',
  },
  {
    key: 'canExportMovements',
    label: 'Esporta storico movimenti',
    description: 'Può esportare lo storico dei movimenti in Excel, CSV o PDF',
    group: 'Controllo',
  },
  {
    key: 'canImportInvoices',
    label: 'Importa fatture / archivio fatture',
    description:
      'Può importare fatture, inserire componenti manualmente e vedere l\u2019archivio dei documenti caricati',
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
    key: 'canManagePriceSettings',
    label: 'Impostazioni prezzi',
    description: 'Può modificare formule prezzi, IVA e nome del prezzo riservato',
    group: 'Configurazione',
  },
  {
    key: 'canViewNotifications',
    label: 'Notifiche',
    description: 'Può vedere e gestire le notifiche',
    group: 'Notifiche',
  },
  {
    key: 'canDeleteNotifications',
    label: 'Elimina notifiche',
    description: 'Può eliminare singole notifiche, notifiche lette o tutto lo storico notifiche',
    group: 'Notifiche',
  },
  {
    key: 'canManageMaterials',
    label: 'Anagrafica materiali',
    description: 'Può modificare l\u2019anagrafica completa dei materiali',
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
    canExportInventory: false,
    canManageReorderProposals: false,
    canPhysicalInventory: false,
    canMoveIn: false,
    canMoveOut: false,
    canReintegrate: false,
    canRectify: false,
    canViewHistory: false,
    canExportMovements: false,
    canImportInvoices: false,
    canManageCategories: false,
    canManageThresholds: false,
    canManagePriceSettings: false,
    canViewNotifications: false,
    canDeleteNotifications: false,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  segretaria: {
    canViewDashboard: false,
    canViewInventory: true,
    canExportInventory: true,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: false,
    canExportMovements: false,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canManagePriceSettings: false,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  magazziniere: {
    canViewDashboard: false,
    canViewInventory: true,
    canExportInventory: false,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: false,
    canExportMovements: false,
    canImportInvoices: true,
    canManageCategories: false,
    canManageThresholds: false,
    canManagePriceSettings: false,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: false,
    canManageUsers: false,
    canViewAuditLog: false,
  },

  datore: {
    canViewDashboard: true,
    canViewInventory: true,
    canExportInventory: true,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: true,
    canExportMovements: true,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canManagePriceSettings: true,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },

  // Ruoli super admin: permessi identici al datore (massimi)
  sviluppatore: {
    canViewDashboard: true,
    canViewInventory: true,
    canExportInventory: true,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: true,
    canExportMovements: true,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canManagePriceSettings: true,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },

  super_admin: {
    canViewDashboard: true,
    canViewInventory: true,
    canExportInventory: true,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: true,
    canExportMovements: true,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canManagePriceSettings: true,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },

  admin_tecnico: {
    canViewDashboard: true,
    canViewInventory: true,
    canExportInventory: true,
    canManageReorderProposals: true,
    canPhysicalInventory: true,
    canMoveIn: true,
    canMoveOut: true,
    canReintegrate: true,
    canRectify: true,
    canViewHistory: true,
    canExportMovements: true,
    canImportInvoices: true,
    canManageCategories: true,
    canManageThresholds: true,
    canManagePriceSettings: true,
    canViewNotifications: true,
    canDeleteNotifications: true,
    canManageMaterials: true,
    canManageUsers: true,
    canViewAuditLog: true,
  },
};

/**
 * Normalizza il ruolo utente verso uno dei valori canonici.
 */
export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'admin') return 'datore';
  if (normalized === 'controllo') return 'datore';
  if (normalized === 'segreteria') return 'segretaria';
  if (normalized === 'operatore') return 'magazziniere';

  return normalized || 'operaio';
}

/**
 * Restituisce true se il ruolo è un super admin / programmatore.
 */
export function isSuperAdminRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'sviluppatore' || r === 'super_admin' || r === 'admin_tecnico';
}

/**
 * Restituisce true se l'utente è un super admin o programmatore
 * (basato su ruolo e/o email di fallback).
 */
export function isSuperAdminUser(user = {}) {
  return (
    isSuperAdminRole(user?.role) ||
    String(user?.email || '').trim().toLowerCase() === 'giulia@gmail.com'
  );
}

export function getDefaultPermissionsByRole(role) {
  const normalized = normalizeRole(role);

  return {
    ...(DEFAULT_ROLE_PERMISSIONS[normalized] || DEFAULT_ROLE_PERMISSIONS.operaio),
  };
}

export function getEffectivePermissions(user) {
  const role = normalizeRole(user?.role);

  // Super admin / programmatore: tutti i permessi, nessuna restrizione
  if (isSuperAdminRole(role)) {
    return { ...DEFAULT_ROLE_PERMISSIONS.datore };
  }

  const base = getDefaultPermissionsByRole(role);
  const custom =
    user?.permissions && typeof user.permissions === 'object'
      ? user.permissions
      : {};

  if (role === 'datore') {
    /*
     * Il datore conserva sempre tutti i permessi del ruolo.
     * Eventuali valori personalizzati non possono togliere
     * le funzionalità principali dell'account aziendale.
     */
    return {
      ...custom,
      ...DEFAULT_ROLE_PERMISSIONS.datore,
    };
  }

  return {
    ...base,
    ...custom,
  };
}

export function hasPermission(user, permissionKey) {
  // Super admin e programmatori bypassano sempre i controlli
  if (isSuperAdminUser(user)) return true;

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
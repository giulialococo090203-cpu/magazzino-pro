// ============================================================
// SUBSCRIPTION PLANS - Gestione funzionalità per abbonamento
// ============================================================

export const SUBSCRIPTION_PLANS = {
  base: {
    label: 'Base',
    description: 'Gestione essenziale del magazzino',
  },
  pro: {
    label: 'Pro',
    description: 'Gestione completa con fatture, fornitori ed economia',
  },
  enterprise: {
    label: 'Enterprise',
    description: 'Controllo avanzato, automazioni, audit e backup',
  },
};

export const FEATURES = {
  // Core comuni
  DASHBOARD: 'dashboard',
  INVENTORY: 'inventory',
  CATEGORIES: 'categories',
  MOVE_IN: 'move_in',
  MOVE_OUT: 'move_out',
  HISTORY_BASE: 'history_base',
  NOTIFICATIONS: 'notifications',
  USERS_BASE: 'users_base',
  EXPORT_INVENTORY_BASE: 'export_inventory_base',

  // Pro
  REINTEGRATE: 'reintegrate',
  RECTIFY: 'rectify',
  HISTORY_ADVANCED: 'history_advanced',
  ADVANCED_FILTERS: 'advanced_filters',
  CLIENTS_OPERATORS: 'clients_operators',
  INVOICES_IMPORT: 'invoices_import',
  INVOICES_ARCHIVE: 'invoices_archive',
  SUPPLIERS: 'suppliers',
  ECONOMIC_REPORTING: 'economic_reporting',
  PRICE_SETTINGS: 'price_settings',
  PRICE_HISTORY: 'price_history',
  EXPORT_ADVANCED: 'export_advanced',

  // Enterprise
  REORDER: 'reorder',
  REORDER_ARCHIVE: 'reorder_archive',
  PHYSICAL_INVENTORY: 'physical_inventory',
  AUDIT_LOG: 'audit_log',
  BACKUP: 'backup',
  ADVANCED_PERMISSIONS: 'advanced_permissions',
};

const PLAN_FEATURES = {
  base: new Set([
    FEATURES.DASHBOARD,
    FEATURES.INVENTORY,
    FEATURES.CATEGORIES,
    FEATURES.MOVE_IN,
    FEATURES.MOVE_OUT,
    FEATURES.NOTIFICATIONS,
    FEATURES.USERS_BASE,
    FEATURES.PRICE_SETTINGS,
    FEATURES.EXPORT_INVENTORY_BASE,
  ]),

  pro: new Set([
    FEATURES.DASHBOARD,
    FEATURES.INVENTORY,
    FEATURES.CATEGORIES,
    FEATURES.MOVE_IN,
    FEATURES.MOVE_OUT,
    FEATURES.HISTORY_BASE,
    FEATURES.NOTIFICATIONS,
    FEATURES.USERS_BASE,
    FEATURES.EXPORT_INVENTORY_BASE,

    FEATURES.REINTEGRATE,
    FEATURES.RECTIFY,
    FEATURES.HISTORY_ADVANCED,
    FEATURES.ADVANCED_FILTERS,
    FEATURES.CLIENTS_OPERATORS,
    FEATURES.INVOICES_IMPORT,
    FEATURES.INVOICES_ARCHIVE,
    FEATURES.SUPPLIERS,
    FEATURES.ECONOMIC_REPORTING,
    FEATURES.PRICE_SETTINGS,
    FEATURES.PRICE_HISTORY,
    FEATURES.EXPORT_ADVANCED,
  ]),

  enterprise: new Set([
    FEATURES.DASHBOARD,
    FEATURES.INVENTORY,
    FEATURES.CATEGORIES,
    FEATURES.MOVE_IN,
    FEATURES.MOVE_OUT,
    FEATURES.HISTORY_BASE,
    FEATURES.NOTIFICATIONS,
    FEATURES.USERS_BASE,
    FEATURES.EXPORT_INVENTORY_BASE,

    FEATURES.REINTEGRATE,
    FEATURES.RECTIFY,
    FEATURES.HISTORY_ADVANCED,
    FEATURES.ADVANCED_FILTERS,
    FEATURES.CLIENTS_OPERATORS,
    FEATURES.INVOICES_IMPORT,
    FEATURES.INVOICES_ARCHIVE,
    FEATURES.SUPPLIERS,
    FEATURES.ECONOMIC_REPORTING,
    FEATURES.PRICE_SETTINGS,
    FEATURES.PRICE_HISTORY,
    FEATURES.EXPORT_ADVANCED,

    FEATURES.REORDER,
    FEATURES.REORDER_ARCHIVE,
    FEATURES.PHYSICAL_INVENTORY,
    FEATURES.AUDIT_LOG,
    FEATURES.BACKUP,
    FEATURES.ADVANCED_PERMISSIONS,
  ]),
};

export function normalizeSubscriptionPlan(plan) {
  const normalized = String(plan || '').trim().toLowerCase();

  if (normalized === 'enterprise') return 'enterprise';
  if (normalized === 'pro') return 'pro';
  if (normalized === 'base') return 'base';

  return 'base';
}

export function getUserPlan(user) {
  return normalizeSubscriptionPlan(
    user?.subscriptionPlan ||
      user?.plan ||
      user?.piano ||
      user?.selectedCompany?.plan ||
      user?.selectedCompany?.piano
  );
}

export function hasPlanFeature(userOrPlan, feature) {
  const plan =
    typeof userOrPlan === 'string'
      ? normalizeSubscriptionPlan(userOrPlan)
      : getUserPlan(userOrPlan);

  return PLAN_FEATURES[plan]?.has(feature) || false;
}

export function getPlanLabel(plan) {
  const normalized = normalizeSubscriptionPlan(plan);
  return SUBSCRIPTION_PLANS[normalized]?.label || 'Base';
}

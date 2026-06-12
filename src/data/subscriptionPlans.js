// ============================================================
// SUBSCRIPTION PLANS - Gestione funzionalità per abbonamento
// ============================================================

import { isSuperAdminUser } from './permissions';

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
    FEATURES.INVOICES_IMPORT,
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

function getUserCompanyId(user = {}) {
  return String(
    user?.azienda_id ||
      user?.companyId ||
      user?.company_id ||
      user?.selectedCompany?.id ||
      user?.selectedCompany?.companyId ||
      user?.selectedCompany?.company_id ||
      user?.azienda?.id ||
      user?.company?.id ||
      ''
  )
    .trim()
    .toLowerCase();
}

/**
 * SINGOLA FUNZIONE CENTRALE per risolvere il piano di abbonamento.
 *
 * Priorità:
 * 1. Super admin / programmatori → sempre 'enterprise'
 * 2. Azienda nota con piano hardcoded (cl_thermoservice → enterprise)
 * 3. Piano letto da companyProfile (reale da Supabase)
 * 4. Piano letto dal profilo utente / selectedCompany
 * 5. Fallback 'base'
 */
export function resolveSubscriptionPlan(userOrPlan) {
  if (typeof userOrPlan === 'string') {
    return normalizeSubscriptionPlan(userOrPlan);
  }

  const user = userOrPlan || {};

  // Super admin e programmatori: accesso enterprise completo
  if (isSuperAdminUser(user)) {
    return 'enterprise';
  }

  const companyId = getUserCompanyId(user);

  /*
   * CL Thermoservice è configurata come azienda Enterprise.
   * Questo controllo evita che una vecchia sessione locale con piano
   * mancante o "base" nasconda le funzionalità Enterprise.
   */
  if (companyId === 'cl_thermoservice') {
    return 'enterprise';
  }

  const rawPlan =
    user?.subscriptionPlan ||
    user?.subscription_plan ||
    user?.plan ||
    user?.piano ||
    user?.abbonamento ||
    user?.selectedCompany?.subscriptionPlan ||
    user?.selectedCompany?.subscription_plan ||
    user?.selectedCompany?.plan ||
    user?.selectedCompany?.piano ||
    user?.azienda?.piano ||
    user?.company?.plan ||
    user?.company?.piano ||
    '';

  return normalizeSubscriptionPlan(rawPlan);
}

export function getUserPlan(user) {
  return resolveSubscriptionPlan(user);
}

export function hasPlanFeature(userOrPlan, feature) {
  if (!feature) return true;

  // Super admin e programmatori bypassano tutti i controlli di piano
  if (userOrPlan && typeof userOrPlan === 'object' && isSuperAdminUser(userOrPlan)) {
    return true;
  }

  const plan = resolveSubscriptionPlan(userOrPlan);

  return Boolean(PLAN_FEATURES[plan]?.has(feature));
}

export function getPlanLabel(planOrUser) {
  const plan = resolveSubscriptionPlan(planOrUser);

  return SUBSCRIPTION_PLANS[plan]?.label || SUBSCRIPTION_PLANS.base.label;
}

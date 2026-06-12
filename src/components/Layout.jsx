import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import {
  hasPermission,
  getDefaultRouteForUser,
  normalizeRole,
} from '../data/permissions';
import { useState, useEffect } from 'react';
import FaIcon from './FaIcon';
import SafeIcon from './SafeIcon';
import { FEATURES, hasPlanFeature, getPlanLabel } from '../data/subscriptionPlans';

const SIDEBAR_ICON_MAP = {
  inventory_2: 'inventory',
  move_to_inbox: 'download',
  outbox: 'upload',
  sync: 'backup',
  edit_square: 'check',
  calendar_month: 'chart',

  receipt_long: 'receipt',
  shopping_cart: 'inventory',
  request_quote: 'receipt',
  upload_file: 'upload',
  folder_open: 'folder',
  factory: 'inventory',

  fact_check: 'check',
  settings: 'settings',
  notifications: 'bell',

  analytics: 'chart',
  trending_up: 'chart',
  euro: 'euro',

  construction: 'inventory',
  sell: 'inventory',
  manage_accounts: 'users',
  backup: 'backup',
  history_edu: 'receipt',

  admin_panel_settings: 'settings',
  business_center: 'inventory',
};

function SidebarIcon({ name, className = '' }) {
  return <SafeIcon name={SIDEBAR_ICON_MAP[name] || 'dashboard'} className={className} size={22} />;
}

function getRoleLabel(role) {
  const normalized = normalizeRole(role);

  if (normalized === 'datore') return 'Datore';
  if (normalized === 'segretaria') return 'Segretaria';
  if (normalized === 'magazziniere') return 'Magazziniere';
  if (normalized === 'operaio') return 'Operaio';

  return role || 'Utente';
}

const NAV_SECTIONS = [
  {
    title: 'Magazzino',
    icon: 'inventory_2',
    items: [
      {
        path: '/inventario',
        label: 'Giacenza',
        icon: 'inventory_2',
        permission: 'canViewInventory',
        feature: FEATURES.INVENTORY,
      },
      {
        path: '/movimento/entrata',
        label: 'Carico Materiale',
        icon: 'move_to_inbox',
        permission: 'canMoveIn',
        feature: FEATURES.MOVE_IN,
      },
      {
        path: '/movimento/uscita',
        label: 'Scarica Materiale',
        icon: 'outbox',
        permission: 'canMoveOut',
        feature: FEATURES.MOVE_OUT,
      },
      {
        path: '/movimento/reintegro',
        label: 'Reintegra Materiale',
        icon: 'sync',
        permission: 'canReintegrate',
        feature: FEATURES.REINTEGRATE,
      },
      {
        path: '/movimento/rettifica',
        label: 'Rettifica Magazzino',
        icon: 'edit_square',
        permission: 'canRectify',
        feature: FEATURES.RECTIFY,
      },
      {
        path: '/storico',
        label: 'Storico Movimenti',
        icon: 'calendar_month',
        permission: 'canViewHistory',
        feature: FEATURES.HISTORY_BASE,
      },
    ],
  },
  {
    title: 'Acquisti e Fatture',
    icon: 'receipt_long',
    items: [
      {
        path: '/riordino',
        label: 'Riordino Automatico',
        icon: 'shopping_cart',
        permission: 'canManageReorderProposals',
        feature: FEATURES.REORDER,
      },
      {
        path: '/proposte-ordine',
        label: 'Proposte Ordine',
        icon: 'request_quote',
        permission: 'canManageReorderProposals',
        feature: FEATURES.REORDER_ARCHIVE,
      },
      {
        path: '/importa',
        label: 'Importa / Inserisci',
        icon: 'upload_file',
        permission: 'canImportInvoices',
        feature: FEATURES.INVOICES_IMPORT,
      },
      {
        path: '/fatture',
        label: 'Archivio Fatture',
        icon: 'folder_open',
        permission: 'canImportInvoices',
        feature: FEATURES.INVOICES_ARCHIVE,
      },
      {
        path: '/gestione/fornitori',
        label: 'Fornitori',
        icon: 'factory',
        permission: 'canManageMaterials',
        feature: FEATURES.SUPPLIERS,
      },
    ],
  },
  {
    title: 'Controllo',
    icon: 'fact_check',
    items: [
      {
        path: '/inventario-fisico',
        label: 'Inventario Fisico',
        icon: 'fact_check',
        permission: 'canPhysicalInventory',
        feature: FEATURES.PHYSICAL_INVENTORY,
      },
      {
        path: '/controllo/soglie',
        label: 'Soglie Scorta',
        icon: 'settings',
        permission: 'canManageThresholds',
        feature: FEATURES.NOTIFICATIONS,
      },
      {
        path: '/controllo/notifiche',
        label: 'Notifiche',
        icon: 'notifications',
        permission: 'canViewNotifications',
        feature: FEATURES.NOTIFICATIONS,
        badge: true,
      },
    ],
  },
  {
    title: 'Analisi',
    icon: 'analytics',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: 'analytics',
        permission: 'canViewDashboard',
        feature: FEATURES.DASHBOARD,
      },
      {
        path: '/gestione/rendicontazione',
        label: 'Rendicontazione',
        icon: 'receipt_long',
        permission: 'canManageMaterials',
        feature: FEATURES.ECONOMIC_REPORTING,
      },
      {
        path: '/gestione/storico-prezzi',
        label: 'Storico Prezzi',
        icon: 'trending_up',
        permission: 'canManagePriceSettings',
        feature: FEATURES.PRICE_HISTORY,
      },
      {
        path: '/gestione/prezzi',
        label: 'Impostazioni Prezzi',
        icon: 'euro',
        permission: 'canManagePriceSettings',
        feature: FEATURES.PRICE_SETTINGS,
      },
    ],
  },
  {
    title: 'Configurazione',
    icon: 'settings',
    items: [
      {
        path: '/gestione/materiali',
        label: 'Anagrafica Materiali',
        icon: 'construction',
        permission: 'canManageMaterials',
        feature: FEATURES.INVENTORY,
      },
      {
        path: '/gestione/categorie',
        label: 'Categorie',
        icon: 'sell',
        permission: 'canManageCategories',
        feature: FEATURES.CATEGORIES,
      },
      {
        path: '/gestione/utenti',
        label: 'Utenti',
        icon: 'manage_accounts',
        permission: 'canManageUsers',
        feature: FEATURES.USERS_BASE,
      },
      {
        path: '/gestione/backup',
        label: 'Backup Sistema',
        icon: 'backup',
        permission: 'canManageUsers',
        feature: FEATURES.BACKUP,
      },
      {
        path: '/gestione/log',
        label: 'Registro modifiche',
        icon: 'history_edu',
        permission: 'canViewAuditLog',
        feature: FEATURES.AUDIT_LOG,
      },
    ],
  },
];

const PROGRAMMER_NAV_SECTIONS = [
  {
    title: 'Controllo Software',
    icon: 'admin_panel_settings',
    items: [
      {
        path: '/super/aziende',
        label: 'Monitoraggio Aziendale',
        icon: 'business_center',
      },
    ],
  },
];

function isProgrammerMode(user) {
  const selectedCompany = user?.selectedCompany || {};
  const companyId = String(selectedCompany.id || '').trim().toLowerCase();
  const companyCode = String(selectedCompany.code || selectedCompany.codice || '').trim().toUpperCase();

  return (
    Boolean(user?.programmerMode) ||
    companyId === 'programmatore' ||
    companyCode === 'PROGRAMMATORE'
  );
}

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/inventario': 'Giacenza',
  '/riordino': 'Riordino Automatico',
  '/proposte-ordine': 'Proposte Ordine',
  '/inventario-fisico': 'Inventario Fisico',
  '/movimento/entrata': 'Carico Materiale',
  '/movimento/uscita': 'Scarica Materiale',
  '/movimento/reintegro': 'Reintegra Materiale',
  '/movimento/rettifica': 'Rettifica Magazzino',
  '/storico': 'Storico Movimenti',
  '/importa': 'Importa / Inserisci',
  '/fatture': 'Archivio Fatture',
  '/gestione/materiali': 'Anagrafica Materiali',
  '/gestione/fornitori': 'Fornitori',
  '/gestione/rendicontazione': 'Rendicontazione Economica',
  '/gestione/categorie': 'Gestione Categorie',
  '/gestione/prezzi': 'Impostazioni Prezzi',
  '/gestione/storico-prezzi': 'Storico Prezzi',
  '/gestione/utenti': 'Gestione Utenti',
  '/gestione/log': 'Registro modifiche',
  '/gestione/backup': 'Backup Sistema',
  '/controllo': 'Dashboard',
  '/controllo/soglie': 'Soglie Scorta',
  '/controllo/notifiche': 'Centro Notifiche',
  '/super/aziende': 'Monitoraggio Aziendale',
};

const SECTION_NAMES = {
  '/controllo/notifiche': 'Notifiche',
  '/controllo/soglie': 'Configurazione',
  '/inventario-fisico': 'Magazzino',
  '/riordino': 'Magazzino',
  '/proposte-ordine': 'Magazzino',
  '/inventario': 'Magazzino',
  '/movimento': 'Magazzino',
  '/storico': 'Magazzino',
  '/importa': 'Fatture',
  '/fatture': 'Fatture',
  '/gestione': 'Configurazione',
  '/super': 'Programmatore',
  '/controllo': 'Controllo Datore',
  '/': 'Generale',
};

function getSection(pathname) {
  const orderedPrefixes = Object.keys(SECTION_NAMES).sort((a, b) => b.length - a.length);

  for (const prefix of orderedPrefixes) {
    if (prefix === '/') {
      if (pathname === '/') return SECTION_NAMES[prefix];
      continue;
    }

    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return SECTION_NAMES[prefix];
    }
  }

  return 'Generale';
}

function isActivePath(currentPath, itemPath) {
  if (itemPath === '/') {
    return currentPath === '/';
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function getActiveSectionTitle(pathname, sections) {
  const activeSection = sections.find((navSection) =>
    navSection.items.some((item) => isActivePath(pathname, item.path))
  );

  return activeSection?.title || sections[0]?.title || '';
}

export default function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [mobileOpenSection, setMobileOpenSection] = useState(null);

  const programmerMode = isProgrammerMode(user);
  const canSeeNotifications = !programmerMode && hasPermission(user, 'canViewNotifications');

  useEffect(() => {
    if (!canSeeNotifications) {
      setUnreadCount(0);
      return undefined;
    }

    let mounted = true;
    let isUpdating = false;

    const updateNotifs = async () => {
      if (isUpdating) return;

      try {
        isUpdating = true;

        const unread = await notificationStore.getUnread();

        if (mounted) {
          setUnreadCount(Array.isArray(unread) ? unread.length : 0);
        }
      } catch (err) {
        console.error('Errore caricamento notifiche:', err);
      } finally {
        isUpdating = false;
      }
    };

    updateNotifs();

    const interval = setInterval(updateNotifs, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [canSeeNotifications]);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);

    return () => {
      window.removeEventListener('resize', updateIsMobile);
    };
  }, []);


  const section = programmerMode ? 'Programmatore' : getSection(location.pathname);
  const pageTitle = programmerMode
    ? 'Monitoraggio Aziendale'
    : PAGE_TITLES[location.pathname] || 'Magazzino';

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displayName = user?.fullName || user?.username || 'Utente';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isSuperCompanyContext =
    String(user?.selectedCompany?.id || '').trim().toLowerCase() === 'programmatore' ||
    String(user?.selectedCompany?.code || '').trim().toUpperCase() === 'PROGRAMMATORE';

  const baseNavSections = NAV_SECTIONS.map((navSection) => {
    const visibleItems = navSection.items.filter((item) =>
      hasPermission(user, item.permission) &&
      (!item.feature || hasPlanFeature(user, item.feature))
    );

    return { ...navSection, items: visibleItems };
  }).filter((navSection) => navSection.items.length > 0);

  const visibleSections = programmerMode
    ? (isSuperCompanyContext ? PROGRAMMER_NAV_SECTIONS : [...PROGRAMMER_NAV_SECTIONS, ...baseNavSections])
    : baseNavSections;

  const activeSectionTitle = getActiveSectionTitle(location.pathname, visibleSections);
  const visibleSectionsKey = visibleSections
    .map((navSection) => navSection.title)
    .join('|');

  useEffect(() => {
    setMobileOpenSection(null);

    if (!activeSectionTitle) return;

    setOpenSections((previous) => {
      const next = {};

      visibleSections.forEach((navSection) => {
        next[navSection.title] = navSection.title === activeSectionTitle;
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);

      const isUnchanged =
        previousKeys.length === nextKeys.length &&
        nextKeys.every((key) => previous[key] === next[key]);

      return isUnchanged ? previous : next;
    });
  }, [activeSectionTitle, location.pathname, visibleSectionsKey]);

  const toggleSection = (title) => {
    setOpenSections((prev) => {
      const isCurrentlyOpen = !!prev[title];
      const next = {};

      visibleSections.forEach((navSection) => {
        next[navSection.title] = false;
      });

      next[title] = !isCurrentlyOpen;

      return next;
    });
  };

return (
    <div className={`app-layout ${isMobile ? "is-mobile" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to={programmerMode ? '/super/aziende' : getDefaultRouteForUser(user)} className="sidebar-logo">
            <img className="workspace-logo-img workspace-logo-img-sidebar" src="/optimized/workspace-logo.webp" alt="WorkSpace" />
            <div className="sidebar-logo-text">
              <h1>WorkSpace</h1>
              <span>{programmerMode ? 'Controllo Software' : 'Gestione Magazzino'}</span>
            </div>
          </Link>
        </div>

        {visibleSections.map((navSection) => {
          const isOpen = openSections[navSection.title];
          const hasActiveItem = navSection.items.some((item) =>
            isActivePath(location.pathname, item.path)
          );

          return (
            <div
              className={`sidebar-section sidebar-section-accordion ${isOpen ? 'open' : 'closed'} ${hasActiveItem ? 'has-active' : ''}`}
              key={navSection.title}
            >
              <button
                type="button"
                className="sidebar-section-toggle"
                onClick={() => toggleSection(navSection.title)}
                aria-expanded={!!isOpen}
              >
                <span className="sidebar-section-toggle-left">
                  <span className="sidebar-section-icon"><SidebarIcon name={navSection.icon} /></span>
                  <span>{navSection.title}</span>
                </span>

                <span className="sidebar-section-chevron">{isOpen ? '⌃' : '⌄'}</span>
              </button>

              {isOpen && (
                <nav className="sidebar-nav sidebar-nav-collapsible">
                  {navSection.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`sidebar-link ${isActivePath(location.pathname, item.path) ? 'active' : ''}`}
                      title={item.label}
                    >
                      <span className="sidebar-link-icon"><SidebarIcon name={item.icon} /></span>
                      <span>{item.label}</span>

                      {item.badge && unreadCount > 0 && (
                        <span className="sidebar-badge">{unreadCount}</span>
                      )}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          );
        })}

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar" title={displayName}>
              {initials}
            </div>

            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">
                {programmerMode ? 'Programmatore' : `${getRoleLabel(user?.role)} · Piano ${getPlanLabel(user)}`
                }
              </div>
            </div>

            <button className="sidebar-logout" onClick={logout} title="Esci"><span aria-hidden="true" className="logout-symbol">⏻</span></button>
          </div>
        </div>
      </aside>
      {isMobile && (
        <>
          {mobileOpenSection && (
            <div className="mobile-section-drawer">
              <div className="mobile-section-drawer-header">
                <span>{mobileOpenSection.title}</span>
                <button type="button" onClick={() => setMobileOpenSection(null)} aria-label="Chiudi menu">
                  ×
                </button>
              </div>

              <div className="mobile-section-drawer-items">
                {mobileOpenSection.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`mobile-section-drawer-link ${isActivePath(location.pathname, item.path) ? 'active' : ''}`}
                  >
                    <span className="mobile-section-drawer-icon">
                      <SidebarIcon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <nav className="mobile-bottom-nav" aria-label="Navigazione mobile">
            {visibleSections.map((navSection) => {
              const sectionActive = navSection.items.some((item) =>
                isActivePath(location.pathname, item.path)
              );

              const isOpen = mobileOpenSection?.title === navSection.title;

              return (
                <button
                  key={navSection.title}
                  type="button"
                  className={`mobile-bottom-nav-item ${sectionActive ? 'active' : ''} ${isOpen ? 'open' : ''}`}
                  title={navSection.title}
                  aria-label={navSection.title}
                  onClick={() =>
                    setMobileOpenSection((current) =>
                      current?.title === navSection.title ? null : navSection
                    )
                  }
                >
                  <span className="mobile-bottom-nav-icon">
                    <SidebarIcon name={navSection.icon} />
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              className="mobile-bottom-nav-item mobile-bottom-nav-logout"
              onClick={logout}
              title="Esci"
              aria-label="Esci"
            >
              <span aria-hidden="true" className="logout-symbol">⏻</span>
            </button>
          </nav>
        </>
      )}

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <div className="header-breadcrumb">
              <span>{section}</span>
              <span>›</span>
              <span>{pageTitle}</span>
            </div>
          </div>

          <div className="header-right">

            <span className="header-date" style={{ textTransform: 'capitalize' }}>
              {today}
            </span>
          </div>
        </header>

        <div className="page-content animate-fadeIn" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}

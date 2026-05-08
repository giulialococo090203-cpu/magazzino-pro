import { useLocation, Link, useNavigate } from 'react-router-dom';
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

function SidebarIcon({ name, className = '' }) {
  return (
    <span className={`material-symbols-rounded ${className}`} aria-hidden="true">
      {name || 'radio_button_unchecked'}
    </span>
  );
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
      },
      {
        path: '/movimento/entrata',
        label: 'Carico Materiale',
        icon: 'move_to_inbox',
        permission: 'canMoveIn',
      },
      {
        path: '/movimento/uscita',
        label: 'Scarica Materiale',
        icon: 'outbox',
        permission: 'canMoveOut',
      },
      {
        path: '/movimento/reintegro',
        label: 'Reintegra Materiale',
        icon: 'sync',
        permission: 'canReintegrate',
      },
      {
        path: '/movimento/rettifica',
        label: 'Rettifica Magazzino',
        icon: 'edit_square',
        permission: 'canRectify',
      },
      {
        path: '/storico',
        label: 'Storico Movimenti',
        icon: 'calendar_month',
        permission: 'canViewHistory',
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
      },
      {
        path: '/proposte-ordine',
        label: 'Proposte Ordine',
        icon: 'request_quote',
        permission: 'canManageReorderProposals',
      },
      {
        path: '/importa',
        label: 'Importa / Inserisci',
        icon: 'upload_file',
        permission: 'canImportInvoices',
      },
      {
        path: '/fatture',
        label: 'Archivio Fatture',
        icon: 'folder_open',
        permission: 'canImportInvoices',
      },
      {
        path: '/gestione/fornitori',
        label: 'Fornitori',
        icon: 'factory',
        permission: 'canManageMaterials',
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
      },
      {
        path: '/controllo/soglie',
        label: 'Soglie Scorta',
        icon: 'settings',
        permission: 'canManageThresholds',
      },
      {
        path: '/controllo/notifiche',
        label: 'Notifiche',
        icon: 'notifications',
        permission: 'canViewNotifications',
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
      },
      {
        path: '/gestione/rendicontazione',
        label: 'Rendicontazione',
        icon: 'receipt_long',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/storico-prezzi',
        label: 'Storico Prezzi',
        icon: 'trending_up',
        permission: 'canManagePriceSettings',
      },
      {
        path: '/gestione/prezzi',
        label: 'Impostazioni Prezzi',
        icon: 'euro',
        permission: 'canManagePriceSettings',
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
      },
      {
        path: '/gestione/categorie',
        label: 'Categorie',
        icon: 'sell',
        permission: 'canManageCategories',
      },
      {
        path: '/gestione/utenti',
        label: 'Utenti',
        icon: 'manage_accounts',
        permission: 'canManageUsers',
      },
      {
        path: '/gestione/backup',
        label: 'Backup Sistema',
        icon: 'backup',
        permission: 'canManageUsers',
      },
      {
        path: '/gestione/log',
        label: 'Registro modifiche',
        icon: 'history_edu',
        permission: 'canViewAuditLog',
      },
    ],
  },
];

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
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
const [openSections, setOpenSections] = useState({});

  const canSeeNotifications = hasPermission(user, 'canViewNotifications');

  useEffect(() => {
    if (!canSeeNotifications) {
      setUnreadCount(0);
      return undefined;
    }

    let mounted = true;

    const updateNotifs = async () => {
      try {
        const unread = await notificationStore.getUnread();

        if (mounted) {
          setUnreadCount(Array.isArray(unread) ? unread.length : 0);
        }
      } catch (err) {
        console.error('Errore caricamento notifiche:', err);
      }
    };

    updateNotifs();

    const interval = setInterval(updateNotifs, 5000);

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


  const section = getSection(location.pathname);
  const pageTitle = PAGE_TITLES[location.pathname] || 'Magazzino';

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

  const visibleSections = NAV_SECTIONS.map((navSection) => {
    const visibleItems = navSection.items.filter((item) =>
      hasPermission(user, item.permission)
    );

    return { ...navSection, items: visibleItems };
  }).filter((navSection) => navSection.items.length > 0);

  const activeSectionTitle = getActiveSectionTitle(location.pathname, visibleSections);

  useEffect(() => {
    if (!activeSectionTitle) return;

    setOpenSections((prev) => {
      const next = {};

      visibleSections.forEach((navSection) => {
        next[navSection.title] = navSection.title === activeSectionTitle;
      });

      return next;
    });
  }, [activeSectionTitle, location.pathname]);

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
          <Link to={getDefaultRouteForUser(user)} className="sidebar-logo">
            <img className="workspace-logo-img workspace-logo-img-sidebar" src="/workspace-logo.png" alt="WorkSpace" />
            <div className="sidebar-logo-text">
              <h1>WorkSpace</h1>
              <span>Gestione Magazzino</span>
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
              <div className="sidebar-user-role">{getRoleLabel(user?.role)}</div>
            </div>

            <button className="sidebar-logout" onClick={logout} title="Esci"><span aria-hidden="true" className="logout-symbol">⏻</span></button>
          </div>
        </div>
      </aside>

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

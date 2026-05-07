import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import {
  hasPermission,
  getDefaultRouteForUser,
  normalizeRole,
} from '../data/permissions';
import { useState, useEffect } from 'react';

const ICON_PATHS = {
  package: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7 12 12l8.7-5 M12 22V12',
  shoppingCart: 'M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.6L4 3H2 M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M8 13h8 M8 17h8 M8 9h2',
  clipboardCheck: 'M9 5h6 M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z M8 14l2.5 2.5L16 11',
  arrowDown: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  arrowUp: 'M12 21V9 M7 14l5-5 5 5 M5 3h14',
  refresh: 'M21 12a9 9 0 0 1-15.5 6.2L3 16 M3 21v-5h5 M3 12A9 9 0 0 1 18.5 5.8L21 8 M21 3v5h-5',
  pencil: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  archive: 'M3 7h18 M5 7v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7 M3 3h18v4H3Z M10 12h4',
  tags: 'M20 10l-8 8-8-8V4h6Z M7 7h.01 M14 4l6 6',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M2 14h4 M10 8h4 M18 16h4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M10 20a2 2 0 0 0 4 0',
  chart: 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16v-9',
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2Z M9 7h6 M9 11h6 M9 15h4',
  trending: 'M3 17l6-6 4 4 7-8 M14 7h6v6',
  euro: 'M17 5.5A7 7 0 1 0 17 18 M4 10h10 M4 14h9',
  wrench: 'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  backup: 'M4 4h14l2 2v14H4Z M8 4v6h8V4 M8 20v-6h8v6',
  log: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z M8 7h8 M8 11h8 M8 15h5',
  factory: 'M3 21h18V9l-6 4V9l-6 4V5H3Z M7 21v-4 M12 21v-4 M17 21v-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.5-.2-.1a1.7 1.7 0 0 0-1.9.3l-.2.1-4 0-.2-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.5.1-.1a1.7 1.7 0 0 0 .3-1.9l-.1-.2-2-3.5.1-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.5.2.1a1.7 1.7 0 0 0 1.9-.3l.2-.1h4l.2.1a1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.5-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.2 2 3.5Z',
  boxes: 'M7 8l5-3 5 3-5 3Z M7 8v6l5 3 5-3V8 M2 14l5-3 5 3-5 3Z M2 14v5l5 3 5-3v-5 M12 14l5-3 5 3-5 3Z M12 14v5l5 3 5-3v-5',
};

function SidebarIcon({ name, className = '' }) {
  const path = ICON_PATHS[name] || ICON_PATHS.fileText;

  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.05"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
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
    icon: 'package',
    items: [
      {
        path: '/inventario',
        label: 'Giacenza',
        icon: 'package',
        permission: 'canViewInventory',
      },
      {
        path: '/movimento/entrata',
        label: 'Carico Materiale',
        icon: 'arrowDown',
        permission: 'canMoveIn',
      },
      {
        path: '/movimento/uscita',
        label: 'Scarica Materiale',
        icon: 'arrowUp',
        permission: 'canMoveOut',
      },
      {
        path: '/movimento/reintegro',
        label: 'Reintegra Materiale',
        icon: 'refresh',
        permission: 'canReintegrate',
      },
      {
        path: '/movimento/rettifica',
        label: 'Rettifica Magazzino',
        icon: 'pencil',
        permission: 'canRectify',
      },
      {
        path: '/storico',
        label: 'Storico Movimenti',
        icon: 'calendar',
        permission: 'canViewHistory',
      },
    ],
  },
  {
    title: 'Acquisti e Fatture',
    icon: 'receipt',
    items: [
      {
        path: '/riordino',
        label: 'Riordino Automatico',
        icon: 'shoppingCart',
        permission: 'canManageReorderProposals',
      },
      {
        path: '/proposte-ordine',
        label: 'Proposte Ordine',
        icon: 'clipboardCheck',
        permission: 'canManageReorderProposals',
      },
      {
        path: '/importa',
        label: 'Importa / Inserisci',
        icon: 'fileText',
        permission: 'canImportInvoices',
      },
      {
        path: '/fatture',
        label: 'Archivio Fatture',
        icon: 'archive',
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
    icon: 'boxes',
    items: [
      {
        path: '/inventario-fisico',
        label: 'Inventario Fisico',
        icon: 'boxes',
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
        icon: 'bell',
        permission: 'canViewNotifications',
        badge: true,
      },
    ],
  },
  {
    title: 'Analisi',
    icon: 'chart',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: 'chart',
        permission: 'canViewDashboard',
      },
      {
        path: '/gestione/rendicontazione',
        label: 'Rendicontazione',
        icon: 'receipt',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/storico-prezzi',
        label: 'Storico Prezzi',
        icon: 'trending',
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
        icon: 'wrench',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/categorie',
        label: 'Categorie',
        icon: 'tags',
        permission: 'canManageCategories',
      },
      {
        path: '/gestione/utenti',
        label: 'Utenti',
        icon: 'users',
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
        icon: 'log',
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
  const [globalSearch, setGlobalSearch] = useState('');
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

  const handleGlobalSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;

    const q = globalSearch.trim();

    if (!q) return;

    navigate(`/inventario?q=${encodeURIComponent(q)}`);
    setGlobalSearch('');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to={getDefaultRouteForUser(user)} className="sidebar-logo">
            <div className="sidebar-logo-icon">M</div>
            <div className="sidebar-logo-text">
              <h1>MagazzinoPro</h1>
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

            <button className="sidebar-logout" onClick={logout} title="Esci">
              ⏻
            </button>
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
            {hasPermission(user, 'canViewInventory') && (
              <div className="global-search-container">
                <span className="global-search-icon">🔍</span>
                <input
                  type="text"
                  className="global-search-input"
                  placeholder="Cerca codice materiale..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onKeyDown={handleGlobalSearchKeyDown}
                />
              </div>
            )}

            <span className="header-date" style={{ textTransform: 'capitalize' }}>
              {today}
            </span>

            {canSeeNotifications && (
              <Link
                to="/controllo/notifiche"
                className="header-notification-btn"
                title="Notifiche"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="header-notification-badge">{unreadCount}</span>
                )}
              </Link>
            )}
          </div>
        </header>

        <div className="page-content animate-fadeIn" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}
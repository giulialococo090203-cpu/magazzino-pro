import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import {
  hasPermission,
  getDefaultRouteForUser,
  normalizeRole,
} from '../data/permissions';
import { useState, useEffect } from 'react';

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
    items: [
      {
        path: '/inventario',
        label: 'Giacenza',
        icon: '📦',
        permission: 'canViewInventory',
      },
      {
        path: '/riordino',
        label: 'Riordino Automatico',
        icon: '🛒',
        permission: 'canManageReorderProposals',
      },
      {
        path: '/proposte-ordine',
        label: 'Proposte Ordine',
        icon: '📑',
        permission: 'canManageReorderProposals',
      },
      {
        path: '/inventario-fisico',
        label: 'Inventario Fisico',
        icon: '🧮',
        permission: 'canPhysicalInventory',
      },
      {
        path: '/movimento/entrata',
        label: 'Carico Materiale',
        icon: '📥',
        permission: 'canMoveIn',
      },
      {
        path: '/movimento/uscita',
        label: 'Scarica Materiale',
        icon: '📤',
        permission: 'canMoveOut',
      },
      {
        path: '/movimento/reintegro',
        label: 'Reintegra Materiale',
        icon: '🔄',
        permission: 'canReintegrate',
      },
      {
        path: '/movimento/rettifica',
        label: 'Rettifica Magazzino',
        icon: '✏️',
        permission: 'canRectify',
      },
      {
        path: '/storico',
        label: 'Storico Movimenti',
        icon: '📅',
        permission: 'canViewHistory',
      },
    ],
  },
  {
    title: 'Fatture e Configurazione',
    items: [
      {
        path: '/importa',
        label: 'Importa / Inserisci',
        icon: '📄',
        permission: 'canImportInvoices',
      },
      {
        path: '/fatture',
        label: 'Archivio Fatture',
        icon: '🗂️',
        permission: 'canImportInvoices',
      },
      {
        path: '/gestione/categorie',
        label: 'Categorie',
        icon: '🏷️',
        permission: 'canManageCategories',
      },
      {
        path: '/controllo/soglie',
        label: 'Soglie Scorta',
        icon: '⚙️',
        permission: 'canManageThresholds',
      },
      {
        path: '/gestione/prezzi',
        label: 'Impostazioni Prezzi',
        icon: '💶',
        permission: 'canManagePriceSettings',
      },
      {
        path: '/gestione/storico-prezzi',
        label: 'Storico Prezzi',
        icon: '📈',
        permission: 'canManagePriceSettings',
      },
    ],
  },
  {
    title: 'Notifiche',
    items: [
      {
        path: '/controllo/notifiche',
        label: 'Notifiche',
        icon: '🔔',
        permission: 'canViewNotifications',
        badge: true,
      },
    ],
  },
  {
    title: 'Controllo Datore',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: '📊',
        permission: 'canViewDashboard',
      },
      {
        path: '/gestione/materiali',
        label: 'Anagrafica Materiali',
        icon: '🛠️',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/fornitori',
        label: 'Fornitori',
        icon: '🏭',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/rendicontazione',
        label: 'Rendicontazione',
        icon: '🧾',
        permission: 'canManageMaterials',
      },
      {
        path: '/gestione/utenti',
        label: 'Utenti',
        icon: '👤',
        permission: 'canManageUsers',
      },
      {
        path: '/gestione/backup',
        label: 'Backup Sistema',
        icon: '💾',
        permission: 'canManageUsers',
      },
      {
        path: '/gestione/log',
        label: 'Registro modifiche',
        icon: '📜',
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

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');

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

        {visibleSections.map((navSection) => (
          <div className="sidebar-section" key={navSection.title}>
            <div className="sidebar-section-title">{navSection.title}</div>

            <nav className="sidebar-nav">
              {navSection.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActivePath(location.pathname, item.path) ? 'active' : ''}`}
                  title={item.label}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span>{item.label}</span>

                  {item.badge && unreadCount > 0 && (
                    <span className="sidebar-badge">{unreadCount}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        ))}

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
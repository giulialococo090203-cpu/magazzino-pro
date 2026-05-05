import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import { useState, useEffect } from 'react';

const ROLE_ALIASES = {
  datore: ['datore', 'admin'],
  segretaria: ['segretaria', 'segreteria'],
  magazziniere: ['magazziniere', 'operatore'],
  operaio: ['operaio'],
};

function hasRole(user, allowedRoles = []) {
  const userRole = String(user?.role || '').trim().toLowerCase();
  if (!userRole) return false;

  return allowedRoles.some((role) => {
    const accepted = (ROLE_ALIASES[role] || [role]).map((r) =>
      String(r).trim().toLowerCase()
    );

    return accepted.includes(userRole);
  });
}

function getRoleLabel(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (ROLE_ALIASES.datore.includes(normalized)) return 'Datore';
  if (ROLE_ALIASES.segretaria.includes(normalized)) return 'Segretaria';
  if (ROLE_ALIASES.magazziniere.includes(normalized)) return 'Magazziniere';
  if (ROLE_ALIASES.operaio.includes(normalized)) return 'Operaio';

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
        roles: ['datore', 'segretaria', 'magazziniere', 'operaio'],
      },
      {
        path: '/movimento/entrata',
        label: 'Carico Materiale',
        icon: '📥',
        roles: ['datore', 'segretaria', 'magazziniere'],
      },
      {
        path: '/movimento/uscita',
        label: 'Scarica Materiale',
        icon: '📤',
        roles: ['datore', 'segretaria', 'magazziniere'],
      },
      {
        path: '/movimento/rettifica',
        label: 'Rettifica Manuale',
        icon: '✏️',
        roles: ['datore'],
      },
      {
        path: '/storico',
        label: 'Storico Movimenti',
        icon: '📅',
        roles: ['datore'],
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
        roles: ['datore', 'segretaria', 'magazziniere'],
      },
      {
        path: '/gestione/categorie',
        label: 'Categorie',
        icon: '🏷️',
        roles: ['datore', 'segretaria'],
      },
      {
        path: '/controllo/soglie',
        label: 'Soglie Scorta',
        icon: '⚙️',
        roles: ['datore', 'segretaria'],
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
        roles: ['datore', 'segretaria', 'magazziniere'],
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
        roles: ['datore'],
      },
      {
        path: '/gestione/materiali',
        label: 'Anagrafica Materiali',
        icon: '🛠️',
        roles: ['datore'],
      },
      {
        path: '/gestione/utenti',
        label: 'Utenti',
        icon: '👤',
        roles: ['datore'],
      },
      {
        path: '/gestione/log',
        label: 'Audit Log',
        icon: '📜',
        roles: ['datore'],
      },
    ],
  },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/inventario': 'Giacenza',
  '/movimento/entrata': 'Carico Materiale',
  '/movimento/uscita': 'Scarica Materiale',
  '/movimento/reintegro': 'Reintegra Materiale',
  '/movimento/rettifica': 'Rettifica Manuale',
  '/storico': 'Storico Movimenti',
  '/importa': 'Importa / Inserisci',
  '/gestione/materiali': 'Anagrafica Materiali',
  '/gestione/categorie': 'Gestione Categorie',
  '/gestione/utenti': 'Gestione Utenti',
  '/gestione/log': 'Audit Log',
  '/controllo': 'Dashboard',
  '/controllo/soglie': 'Soglie Scorta',
  '/controllo/notifiche': 'Centro Notifiche',
};

const SECTION_NAMES = {
  '/controllo/notifiche': 'Notifiche',
  '/controllo/soglie': 'Configurazione',
  '/inventario': 'Magazzino',
  '/movimento': 'Magazzino',
  '/storico': 'Magazzino',
  '/importa': 'Fatture',
  '/gestione': 'Configurazione',
  '/controllo': 'Controllo Datore',
  '/': 'Generale',
};

function getSection(pathname) {
  const orderedPrefixes = Object.keys(SECTION_NAMES).sort((a, b) => b.length - a.length);

  for (const prefix of orderedPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`) || prefix === '/') {
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

  useEffect(() => {
    const canSeeNotifications = hasRole(user, ['datore', 'segretaria', 'magazziniere']);

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
  }, [user]);

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

  const canSeeNotifications = hasRole(user, ['datore', 'segretaria', 'magazziniere']);

  const visibleSections = NAV_SECTIONS.map((navSection) => {
    const visibleItems = navSection.items.filter((item) => hasRole(user, item.roles));
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
          <Link to={hasRole(user, ['datore']) ? '/' : '/inventario'} className="sidebar-logo">
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

            <span className="header-date" style={{ textTransform: 'capitalize' }}>
              {today}
            </span>

            {canSeeNotifications && (
              <Link to="/controllo/notifiche" className="header-notification-btn" title="Notifiche">
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
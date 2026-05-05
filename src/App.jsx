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
  if (!user?.role) return false;
  return allowedRoles.some((role) => {
    const accepted = ROLE_ALIASES[role] || [role];
    return accepted.includes(user.role);
  });
}

function getRoleLabel(role) {
  if (ROLE_ALIASES.datore.includes(role)) return 'Datore';
  if (ROLE_ALIASES.segretaria.includes(role)) return 'Segretaria';
  if (ROLE_ALIASES.magazziniere.includes(role)) return 'Magazziniere';
  if (ROLE_ALIASES.operaio.includes(role)) return 'Operaio';
  return role || 'Utente';
}

function getDefaultRoute(user) {
  if (hasRole(user, ['datore'])) return '/';
  return '/inventario';
}

const NAV_SECTIONS = [
  {
    title: 'Magazzino',
    items: [
      { path: '/inventario', label: 'Giacenza', icon: '📦', roles: ['datore', 'segretaria', 'magazziniere', 'operaio'] },
      { path: '/movimento/entrata', label: 'Carico (In)', icon: '📥', roles: ['datore', 'segretaria', 'magazziniere'] },
      { path: '/movimento/uscita', label: 'Scarica (Out)', icon: '📤', roles: ['datore', 'segretaria', 'magazziniere'] },
      { path: '/movimento/rettifica', label: 'Rettifica Manuale', icon: '✏️', roles: ['datore'] },
      { path: '/storico', label: 'Storico Movimenti', icon: '📅', roles: ['datore'] },
    ]
  },
  {
    title: 'Fatture e Configurazione',
    items: [
      { path: '/importa', label: 'Importa Fatture', icon: '📄', roles: ['datore', 'segretaria'] },
      { path: '/gestione/categorie', label: 'Categorie', icon: '🏷️', roles: ['datore', 'segretaria'] },
      { path: '/controllo/soglie', label: 'Soglie Scorta', icon: '⚙️', roles: ['datore', 'segretaria'] },
    ]
  },
  {
    title: 'Notifiche',
    items: [
      { path: '/controllo/notifiche', label: 'Notifiche', icon: '🔔', roles: ['datore', 'segretaria', 'magazziniere'], badge: true },
    ]
  },
  {
    title: 'Controllo Datore',
    items: [
      { path: '/', label: 'Punto di Controllo', icon: '📊', roles: ['datore'] },
      { path: '/controllo', label: 'Analisi Dati', icon: '📈', roles: ['datore'] },
      { path: '/gestione/materiali', label: 'Anagrafica Materiali', icon: '🛠️', roles: ['datore'] },
      { path: '/gestione/utenti', label: 'Utenti', icon: '👤', roles: ['datore'] },
      { path: '/gestione/log', label: 'Audit Log', icon: '📜', roles: ['datore'] },
    ]
  },
];

const PAGE_TITLES = {
  '/': 'Punto di Controllo',
  '/inventario': 'Giacenza',
  '/movimento/entrata': 'Carico Materiale',
  '/movimento/uscita': 'Scarica Materiale',
  '/movimento/reintegro': 'Reintegra Materiale',
  '/movimento/rettifica': 'Rettifica Manuale',
  '/storico': 'Storico Movimenti',
  '/importa': 'Importa Fatture',
  '/gestione/materiali': 'Anagrafica Materiali',
  '/gestione/categorie': 'Gestione Categorie',
  '/gestione/utenti': 'Gestione Utenti',
  '/gestione/log': 'Audit Log',
  '/controllo': 'Analisi Dati',
  '/controllo/soglie': 'Soglie Scorta',
  '/controllo/notifiche': 'Centro Notifiche',
};

const SECTION_NAMES = {
  '/inventario': 'Magazzino',
  '/movimento': 'Magazzino',
  '/storico': 'Magazzino',
  '/importa': 'Fatture',
  '/controllo/notifiche': 'Notifiche',
  '/controllo': 'Controllo',
  '/gestione': 'Configurazione',
  '/': 'Controllo',
};

function getSection(pathname) {
  const orderedPrefixes = Object.keys(SECTION_NAMES).sort((a, b) => b.length - a.length);
  for (const prefix of orderedPrefixes) {
    if (pathname.startsWith(prefix)) return SECTION_NAMES[prefix];
  }
  return 'Generale';
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
      return;
    }

    let mounted = true;

    const updateNotifs = async () => {
      try {
        const unread = await notificationStore.getUnread();
        if (mounted) setUnreadCount(unread.length);
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
    year: 'numeric'
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

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">M</div>
            <div className="sidebar-logo-text">
              <h1>MagazzinoPro</h1>
              <span>Gestione Magazzino</span>
            </div>
          </div>
        </div>

        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            hasRole(user, item.roles)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              <nav className="sidebar-nav">
                {visibleItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
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
          );
        })}

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">{initials}</div>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    navigate(`/inventario?q=${encodeURIComponent(globalSearch.trim())}`);
                    setGlobalSearch('');
                  }
                }}
              />
            </div>

            <span className="header-date" style={{ textTransform: 'capitalize' }}>
              {today}
            </span>

            {canSeeNotifications && (
              <Link to="/controllo/notifiche" className="header-notification-btn">
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
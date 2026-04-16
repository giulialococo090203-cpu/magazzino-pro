import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import { useState, useEffect } from 'react';

const NAV_SECTIONS = [
  {
    title: 'Monitoraggio',
    items: [
      { path: '/', label: 'Punto di Controllo', icon: '📊', roles: ['admin', 'operatore', 'segreteria', 'controllo'] },
      { path: '/controllo/notifiche', label: 'Notifiche', icon: '🔔', roles: ['admin', 'controllo'], badge: true },
    ]
  },
  {
    title: 'Operatività Magazzino',
    items: [
      { path: '/inventario', label: 'Inventario Reale', icon: '📦', roles: ['admin', 'operatore', 'segreteria', 'controllo'] },
      { path: '/movimento/entrata', label: 'Carico (In)', icon: '📥', roles: ['admin', 'operatore', 'segreteria'] },
      { path: '/movimento/uscita', label: 'Scarica (Out)', icon: '📤', roles: ['admin', 'operatore', 'segreteria'] },
      { path: '/storico', label: 'Storico Movimenti', icon: '📅', roles: ['admin', 'operatore', 'segreteria', 'controllo'] },
    ]
  },
  {
    title: 'Strumenti & Analisi',
    items: [
      { path: '/importa', label: 'Importa da Documenti', icon: '📄', roles: ['admin', 'segreteria'] },
      { path: '/controllo', label: 'Analisi Dati', icon: '📈', roles: ['admin', 'controllo'] },
      { path: '/movimento/rettifica', label: 'Rettifica Manuale', icon: '✏️', roles: ['admin', 'operatore'] },
    ]
  },
  {
    title: 'Configurazione Sistema',
    items: [
      { path: '/gestione/materiali', label: 'Anagrafica Materiali', icon: '🛠️', roles: ['admin'] },
      { path: '/gestione/categorie', label: 'Categorie', icon: '🏷️', roles: ['admin'] },
      { path: '/controllo/soglie', label: 'Soglie Scorta', icon: '⚙️', roles: ['admin', 'controllo'] },
      { path: '/gestione/utenti', label: 'Utenti', icon: '👤', roles: ['admin'] },
      { path: '/gestione/log', label: 'Audit Log', icon: '📜', roles: ['admin'] },
    ]
  },
];

const PAGE_TITLES = {
  '/': 'Punto di Controllo',
  '/inventario': 'Inventario Reale',
  '/movimento/entrata': 'Carico Materiale',
  '/movimento/uscita': 'Scarica Materiale',
  '/movimento/reintegro': 'Reintegra Materiale',
  '/movimento/rettifica': 'Rettifica Manuale',
  '/storico': 'Storico Movimenti',
  '/importa': 'Importa da Documenti',
  '/gestione/materiali': 'Anagrafica Materiali',
  '/gestione/categorie': 'Gestione Categorie',
  '/gestione/utenti': 'Gestione Utenti',
  '/gestione/log': 'Audit Log',
  '/controllo': 'Analisi Dati',
  '/controllo/soglie': 'Soglie Scorta',
  '/controllo/notifiche': 'Centro Notifiche',
};

const SECTION_NAMES = {
  '/': 'Monitoraggio',
  '/inventario': 'Operatività',
  '/movimento': 'Operatività',
  '/storico': 'Operatività',
  '/importa': 'Strumenti',
  '/controllo': 'Analisi',
  '/gestione': 'Configurazione',
};

function getSection(pathname) {
  for (const [prefix, name] of Object.entries(SECTION_NAMES)) {
    if (pathname.startsWith(prefix) && prefix !== '/') return name;
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
    const updateNotifs = () => setUnreadCount(notificationStore.getUnread().length);
    updateNotifs();
    const interval = setInterval(updateNotifs, 3000);
    return () => clearInterval(interval);
  }, []);

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
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="app-layout">
      {/* Sidebar */}
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

        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item =>
            item.roles.includes(user.role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              <nav className="sidebar-nav">
                {visibleItems.map(item => (
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
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
            <button className="sidebar-logout" onClick={logout} title="Esci">
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
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
                onChange={e => setGlobalSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    navigate(`/inventario?q=${encodeURIComponent(globalSearch.trim())}`);
                    setGlobalSearch('');
                  }
                }}
              />
            </div>
            <span className="header-date" style={{ textTransform: 'capitalize' }}>{today}</span>
            <Link to="/controllo/notifiche" className="header-notification-btn">
              🔔
              {unreadCount > 0 && (
                <span className="header-notification-badge">{unreadCount}</span>
              )}
            </Link>
          </div>
        </header>

        <div className="page-content animate-fadeIn" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}

import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { notificationStore } from '../data/store';
import {
  hasPermission,
  getDefaultRouteForUser,
  normalizeRole,
  isProgrammerUser,
} from '../data/permissions';
import { AZIENDA_NOME } from '../config/azienda';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

/*
 * Ogni voce ha la sua icona: prima molte voci diverse (Ordini, Fornitori,
 * Anagrafica, Categorie...) mostravano la stessa scatola.
 */
const NAV_ICONS = {
  '/inventario': 'inventory_2',
  '/movimento/entrata': 'move_to_inbox',
  '/movimento/uscita': 'outbox',
  '/movimento/reintegro': 'sync',
  '/movimento/rettifica': 'edit_square',
  '/storico': 'history',
  '/ordini': 'shopping_cart',
  '/importa': 'upload_file',
  '/fatture': 'folder_open',
  '/gestione/fornitori': 'factory',
  '/inventario-fisico': 'assignment',
  '/controllo/soglie': 'straighten',
  '/controllo/notifiche': 'notifications',
  '/': 'dashboard',
  '/gestione/rendicontazione': 'bar_chart',
  '/gestione/storico-prezzi': 'trending_up',
  '/gestione/prezzi': 'euro',
  '/gestione/materiali': 'box',
  '/gestione/categorie': 'tag',
  '/gestione/utenti': 'manage_accounts',
  '/gestione/backup': 'database',
  '/gestione/log': 'history_edu',
  '/programmatore': 'shield',
  '/programmatore/stato': 'check_circle',
  '/programmatore/andamento': 'analytics',
  '/programmatore/integrita': 'construction',
  '/programmatore/dati/giacenza': 'inventory_2',
  '/programmatore/dati/movimenti': 'history',
  '/programmatore/dati/ordini': 'shopping_cart',
  '/programmatore/dati/fatture': 'folder_open',
  '/programmatore/dati/utenti': 'manage_accounts',
  '/programmatore/dati/registro': 'history_edu',
  '/programmatore/manutenzione': 'settings',
  '/programmatore/utenti': 'users',
  '/programmatore/codice': 'lock',
};

const SECTION_ICONS = {
  Magazzino: 'inventory_2',
  'Acquisti e Fatture': 'request_quote',
  Controllo: 'assignment',
  Analisi: 'bar_chart',
  Configurazione: 'settings',
  Programmatore: 'shield',
  Diagnostica: 'check_circle',
  'Dati azienda': 'database',
  Interventi: 'construction',
};

const SECTION_SHORT = {
  'Acquisti e Fatture': 'Acquisti',
  Configurazione: 'Gestione',
  Programmatore: 'Supporto',
  'Dati azienda': 'Dati',
};

/* Colore della piastrina dell'icona, per sezione del menu. */
const SECTION_TONES = {
  Magazzino: 'blue',
  'Acquisti e Fatture': 'orange',
  Controllo: 'green',
  Analisi: 'violet',
  Configurazione: 'gray',
  Programmatore: 'red',
  Diagnostica: 'green',
  'Dati azienda': 'blue',
  Interventi: 'orange',
};

function NavIcon({ path, fallback, className = '' }) {
  return <Icon name={NAV_ICONS[path] || fallback || 'inventory_2'} className={className} />;
}

function SectionIcon({ section, className = '' }) {
  return <Icon name={SECTION_ICONS[section.title] || section.icon} className={className} />;
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
        path: '/ordini',
        label: 'Ordini',
        icon: 'shopping_cart',
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

/* Voce presente nel menu dell'applicazione per entrare nell'area tecnica. */
const PROGRAMMER_NAV_SECTIONS = [
  {
    title: 'Programmatore',
    icon: 'admin_panel_settings',
    items: [
      {
        path: '/programmatore',
        label: 'Area di supporto',
        icon: 'admin_panel_settings',
      },
    ],
  },
];

/*
 * Menu dell'area programmatore: e' un ambiente a se'. Qui non compaiono
 * le sezioni dell'applicazione aziendale, ma soltanto gli strumenti
 * tecnici, piu' il rientro all'applicazione.
 */
const PROGRAMMER_CONSOLE_SECTIONS = [
  {
    title: 'Diagnostica',
    icon: 'fact_check',
    items: [
      { path: '/programmatore/stato', label: 'Stato app', icon: 'fact_check' },
      { path: '/programmatore/andamento', label: 'Andamento', icon: 'analytics' },
      { path: '/programmatore/integrita', label: 'Integrità dati', icon: 'construction' },
    ],
  },
  {
    title: 'Dati azienda',
    icon: 'inventory_2',
    items: [
      { path: '/programmatore/dati/giacenza', label: 'Giacenza', icon: 'inventory_2' },
      { path: '/programmatore/dati/movimenti', label: 'Movimenti', icon: 'calendar_month' },
      { path: '/programmatore/dati/ordini', label: 'Ordini', icon: 'shopping_cart' },
      { path: '/programmatore/dati/fatture', label: 'Fatture', icon: 'folder_open' },
      { path: '/programmatore/dati/utenti', label: 'Utenti', icon: 'manage_accounts' },
      { path: '/programmatore/dati/registro', label: 'Registro modifiche', icon: 'history_edu' },
    ],
  },
  {
    title: 'Interventi',
    icon: 'settings',
    items: [
      { path: '/programmatore/manutenzione', label: 'Manutenzione', icon: 'settings' },
      { path: '/programmatore/utenti', label: 'Utenti e accessi', icon: 'manage_accounts' },
      { path: '/programmatore/codice', label: 'Codice d’accesso', icon: 'admin_panel_settings' },
    ],
  },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/inventario': 'Giacenza',
  '/ordini': 'Ordini',
  '/ordini/da-ordinare': 'Ordini · Da ordinare',
  '/ordini/preparati': 'Ordini · Preparati',
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
  '/programmatore': 'Pannello Programmatore',
  '/programmatore/stato': 'Stato applicazione',
  '/programmatore/andamento': 'Andamento',
  '/programmatore/integrita': 'Integrità dati',
  '/programmatore/manutenzione': 'Manutenzione',
  '/programmatore/utenti': 'Utenti e accessi',
  '/programmatore/codice': 'Codice d’accesso',
  '/programmatore/dati/giacenza': 'Dati · Giacenza',
  '/programmatore/dati/movimenti': 'Dati · Movimenti',
  '/programmatore/dati/ordini': 'Dati · Ordini',
  '/programmatore/dati/fatture': 'Dati · Fatture',
  '/programmatore/dati/utenti': 'Dati · Utenti',
  '/programmatore/dati/registro': 'Dati · Registro modifiche',
};

const SECTION_NAMES = {
  '/controllo/notifiche': 'Notifiche',
  '/controllo/soglie': 'Configurazione',
  '/inventario-fisico': 'Magazzino',
  '/ordini': 'Acquisti',
  '/inventario': 'Magazzino',
  '/movimento': 'Magazzino',
  '/storico': 'Magazzino',
  '/importa': 'Fatture',
  '/fatture': 'Fatture',
  '/gestione': 'Configurazione',
  '/programmatore': 'Programmatore',
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
  const { user, logout } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpenSection, setMobileOpenSection] = useState(null);

  const isProgrammer = isProgrammerUser(user);
  const canSeeNotifications = hasPermission(user, 'canViewNotifications');

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

  const baseNavSections = NAV_SECTIONS.map((navSection) => {
    const visibleItems = navSection.items.filter((item) =>
      hasPermission(user, item.permission)
    );

    return { ...navSection, items: visibleItems };
  }).filter((navSection) => navSection.items.length > 0);

  /*
   * Dentro l'area programmatore si vedono solo gli strumenti tecnici:
   * l'applicazione aziendale resta fuori.
   */
  const visibleSections = location.pathname.startsWith('/programmatore')
    ? PROGRAMMER_CONSOLE_SECTIONS
    : isProgrammer
      ? [...baseNavSections, ...PROGRAMMER_NAV_SECTIONS]
      : baseNavSections;

  useEffect(() => {
    setMobileOpenSection(null);
  }, [location.pathname]);


const inAreaProgrammatore = location.pathname.startsWith('/programmatore');

  return (
    <div
      className={`app-layout ws-layout ${isMobile ? 'is-mobile' : ''} ${
        inAreaProgrammatore ? 'area-programmatore' : ''
      }`}
    >
      {!isMobile && (
        <aside className="ws-sidebar" aria-label="Menu principale">
          <Link
            to={inAreaProgrammatore ? '/programmatore/stato' : getDefaultRouteForUser(user)}
            className="ws-brand"
          >
            <img className="ws-brand-logo" src="/logo.png" alt="" />
            <span className="ws-brand-text">
              <strong>WorkSpace</strong>
              <span>{inAreaProgrammatore ? 'Console tecnica' : AZIENDA_NOME}</span>
            </span>
          </Link>

          <nav className="ws-nav">
            {visibleSections.map((navSection) => (
              <div
                className="ws-nav-group"
                key={navSection.title}
                data-tone={SECTION_TONES[navSection.title] || 'gray'}
              >
                <div className="ws-nav-title">{navSection.title}</div>

                {navSection.items.map((item) => {
                  const attivo = isActivePath(location.pathname, item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`ws-nav-link ${attivo ? 'is-active' : ''}`}
                      aria-current={attivo ? 'page' : undefined}
                      title={item.label}
                    >
                      <span className="ws-nav-tile" aria-hidden="true">
                        <NavIcon path={item.path} fallback={item.icon} className="ws-nav-icon" />
                      </span>
                      <span className="ws-nav-label">{item.label}</span>

                      {item.badge && unreadCount > 0 && (
                        <span className="ws-nav-badge">{unreadCount}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}

            {inAreaProgrammatore && (
              <Link
                to={getDefaultRouteForUser(user)}
                className="ws-nav-link ws-nav-exit"
                title="Torna all’applicazione"
              >
                <span className="ws-nav-icon ws-nav-arrow" aria-hidden="true">←</span>
                <span className="ws-nav-label">Torna all’applicazione</span>
              </Link>
            )}
          </nav>

          <div className="ws-user">
            <span className="ws-avatar" aria-hidden="true">{initials}</span>

            <span className="ws-user-text">
              <strong>{displayName}</strong>
              <span>
                {isProgrammer
                  ? `${getRoleLabel(user?.role)} · Programmatore`
                  : getRoleLabel(user?.role)}
              </span>
            </span>

            <button type="button" className="ws-logout" onClick={logout} title="Esci" aria-label="Esci">
              <Icon name="logout" />
            </button>
          </div>
        </aside>
      )}
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
                      <NavIcon path={item.path} fallback={item.icon} />
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
                    <SectionIcon section={navSection} />
                  </span>
                  <span className="mobile-bottom-nav-label">
                    {SECTION_SHORT[navSection.title] || navSection.title}
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
              <span className="mobile-bottom-nav-icon">
                <Icon name="logout" />
              </span>
              <span className="mobile-bottom-nav-label">Esci</span>
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

            <ThemeToggle />
          </div>
        </header>

        {inAreaProgrammatore && (
          <div className="prog-ribbon">
            <span className="prog-ribbon-dot" />
            Area programmatore — supporto tecnico
          </div>
        )}

        <div className="page-content animate-fadeIn" key={location.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}

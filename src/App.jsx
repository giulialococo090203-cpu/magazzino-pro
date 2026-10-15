/* eslint-disable react-refresh/only-export-components */
import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
  lazy,
  Suspense,
} from 'react';
import CaricamentoPagina from './components/CaricamentoPagina';
import { ProtezionePagina } from './components/ProtezioneErrori';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { authStore } from './data/authStore';
import { systemStore } from './data/systemStore';
import { INITIAL_UNITS } from './data/initialData';
import { temaIniziale, salvaTema, applicaTema, ascoltaSistema } from './utils/theme';
import {
  hasPermission,
  getDefaultRouteForUser,
  isProgrammerUser,
} from './data/permissions';

// Login, layout e manutenzione servono subito: restano nel pacchetto iniziale.
import Login from './pages/Login';
import Manutenzione from './pages/Manutenzione';
import Layout from './components/Layout';

/*
 * Tutte le altre pagine si scaricano solo quando servono.
 * Prima l'intera applicazione (Excel, PDF, grafici, lettore fatture...)
 * era un unico file da 2,7 MB: finche' non arrivava tutto lo schermo
 * restava bianco. Ora all'avvio si scarica solo il necessario.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Pagine - Principale
const Inventario = lazy(() => import('./pages/principale/Inventario'));
const MovimentiForm = lazy(() => import('./pages/principale/MovimentiForm'));
const StoricoMovimenti = lazy(() => import('./pages/principale/StoricoMovimenti'));
const ImportaFatture = lazy(() => import('./pages/principale/ImportaFatture'));
const ArchivioFatture = lazy(() => import('./pages/principale/ArchivioFatture'));
const Ordini = lazy(() => import('./pages/principale/Ordini'));
const InventarioFisico = lazy(() => import('./pages/principale/InventarioFisico'));

// Pagine - Gestione
const GestioneCategorie = lazy(() => import('./pages/gestione/GestioneCategorie'));
const GestioneMateriali = lazy(() => import('./pages/gestione/GestioneMateriali'));
const GestioneUtenti = lazy(() => import('./pages/gestione/GestioneUtenti'));
const LogModifiche = lazy(() => import('./pages/gestione/LogModifiche'));
const ImpostazioniPrezzi = lazy(() => import('./pages/gestione/ImpostazioniPrezzi'));
const StoricoPrezzi = lazy(() => import('./pages/gestione/StoricoPrezzi'));
const Fornitori = lazy(() => import('./pages/gestione/Fornitori'));
const BackupSistema = lazy(() => import('./pages/gestione/BackupSistema'));
const RendicontazioneEconomica = lazy(() => import('./pages/gestione/RendicontazioneEconomica'));

// Pagine - Controllo
const Soglie = lazy(() => import('./pages/controllo/Soglie'));
const Notifiche = lazy(() => import('./pages/controllo/Notifiche'));

// Pagine - Programmatore (supporto tecnico)
const AccessoProgrammatore = lazy(() => import('./pages/programmatore/AccessoProgrammatore'));
const PannelloProgrammatore = lazy(() => import('./pages/programmatore/PannelloProgrammatore'));
const DatiAzienda = lazy(() => import('./pages/programmatore/DatiAzienda'));

import './index.css';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * ProtectedRoute - controlla il permesso dell'utente.
 * Non esistono più piani di abbonamento: l'app è di una sola azienda
 * e tutte le funzioni sono disponibili, filtrate solo dai permessi.
 */
function ProtectedRoute({ user, permission, children }) {
  if (!user) return <Navigate to="/" replace />;

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return children;
}

function ProtectedMovementRoute({ user }) {
  const { tipo } = useParams();

  const permissionByTipo = {
    entrata: 'canMoveIn',
    uscita: 'canMoveOut',
    reintegro: 'canReintegrate',
    rettifica: 'canRectify',
  };

  const requiredPermission = permissionByTipo[tipo];

  if (!requiredPermission || !hasPermission(user, requiredPermission)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <MovimentiForm />;
}

/**
 * Route della parte programmatore: riservata al supporto tecnico
 * e protetta dal codice d'accesso.
 */
function ProgrammerRoute({ user, unlocked, onUnlocked, children }) {
  if (!isProgrammerUser(user)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (!unlocked) {
    return <AccessoProgrammatore onUnlocked={onUnlocked} />;
  }

  return children;
}

function App() {
  // L'utente salvato si legge subito: niente schermo bianco all'apertura.
  const [currentUser, setCurrentUser] = useState(() => authStore.getCurrentUser());
  const [avvisoLogin, setAvvisoLogin] = useState('');
  const [appStatus, setAppStatus] = useState({ maintenance: false, message: '' });
  const [programmerUnlocked, setProgrammerUnlocked] = useState(() =>
    systemStore.isUnlocked()
  );
  const [theme, setTheme] = useState(() => temaIniziale());

  // Vero quando la modalità è stata scelta dall'utente: solo allora la salviamo,
  // altrimenti l'app continua a seguire l'impostazione del sistema.
  const sceltaUtente = useRef(false);

  useEffect(() => {
    applicaTema(theme);

    if (sceltaUtente.current) {
      salvaTema(theme);
    }
  }, [theme]);

  useEffect(() => ascoltaSistema(setTheme), []);

  const toggleTheme = useCallback(() => {
    sceltaUtente.current = true;
    setTheme((precedente) => (precedente === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshAppStatus = useCallback(async () => {
    try {
      const status = await systemStore.getPublicStatus();

      // Aggiorna solo se e' cambiato qualcosa: evita di ridisegnare
      // tutta l'app ogni minuto senza motivo.
      setAppStatus((precedente) =>
        precedente.maintenance === status.maintenance &&
        precedente.message === status.message
          ? precedente
          : status
      );
    } catch {
      // getPublicStatus non lancia errori: qui non si arriva.
    }
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem('wm_units')) {
        localStorage.setItem('wm_units', JSON.stringify(INITIAL_UNITS));
      }
    } catch {
      // Memoria del browser non disponibile: si usano i valori predefiniti.
    }

    /*
     * Prima l'app restava completamente bianca finche' Supabase non
     * rispondeva sullo stato di manutenzione (con rete lenta anche 10
     * secondi o piu'). Ora lo stato si controlla in background.
     */
    refreshAppStatus();
  }, [refreshAppStatus]);

  /*
   * Se l'utente salvato non ha piu' una sessione Firebase valida,
   * si torna al login invece di mostrare pagine vuote.
   */
  useEffect(() => {
    if (!currentUser) return undefined;

    let attivo = true;

    authStore.verificaSessione(currentUser).then(async (esito) => {
      if (!attivo || esito !== 'assente') return;

      await authStore.logout();
      systemStore.lock();

      if (!attivo) return;

      setProgrammerUnlocked(false);
      setAvvisoLogin('La sessione è scaduta: accedi di nuovo.');
      setCurrentUser(null);
    });

    return () => {
      attivo = false;
    };
    // Solo al cambio di utente, non a ogni aggiornamento del profilo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const interval = setInterval(refreshAppStatus, 60000);

    return () => clearInterval(interval);
  }, [currentUser, refreshAppStatus]);

  const login = (user) => {
    setAvvisoLogin('');
    setCurrentUser(user);
    refreshAppStatus();
  };

  const refreshCurrentUser = (updatedUser) => {
    if (!updatedUser) return;

    setCurrentUser(updatedUser);
    authStore.setCurrentUser(updatedUser);
  };

  const logout = async () => {
    await authStore.logout();
    systemStore.lock();
    setProgrammerUnlocked(false);
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <AuthContext.Provider
        value={{ user: null, login, logout, refreshCurrentUser, theme, toggleTheme }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Login onLogin={login} avviso={avvisoLogin} />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    );
  }

  const isProgrammer = isProgrammerUser(currentUser);

  // Manutenzione: bloccata per tutti tranne il programmatore.
  if (appStatus.maintenance && !isProgrammer) {
    return (
      <Manutenzione
        message={appStatus.message}
        onLogout={logout}
        tema={theme}
        onCambiaTema={toggleTheme}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        login,
        logout,
        refreshCurrentUser,
        isProgrammer,
        appStatus,
        theme,
        toggleTheme,
      }}
    >
      <BrowserRouter>
        <Layout>
          <ProtezionePagina>
          <Suspense fallback={<CaricamentoPagina />}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute user={currentUser} permission="canViewDashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/inventario"
              element={
                <ProtectedRoute user={currentUser} permission="canViewInventory">
                  <Inventario />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ordini"
              element={
                <ProtectedRoute user={currentUser} permission="canManageReorderProposals">
                  <Ordini />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ordini/:sezione"
              element={
                <ProtectedRoute user={currentUser} permission="canManageReorderProposals">
                  <Ordini />
                </ProtectedRoute>
              }
            />

            {/* Vecchi indirizzi separati: portano alla voce unica */}
            <Route path="/riordino" element={<Navigate to="/ordini/da-ordinare" replace />} />
            <Route
              path="/proposte-ordine"
              element={<Navigate to="/ordini/preparati" replace />}
            />

            <Route
              path="/inventario-fisico"
              element={
                <ProtectedRoute user={currentUser} permission="canPhysicalInventory">
                  <InventarioFisico />
                </ProtectedRoute>
              }
            />

            <Route
              path="/movimento/:tipo"
              element={<ProtectedMovementRoute user={currentUser} />}
            />

            <Route
              path="/storico"
              element={
                <ProtectedRoute user={currentUser} permission="canViewHistory">
                  <StoricoMovimenti />
                </ProtectedRoute>
              }
            />

            <Route
              path="/importa"
              element={
                <ProtectedRoute user={currentUser} permission="canImportInvoices">
                  <ImportaFatture />
                </ProtectedRoute>
              }
            />

            <Route
              path="/fatture"
              element={
                <ProtectedRoute user={currentUser} permission="canImportInvoices">
                  <ArchivioFatture />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/categorie"
              element={
                <ProtectedRoute user={currentUser} permission="canManageCategories">
                  <GestioneCategorie />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/materiali"
              element={
                <ProtectedRoute user={currentUser} permission="canManageMaterials">
                  <GestioneMateriali />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/fornitori"
              element={
                <ProtectedRoute user={currentUser} permission="canManageMaterials">
                  <Fornitori />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/rendicontazione"
              element={
                <ProtectedRoute user={currentUser} permission="canManageMaterials">
                  <RendicontazioneEconomica />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/prezzi"
              element={
                <ProtectedRoute user={currentUser} permission="canManagePriceSettings">
                  <ImpostazioniPrezzi />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/storico-prezzi"
              element={
                <ProtectedRoute user={currentUser} permission="canManagePriceSettings">
                  <StoricoPrezzi />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/utenti"
              element={
                <ProtectedRoute user={currentUser} permission="canManageUsers">
                  <GestioneUtenti />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/backup"
              element={
                <ProtectedRoute user={currentUser} permission="canManageUsers">
                  <BackupSistema />
                </ProtectedRoute>
              }
            />

            <Route
              path="/gestione/log"
              element={
                <ProtectedRoute user={currentUser} permission="canViewAuditLog">
                  <LogModifiche />
                </ProtectedRoute>
              }
            />

            <Route
              path="/controllo"
              element={
                <ProtectedRoute user={currentUser} permission="canViewDashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/controllo/soglie"
              element={
                <ProtectedRoute user={currentUser} permission="canManageThresholds">
                  <Soglie />
                </ProtectedRoute>
              }
            />

            <Route
              path="/controllo/notifiche"
              element={
                <ProtectedRoute user={currentUser} permission="canViewNotifications">
                  <Notifiche />
                </ProtectedRoute>
              }
            />

            <Route
              path="/programmatore"
              element={<Navigate to="/programmatore/stato" replace />}
            />

            <Route
              path="/programmatore/dati/:pagina"
              element={
                <ProgrammerRoute
                  user={currentUser}
                  unlocked={programmerUnlocked}
                  onUnlocked={() => setProgrammerUnlocked(true)}
                >
                  <DatiAzienda />
                </ProgrammerRoute>
              }
            />

            <Route
              path="/programmatore/:sezione"
              element={
                <ProgrammerRoute
                  user={currentUser}
                  unlocked={programmerUnlocked}
                  onUnlocked={() => setProgrammerUnlocked(true)}
                >
                  <PannelloProgrammatore />
                </ProgrammerRoute>
              }
            />

            {/* Vecchia rotta multi-azienda: reindirizza al pannello programmatore */}
            <Route path="/super/*" element={<Navigate to="/programmatore" replace />} />

            <Route
              path="*"
              element={<Navigate to={getDefaultRouteForUser(currentUser)} replace />}
            />
          </Routes>
          </Suspense>
          </ProtezionePagina>
        </Layout>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;

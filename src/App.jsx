/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
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

// Pagine - Login e Generale
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Manutenzione from './pages/Manutenzione';
import Layout from './components/Layout';

// Pagine - Principale
import Inventario from './pages/principale/Inventario';
import MovimentiForm from './pages/principale/MovimentiForm';
import StoricoMovimenti from './pages/principale/StoricoMovimenti';
import ImportaFatture from './pages/principale/ImportaFatture';
import ArchivioFatture from './pages/principale/ArchivioFatture';
import RiordinoAutomatico from './pages/principale/RiordinoAutomatico';
import ArchivioProposteOrdine from './pages/principale/ArchivioProposteOrdine';
import InventarioFisico from './pages/principale/InventarioFisico';

// Pagine - Gestione
import GestioneCategorie from './pages/gestione/GestioneCategorie';
import GestioneMateriali from './pages/gestione/GestioneMateriali';
import GestioneUtenti from './pages/gestione/GestioneUtenti';
import LogModifiche from './pages/gestione/LogModifiche';
import ImpostazioniPrezzi from './pages/gestione/ImpostazioniPrezzi';
import StoricoPrezzi from './pages/gestione/StoricoPrezzi';
import Fornitori from './pages/gestione/Fornitori';
import BackupSistema from './pages/gestione/BackupSistema';
import RendicontazioneEconomica from './pages/gestione/RendicontazioneEconomica';

// Pagine - Controllo
import Soglie from './pages/controllo/Soglie';
import Notifiche from './pages/controllo/Notifiche';

// Pagine - Programmatore (supporto tecnico)
import AccessoProgrammatore from './pages/programmatore/AccessoProgrammatore';
import PannelloProgrammatore from './pages/programmatore/PannelloProgrammatore';

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
function ProgrammerRoute({ user, unlocked, onUnlocked }) {
  if (!isProgrammerUser(user)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (!unlocked) {
    return <AccessoProgrammatore onUnlocked={onUnlocked} />;
  }

  return <PannelloProgrammatore />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setAppStatus(status);
    } catch {
      setAppStatus({ maintenance: false, message: '' });
    }
  }, []);

  useEffect(() => {
    const user = authStore.getCurrentUser();

    if (user) {
      setCurrentUser(user);
    }

    if (!localStorage.getItem('wm_units')) {
      localStorage.setItem('wm_units', JSON.stringify(INITIAL_UNITS));
    }

    refreshAppStatus().finally(() => setLoading(false));
  }, [refreshAppStatus]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const interval = setInterval(refreshAppStatus, 60000);

    return () => clearInterval(interval);
  }, [currentUser, refreshAppStatus]);

  const login = (user) => {
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

  if (loading) return null;

  if (!currentUser) {
    return (
      <AuthContext.Provider
        value={{ user: null, login, logout, refreshCurrentUser, theme, toggleTheme }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Login onLogin={login} />} />
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
              path="/riordino"
              element={
                <ProtectedRoute user={currentUser} permission="canManageReorderProposals">
                  <RiordinoAutomatico />
                </ProtectedRoute>
              }
            />

            <Route
              path="/proposte-ordine"
              element={
                <ProtectedRoute user={currentUser} permission="canManageReorderProposals">
                  <ArchivioProposteOrdine />
                </ProtectedRoute>
              }
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
              path="/programmatore/:sezione"
              element={
                <ProgrammerRoute
                  user={currentUser}
                  unlocked={programmerUnlocked}
                  onUnlocked={() => setProgrammerUnlocked(true)}
                />
              }
            />

            {/* Vecchia rotta multi-azienda: reindirizza al pannello programmatore */}
            <Route path="/super/*" element={<Navigate to="/programmatore" replace />} />

            <Route
              path="*"
              element={<Navigate to={getDefaultRouteForUser(currentUser)} replace />}
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;

import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { authStore } from './data/authStore';
import { INITIAL_UNITS } from './data/initialData';
import { hasPermission, getDefaultRouteForUser, isSuperAdminUser } from './data/permissions';
import { FEATURES, hasPlanFeature } from './data/subscriptionPlans';

// Pagine - Login e Generale
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
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
import GestioneAziende from './pages/super/GestioneAziende';

import './index.css';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Determina se l'utente è in modalità programmatore.
 * Può essere:
 * - super admin che ha selezionato l'azienda "programmatore"
 * - flag programmerMode nel profilo utente
 */
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

/**
 * ProtectedRoute - controlla permesso e feature plan.
 * I super admin bypassano entrambi i controlli.
 */
function ProtectedRoute({ user, permission, feature, children }) {
  if (!user) return <Navigate to="/" replace />;

  // Super admin bypassa tutti i controlli di permesso e piano
  if (isSuperAdminUser(user)) {
    return children;
  }

  if (!hasPermission(user, permission)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (feature && !hasPlanFeature(user, feature)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return children;
}

/**
 * ProtectedSuperRoute - solo per super admin in modalità programmatore.
 */
function ProtectedSuperRoute({ user, children }) {
  if (!user) return <Navigate to="/" replace />;

  if (!isSuperAdminUser(user) || !isProgrammerMode(user)) {
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

  const featureByTipo = {
    entrata: FEATURES.MOVE_IN,
    uscita: FEATURES.MOVE_OUT,
    reintegro: FEATURES.REINTEGRATE,
    rettifica: FEATURES.RECTIFY,
  };

  const requiredFeature = featureByTipo[tipo];

  // Super admin bypassa
  if (isSuperAdminUser(user)) {
    return <MovimentiForm />;
  }

  if (!requiredPermission || !hasPermission(user, requiredPermission)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (requiredFeature && !hasPlanFeature(user, requiredFeature)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <MovimentiForm />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = authStore.getCurrentUser();

    if (user) {
      setCurrentUser(user);
    }

    if (!localStorage.getItem('wm_units')) {
      localStorage.setItem('wm_units', JSON.stringify(INITIAL_UNITS));
    }

    setLoading(false);
  }, []);

  const login = (user) => {
    setCurrentUser(user);
  };

  const refreshCurrentUser = (updatedUser) => {
    if (!updatedUser) return;

    setCurrentUser(updatedUser);
    authStore.setCurrentUser(updatedUser);
  };

  const logout = async () => {
    await authStore.logout();
    setCurrentUser(null);
  };

  if (loading) return null;

  const programmerMode = currentUser ? isProgrammerMode(currentUser) : false;

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        login,
        logout,
        refreshCurrentUser,
      }}
    >
      <BrowserRouter>
        {!currentUser ? (
          <Routes>
            <Route path="*" element={<Login onLogin={login} />} />
          </Routes>
        ) : programmerMode ? (
          // In modalità programmatore: accesso a gestione aziende + tutte le route normali
          <Layout>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedSuperRoute user={currentUser}>
                    <GestioneAziende />
                  </ProtectedSuperRoute>
                }
              />

              <Route
                path="/super/aziende"
                element={
                  <ProtectedSuperRoute user={currentUser}>
                    <GestioneAziende />
                  </ProtectedSuperRoute>
                }
              />

              {/* In modalità programmatore, il programmatore può navigare su tutte le route */}
              <Route path="/inventario" element={<ProtectedRoute user={currentUser} permission="canViewInventory"><Inventario /></ProtectedRoute>} />
              <Route path="/riordino" element={<ProtectedRoute user={currentUser} permission="canManageReorderProposals"><RiordinoAutomatico /></ProtectedRoute>} />
              <Route path="/proposte-ordine" element={<ProtectedRoute user={currentUser} permission="canManageReorderProposals"><ArchivioProposteOrdine /></ProtectedRoute>} />
              <Route path="/inventario-fisico" element={<ProtectedRoute user={currentUser} permission="canPhysicalInventory"><InventarioFisico /></ProtectedRoute>} />
              <Route path="/movimento/:tipo" element={<ProtectedMovementRoute user={currentUser} />} />
              <Route path="/storico" element={<ProtectedRoute user={currentUser} permission="canViewHistory"><StoricoMovimenti /></ProtectedRoute>} />
              <Route path="/importa" element={<ProtectedRoute user={currentUser} permission="canImportInvoices"><ImportaFatture /></ProtectedRoute>} />
              <Route path="/fatture" element={<ProtectedRoute user={currentUser} permission="canImportInvoices"><ArchivioFatture /></ProtectedRoute>} />
              <Route path="/gestione/categorie" element={<ProtectedRoute user={currentUser} permission="canManageCategories"><GestioneCategorie /></ProtectedRoute>} />
              <Route path="/gestione/materiali" element={<ProtectedRoute user={currentUser} permission="canManageMaterials"><GestioneMateriali /></ProtectedRoute>} />
              <Route path="/gestione/fornitori" element={<ProtectedRoute user={currentUser} permission="canManageMaterials"><Fornitori /></ProtectedRoute>} />
              <Route path="/gestione/rendicontazione" element={<ProtectedRoute user={currentUser} permission="canManageMaterials"><RendicontazioneEconomica /></ProtectedRoute>} />
              <Route path="/gestione/prezzi" element={<ProtectedRoute user={currentUser} permission="canManagePriceSettings"><ImpostazioniPrezzi /></ProtectedRoute>} />
              <Route path="/gestione/storico-prezzi" element={<ProtectedRoute user={currentUser} permission="canManagePriceSettings"><StoricoPrezzi /></ProtectedRoute>} />
              <Route path="/gestione/utenti" element={<ProtectedRoute user={currentUser} permission="canManageUsers"><GestioneUtenti /></ProtectedRoute>} />
              <Route path="/gestione/backup" element={<ProtectedRoute user={currentUser} permission="canManageUsers"><BackupSistema /></ProtectedRoute>} />
              <Route path="/gestione/log" element={<ProtectedRoute user={currentUser} permission="canViewAuditLog"><LogModifiche /></ProtectedRoute>} />
              <Route path="/controllo" element={<ProtectedRoute user={currentUser} permission="canViewDashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/controllo/soglie" element={<ProtectedRoute user={currentUser} permission="canManageThresholds"><Soglie /></ProtectedRoute>} />
              <Route path="/controllo/notifiche" element={<ProtectedRoute user={currentUser} permission="canViewNotifications"><Notifiche /></ProtectedRoute>} />

              <Route
                path="*"
                element={<Navigate to="/super/aziende" replace />}
              />
            </Routes>
          </Layout>
        ) : (
          <Layout>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute user={currentUser} permission="canViewDashboard" feature={FEATURES.DASHBOARD}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inventario"
                element={
                  <ProtectedRoute user={currentUser} permission="canViewInventory" feature={FEATURES.INVENTORY}>
                    <Inventario />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/riordino"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageReorderProposals" feature={FEATURES.REORDER}>
                    <RiordinoAutomatico />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/proposte-ordine"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageReorderProposals" feature={FEATURES.REORDER_ARCHIVE}>
                    <ArchivioProposteOrdine />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inventario-fisico"
                element={
                  <ProtectedRoute user={currentUser} permission="canPhysicalInventory" feature={FEATURES.PHYSICAL_INVENTORY}>
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
                  <ProtectedRoute user={currentUser} permission="canViewHistory" feature={FEATURES.HISTORY_BASE}>
                    <StoricoMovimenti />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/importa"
                element={
                  <ProtectedRoute user={currentUser} permission="canImportInvoices" feature={FEATURES.INVOICES_IMPORT}>
                    <ImportaFatture />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/fatture"
                element={
                  <ProtectedRoute user={currentUser} permission="canImportInvoices" feature={FEATURES.INVOICES_ARCHIVE}>
                    <ArchivioFatture />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/categorie"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageCategories" feature={FEATURES.CATEGORIES}>
                    <GestioneCategorie />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/materiali"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageMaterials" feature={FEATURES.INVENTORY}>
                    <GestioneMateriali />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/fornitori"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageMaterials" feature={FEATURES.SUPPLIERS}>
                    <Fornitori />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/rendicontazione"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageMaterials" feature={FEATURES.ECONOMIC_REPORTING}>
                    <RendicontazioneEconomica />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/prezzi"
                element={
                  <ProtectedRoute user={currentUser} permission="canManagePriceSettings" feature={FEATURES.PRICE_SETTINGS}>
                    <ImpostazioniPrezzi />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/storico-prezzi"
                element={
                  <ProtectedRoute user={currentUser} permission="canManagePriceSettings" feature={FEATURES.PRICE_HISTORY}>
                    <StoricoPrezzi />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/utenti"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageUsers" feature={FEATURES.USERS_BASE}>
                    <GestioneUtenti />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/backup"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageUsers" feature={FEATURES.BACKUP}>
                    <BackupSistema />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/log"
                element={
                  <ProtectedRoute user={currentUser} permission="canViewAuditLog" feature={FEATURES.AUDIT_LOG}>
                    <LogModifiche />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo"
                element={
                  <ProtectedRoute user={currentUser} permission="canViewDashboard" feature={FEATURES.DASHBOARD}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo/soglie"
                element={
                  <ProtectedRoute user={currentUser} permission="canManageThresholds" feature={FEATURES.NOTIFICATIONS}>
                    <Soglie />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo/notifiche"
                element={
                  <ProtectedRoute user={currentUser} permission="canViewNotifications" feature={FEATURES.NOTIFICATIONS}>
                    <Notifiche />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super/aziende"
                element={
                  <ProtectedSuperRoute user={currentUser}>
                    <GestioneAziende />
                  </ProtectedSuperRoute>
                }
              />

              <Route
                path="*"
                element={<Navigate to={getDefaultRouteForUser(currentUser)} replace />}
              />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
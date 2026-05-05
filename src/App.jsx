import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { userStore } from './data/store';
import { INITIAL_UNITS } from './data/initialData';

// Pagine - Login e Generale
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

// Pagine - Principale
import Inventario from './pages/principale/Inventario';
import MovimentiForm from './pages/principale/MovimentiForm';
import StoricoMovimenti from './pages/principale/StoricoMovimenti';
import ImportaFatture from './pages/principale/ImportaFatture';

// Pagine - Gestione
import GestioneCategorie from './pages/gestione/GestioneCategorie';
import GestioneMateriali from './pages/gestione/GestioneMateriali';
import GestioneUtenti from './pages/gestione/GestioneUtenti';
import LogModifiche from './pages/gestione/LogModifiche';

// Pagine - Controllo
import DashboardControllo from './pages/controllo/DashboardControllo';
import Soglie from './pages/controllo/Soglie';
import Notifiche from './pages/controllo/Notifiche';

import './index.css';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

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

function getDefaultRoute(user) {
  if (hasRole(user, ['datore'])) return '/';
  if (hasRole(user, ['segretaria', 'magazziniere', 'operaio'])) return '/inventario';
  return '/inventario';
}

function ProtectedRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (!hasRole(user, allowedRoles)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }
  return children;
}

function ProtectedMovementRoute({ user }) {
  const { tipo } = useParams();

  const allowedRoles =
    tipo === 'rettifica'
      ? ['datore']
      : ['datore', 'segretaria', 'magazziniere'];

  if (!hasRole(user, allowedRoles)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }

  return <MovimentiForm />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = userStore.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }

    if (!localStorage.getItem('wm_units')) {
      localStorage.setItem('wm_units', JSON.stringify(INITIAL_UNITS));
    }

    setLoading(false);
  }, []);

  const login = (user) => setCurrentUser(user);

  const logout = () => {
    userStore.logout();
    setCurrentUser(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user: currentUser, login, logout }}>
      <BrowserRouter>
        {!currentUser ? (
          <Routes>
            <Route path="*" element={<Login onLogin={login} />} />
          </Routes>
        ) : (
          <Layout>
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inventario"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore', 'segretaria', 'magazziniere', 'operaio']}>
                    <Inventario />
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
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <StoricoMovimenti />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/importa"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore', 'segretaria']}>
                    <ImportaFatture />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/categorie"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore', 'segretaria']}>
                    <GestioneCategorie />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/materiali"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <GestioneMateriali />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/utenti"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <GestioneUtenti />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestione/log"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <LogModifiche />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore']}>
                    <DashboardControllo />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo/soglie"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore', 'segretaria']}>
                    <Soglie />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/controllo/notifiche"
                element={
                  <ProtectedRoute user={currentUser} allowedRoles={['datore', 'segretaria', 'magazziniere']}>
                    <Notifiche />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to={getDefaultRoute(currentUser)} replace />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Context per l'autenticazione
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Caricamento sessione utente
    const user = userStore.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    
    // Inizializzazione Unità di misura base se mancanti (fallback locale)
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
            {/* Cattura tutti i path non autenticati e mostra il Login */}
            <Route path="*" element={<Login onLogin={login} />} />
          </Routes>
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              
              {/* Sezione Principale */}
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/movimento/:tipo" element={<MovimentiForm />} />
              <Route path="/storico" element={<StoricoMovimenti />} />
              <Route path="/importa" element={<ImportaFatture />} />
              
              {/* Sezione Gestione */}
              <Route path="/gestione/categorie" element={<GestioneCategorie />} />
              <Route path="/gestione/materiali" element={<GestioneMateriali />} />
              <Route path="/gestione/utenti" element={<GestioneUtenti />} />
              <Route path="/gestione/log" element={<LogModifiche />} />
              
              {/* Sezione Controllo */}
              <Route path="/controllo" element={<DashboardControllo />} />
              <Route path="/controllo/soglie" element={<Soglie />} />
              <Route path="/controllo/notifiche" element={<Notifiche />} />
              
              {/* Rotta di fallback: reindirizza alla Dashboard usando replace */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;

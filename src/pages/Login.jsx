import { useState } from 'react';
import { authStore } from '../data/authStore';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getReadableError = (err) => {
    const code = err?.code || '';
    const message = err?.message || '';

    if (code.includes('auth/invalid-credential')) {
      return 'Email o password non corretti.';
    }

    if (code.includes('auth/user-not-found')) {
      return 'Utente non trovato.';
    }

    if (code.includes('auth/wrong-password')) {
      return 'Password non corretta.';
    }

    if (code.includes('auth/too-many-requests')) {
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    }

    if (message.includes('profilo non trovato')) {
      return 'Utente autenticato, ma profilo non trovato nel database.';
    }

    if (message.includes('Account disattivato')) {
      return 'Account disattivato.';
    }

    if (message.includes('Azienda non associata')) {
      return 'Azienda non associata all’utente.';
    }

    return 'Problema di connessione o credenziali non valide.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const user = await authStore.authenticate(email, password);

      if (user) {
        onLogin(user);
      } else {
        setError('Credenziali non valide o account non attivo.');
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError(getReadableError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">M</div>
          <h2>MagazzinoPro</h2>
          <p>Sistema di Gestione Magazzino</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="Inserisci la tua email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Inserisci la tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? 'Accesso in corso...' : 'Accedi al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { userStore } from '../data/store';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await userStore.authenticate(username.trim(), password.trim());
      if (user) {
        onLogin(user);
      } else {
        setError('Credenziali non valide o account non attivo.');
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError('Problema di connessione ricollegarsi tra pochi istanti.');
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
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="Inserisci il tuo username"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
              onChange={e => setPassword(e.target.value)}
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

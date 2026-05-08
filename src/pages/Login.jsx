import { useState } from 'react';
import { authStore } from '../data/authStore';

function getLoginErrorMessage(err) {
  const code = String(err?.code || err?.message || '').toLowerCase();

  if (code.includes('auth/invalid-credential')) {
    return 'Credenziali non valide. Controlla email e password.';
  }

  if (code.includes('auth/user-not-found')) {
    return 'Utente non trovato.';
  }

  if (code.includes('auth/wrong-password')) {
    return 'Password non corretta.';
  }

  if (code.includes('auth/too-many-requests')) {
    return 'Troppi tentativi. Riprova più tardi.';
  }

  return err?.message || 'Errore durante l’accesso.';
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Inserisci email e password.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const user = await authStore.authenticate(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const formFields = (
    <>
      {error && <div className="login-error">{error}</div>}

      <label className="login-redesign-field mobile-login-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Inserisci la tua email"
        />
      </label>

      <label className="login-redesign-field mobile-login-field">
        <span>Password</span>
        <div className="login-redesign-password-wrap mobile-login-password-wrap">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Inserisci la tua password"
          />

          <button
            type="button"
            className="login-redesign-password-toggle mobile-login-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
          >
            {showPassword ? 'Nascondi' : 'Mostra'}
          </button>
        </div>
      </label>

      <button type="submit" className="btn btn-primary login-redesign-submit mobile-login-submit" disabled={loading}>
        {loading ? 'Accesso in corso...' : 'Accedi al Sistema'}
      </button>
    </>
  );

  return (
    <>
      {/* DESKTOP / TABLET: NON TOCCARE */}
      <main className="login-page login-redesign-page login-desktop-view">
        <div className="login-redesign-card">
          <section className="login-redesign-brand" aria-label="WorkSpace">
            <div className="workspace-logo-shell workspace-logo-shell-big"><img className="workspace-logo-img workspace-logo-img-big" src="/workspace-logo.png" alt="WorkSpace" /></div>

            <div className="login-redesign-brand-content">
              <div className="login-redesign-kicker">Gestionale tecnico</div>
              <h1>WorkSpace</h1>
              <p>Gestisci materiali, fatture, movimenti e report in un unico spazio operativo.</p>
            </div>
          </section>

          <section className="login-redesign-form-panel">
            <div className="login-redesign-heading">
              <div className="workspace-logo-shell workspace-logo-shell-small"><img className="workspace-logo-img workspace-logo-img-small" src="/workspace-logo.png" alt="WorkSpace" /></div>
              <div>
                <h2>Accedi</h2>
                <p>Piattaforma di gestione operativa</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-redesign-form">
              <div>
                <h3>Accedi al sistema</h3>
                <p className="login-redesign-helper">Accedi al tuo spazio di lavoro</p>
              </div>

              {formFields}
            </form>
          </section>
        </div>
      </main>

      {/* TELEFONO: SCHERMATA SEPARATA */}
      <main className="mobile-login-view">
        <section className="mobile-login-phone">
          <div className="mobile-login-top">
            <div className="workspace-logo-shell workspace-logo-shell-mobile"><img className="workspace-logo-img workspace-logo-img-mobile" src="/workspace-logo.png" alt="WorkSpace" /></div>
            <div className="mobile-login-title">WorkSpace</div>
          </div>

          <form onSubmit={handleSubmit} className="mobile-login-card">
            <h1>Login</h1>
            <p>Accedi al sistema di gestione magazzino</p>

            {formFields}
          </form>

          <div className="mobile-login-footer">
            Gestionale tecnico
          </div>
        </section>
      </main>
    </>
  );
}

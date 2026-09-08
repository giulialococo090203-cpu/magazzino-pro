import { useEffect, useState } from 'react';
import { authStore } from '../data/authStore';
import { AZIENDA_NOME } from '../config/azienda';
import ThemeToggle from '../components/ThemeToggle';

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
  const [useMobileLogin, setUseMobileLogin] = useState(false);

  useEffect(() => {
    const updateLoginLayout = () => {
      setUseMobileLogin(window.innerWidth <= 768);
    };

    updateLoginLayout();
    window.addEventListener('resize', updateLoginLayout);
    window.addEventListener('orientationchange', updateLoginLayout);

    return () => {
      window.removeEventListener('resize', updateLoginLayout);
      window.removeEventListener('orientationchange', updateLoginLayout);
    };
  }, []);

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

      <button
        type="submit"
        className="btn btn-primary login-redesign-submit mobile-login-submit"
        disabled={loading}
      >
        {loading ? 'Accesso in corso...' : 'Accedi al Sistema'}
      </button>
    </>
  );

  if (useMobileLogin) {
    return (
      <main className="mobile-login-view mobile-login-stable-final">
        <ThemeToggle className="theme-toggle-floating" />

        <section className="mobile-login-phone">
          <div className="mobile-login-top">
            <div className="workspace-logo-shell workspace-logo-shell-mobile">
              <img
                className="workspace-logo-img workspace-logo-img-mobile"
                src="/logo.png"
                alt="WorkSpace"
              />
            </div>
            <div className="mobile-login-title">WorkSpace</div>
          </div>

          <form onSubmit={handleSubmit} className="mobile-login-card">
            <h1>Login</h1>
            <p>Accedi con le credenziali del tuo account {AZIENDA_NOME}.</p>

            {formFields}
          </form>

          <div className="mobile-login-footer" aria-hidden="true"></div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page login-redesign-page login-desktop-view">
      <ThemeToggle className="theme-toggle-floating" />

      <div className="login-redesign-card">
        <section className="login-redesign-brand" aria-label="WorkSpace">
          <div className="workspace-logo-shell workspace-logo-shell-big">
            <img
              className="workspace-logo-img workspace-logo-img-big"
              src="/logo.png"
              alt="WorkSpace"
            />
          </div>

          <div className="login-redesign-brand-content">
            <div className="login-redesign-kicker"></div>
            <h1>WorkSpace</h1>
            <p>
              Controlla operazioni, materiali, fatture e performance aziendali da un
              unico ambiente.
            </p>
          </div>
        </section>

        <section className="login-redesign-form-panel">
          <div className="login-redesign-heading">
            <div className="workspace-logo-shell workspace-logo-shell-small">
              <img
                className="workspace-logo-img workspace-logo-img-small"
                src="/logo.png"
                alt="WorkSpace"
              />
            </div>
            <div>
              <h2>Accedi</h2>
              <p>{AZIENDA_NOME}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-redesign-form">
            <div>
              <h3>Accedi a WorkSpace</h3>
              <p className="login-redesign-helper">
                Inserisci le credenziali del tuo account operativo.
              </p>
            </div>

            {formFields}
          </form>
        </section>
      </div>
    </main>
  );
}

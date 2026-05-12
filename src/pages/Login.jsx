import { useEffect, useState } from 'react';
import { authStore } from '../data/authStore';
import { companyStore } from '../data/store';

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
  const [step, setStep] = useState(() => (companyStore.getSelected() ? 'user' : 'company'));
  const [companyCode, setCompanyCode] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(() => companyStore.getSelected());
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

  const handleCompanySubmit = async (e) => {
    e.preventDefault();

    if (!companyCode.trim()) {
      setError('Inserisci il codice azienda.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const company = await companyStore.getByCode(companyCode.trim());
      companyStore.setSelected(company);
      setSelectedCompany(company);
      setStep('user');
    } catch (err) {
      setError(err?.message || 'Azienda non trovata.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCompany = () => {
    companyStore.clearSelected();
    setSelectedCompany(null);
    setCompanyCode('');
    setEmail('');
    setPassword('');
    setError('');
    setStep('company');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCompany?.id) {
      setError('Seleziona prima l’azienda.');
      setStep('company');
      return;
    }

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

  const companyFields = (
    <>
      {error && <div className="login-error">{error}</div>}

      {selectedCompany && (
        <div className="login-company-pill">
          <span>{selectedCompany.name || selectedCompany.nome}</span>
          <button type="button" onClick={handleChangeCompany}>
            Cambia azienda
          </button>
        </div>
      )}

      <label className="login-redesign-field mobile-login-field">
        <span>Codice azienda</span>
        <input
          type="text"
          autoComplete="organization"
          value={companyCode}
          onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
          placeholder="Es. THERMOSERVICE"
        />
      </label>

      <button type="submit" className="btn btn-primary login-redesign-submit mobile-login-submit" disabled={loading}>
        {loading ? 'Verifica azienda...' : 'Continua'}
      </button>
    </>
  );

  const formFields = (
    <>
      {error && <div className="login-error">{error}</div>}

      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={handleChangeCompany}
        style={{
          alignSelf: 'flex-start',
          marginBottom: 8,
          paddingLeft: 0,
          color: 'var(--gray-600)',
          fontWeight: 800,
        }}
      >
        ← Cambia azienda
      </button>

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

  if (useMobileLogin) {
    return (
      <main className="mobile-login-view mobile-login-stable-final">
        <section className="mobile-login-phone">
          <div className="mobile-login-top">
            <div className="workspace-logo-shell workspace-logo-shell-mobile"><img className="workspace-logo-img workspace-logo-img-mobile" src="/optimized/workspace-logo.webp" alt="WorkSpace" /></div>
            <div className="mobile-login-title">WorkSpace</div>
          </div>

          <form onSubmit={step === 'company' ? handleCompanySubmit : handleSubmit} className="mobile-login-card">
            <h1>{step === 'company' ? 'Azienda' : 'Login'}</h1>
            <p>
              {step === 'company'
                ? 'Inserisci il codice aziendale per accedere al tuo ambiente.'
                : `Accedi come utente${selectedCompany?.name ? ` di ${selectedCompany.name}` : ''}.`}
            </p>

            {step === 'company' ? companyFields : formFields}
          </form>

          <div className="mobile-login-footer" aria-hidden="true"></div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page login-redesign-page login-desktop-view">
      <div className="login-redesign-card">
        <section className="login-redesign-brand" aria-label="WorkSpace">
          <div className="workspace-logo-shell workspace-logo-shell-big"><img className="workspace-logo-img workspace-logo-img-big" src="/optimized/workspace-logo.webp" alt="WorkSpace" /></div>

          <div className="login-redesign-brand-content">
            <div className="login-redesign-kicker"></div>
            <h1>WorkSpace</h1>
            <p>Controlla operazioni, materiali, fatture e performance aziendali da un unico ambiente.</p>
          </div>
        </section>

        <section className="login-redesign-form-panel">
          <div className="login-redesign-heading">
            <div className="workspace-logo-shell workspace-logo-shell-small"><img className="workspace-logo-img workspace-logo-img-small" src="/optimized/workspace-logo.webp" alt="WorkSpace" /></div>
            <div>
              <h2>Accedi</h2>
              <p>Centro operativo aziendale</p>
            </div>
          </div>

          <form onSubmit={step === 'company' ? handleCompanySubmit : handleSubmit} className="login-redesign-form">
            <div>
              <h3>{step === 'company' ? 'Accedi alla tua azienda' : `Accedi a ${selectedCompany?.name || selectedCompany?.nome || 'WorkSpace'}`}</h3>
              <p className="login-redesign-helper">
                {step === 'company'
                  ? 'Inserisci il codice aziendale fornito dall’amministratore.'
                  : 'Inserisci le credenziali del tuo account operativo.'}
              </p>
            </div>

            {step === 'company' ? companyFields : formFields}
          </form>
        </section>
      </div>
    </main>
  );
}

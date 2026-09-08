import { useState } from 'react';
import { systemStore } from '../../data/systemStore';
import SafeIcon from '../../components/SafeIcon';

/**
 * Gate della parte programmatore: chiede il codice d'accesso.
 * Il codice viene verificato lato server; se non è ancora stato
 * impostato, il primo codice inserito diventa quello ufficiale.
 */
export default function AccessoProgrammatore({ onUnlocked }) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!code.trim()) {
      setError('Inserisci il codice d’accesso.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setInfo('');

      const result = await systemStore.unlock(code.trim());

      if (result?.initialized) {
        setInfo('Codice d’accesso impostato. Conservalo in un posto sicuro.');
      }

      setCode('');

      if (typeof onUnlocked === 'function') {
        onUnlocked();
      }
    } catch (err) {
      setError(err?.message || 'Codice d’accesso non valido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prog-gate">
      <div className="card prog-gate-card">
        <div className="prog-gate-icon">
          <SafeIcon name="settings" size={28} />
        </div>

        <h1 className="page-title">Area Programmatore</h1>

        <p className="page-subtitle">
          Zona riservata al supporto tecnico dell’applicazione.
          Inserisci il codice d’accesso per continuare.
        </p>

        {error && <div className="login-error">{error}</div>}
        {info && <div className="alert alert-success">{info}</div>}

        <form onSubmit={handleSubmit} className="prog-gate-form">
          <label className="form-group">
            <span className="form-label">Codice d’accesso</span>

            <div className="login-redesign-password-wrap">
              <input
                className="form-control"
                type={showCode ? 'text' : 'password'}
                value={code}
                autoComplete="off"
                onChange={(event) => setCode(event.target.value)}
                placeholder="Inserisci il codice"
              />

              <button
                type="button"
                className="login-redesign-password-toggle"
                onClick={() => setShowCode((value) => !value)}
              >
                {showCode ? 'Nascondi' : 'Mostra'}
              </button>
            </div>

            <span className="form-hint">
              Se non hai ancora impostato un codice, il primo che inserisci qui
              diventerà il codice ufficiale dell’area programmatore.
            </span>
          </label>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Verifica in corso...' : 'Entra'}
          </button>
        </form>
      </div>
    </div>
  );
}

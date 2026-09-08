import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { systemStore } from '../../data/systemStore';
import { companyStore } from '../../data/store';
import { AZIENDA_ID, AZIENDA_NOME } from '../../config/azienda';
import { getSupabaseUsageMonitor, formatBytes, calcPercent } from '../../utils/supabaseUsage';
import SafeIcon from '../../components/SafeIcon';

const SEZIONI = [
  { key: 'stato', label: 'Stato app' },
  { key: 'andamento', label: 'Andamento' },
  { key: 'integrita', label: 'Integrità dati' },
  { key: 'manutenzione', label: 'Manutenzione' },
  { key: 'utenti', label: 'Utenti e accessi' },
  { key: 'codice', label: 'Codice d’accesso' },
];

const CHIAVI_SEZIONI = SEZIONI.map((sezione) => sezione.key);

const STATUS_LABELS = {
  ok: { label: 'Tutto regolare', className: 'prog-status-ok' },
  attenzione: { label: 'Attenzione', className: 'prog-status-warn' },
  critico: { label: 'Problema critico', className: 'prog-status-error' },
};

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return `${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('it-IT');
}

export default function PannelloProgrammatore() {
  const { sezione } = useParams();
  const navigate = useNavigate();

  // La sezione attiva è quella nell'indirizzo: si arriva dal menu laterale.
  const tab = CHIAVI_SEZIONI.includes(sezione) ? sezione : 'stato';
  const setTab = useCallback(
    (chiave) => navigate(`/programmatore/${chiave}`),
    [navigate]
  );

  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState('');

  const [usage, setUsage] = useState(null);
  const [company, setCompany] = useState(null);

  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const [integrity, setIntegrity] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const [config, setConfig] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [codeSaving, setCodeSaving] = useState(false);

  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');

  const [ownerForm, setOwnerForm] = useState({ fullName: '', email: '', password: '' });
  const [ownerSaving, setOwnerSaving] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showFeedback = useCallback((message) => {
    setFeedback(message);
    setErrorMessage('');
    setTimeout(() => setFeedback(''), 5000);
  }, []);

  const showError = useCallback((message) => {
    setErrorMessage(message);
    setFeedback('');
  }, []);

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnosticsLoading(true);
      setDiagnosticsError('');

      const result = await systemStore.runDiagnostics();
      setDiagnostics(result);
    } catch (error) {
      setDiagnosticsError(error?.message || 'Diagnostica non eseguibile.');
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const result = await getSupabaseUsageMonitor();
      setUsage(result);
    } catch (error) {
      console.warn('Memoria Supabase non leggibile:', error);
      setUsage(null);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const result = await systemStore.getConfig();
      setConfig(result);
      setMaintenanceMessage(result?.maintenanceMessage || '');
    } catch (error) {
      showError(error?.message || 'Configurazione non leggibile.');
    }
  }, [showError]);

  const loadTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      const result = await systemStore.getAppTrend(6);
      setTrend(result);
    } catch (error) {
      showError(error?.message || 'Andamento non disponibile.');
    } finally {
      setTrendLoading(false);
    }
  }, [showError]);

  const loadIntegrity = useCallback(async () => {
    try {
      setIntegrityLoading(true);
      const result = await systemStore.checkDataIntegrity();
      setIntegrity(result);
    } catch (error) {
      showError(error?.message || 'Controllo integrità non eseguibile.');
    } finally {
      setIntegrityLoading(false);
    }
  }, [showError]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const result = await systemStore.listUsers();
      setUsers(result);
    } catch (error) {
      showError(error?.message || 'Elenco utenti non disponibile.');
    } finally {
      setUsersLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadDiagnostics();
    loadUsage();
    loadConfig();
    companyStore.getCurrent().then(setCompany).catch(() => setCompany(null));
  }, [loadDiagnostics, loadUsage, loadConfig]);

  useEffect(() => {
    if (tab === 'andamento' && !trend && !trendLoading) loadTrend();
    if (tab === 'integrita' && !integrity && !integrityLoading) loadIntegrity();
    if (tab === 'utenti' && users.length === 0 && !usersLoading) loadUsers();
  }, [
    tab,
    trend,
    trendLoading,
    loadTrend,
    integrity,
    integrityLoading,
    loadIntegrity,
    users.length,
    usersLoading,
    loadUsers,
  ]);

  const status = STATUS_LABELS[diagnostics?.status || 'ok'];

  const maxMonthValue = useMemo(() => {
    if (!trend?.months?.length) return 1;

    return Math.max(
      1,
      ...trend.months.map((month) => Math.max(month.movements, month.invoices))
    );
  }, [trend]);

  const handleSaveCode = async (event) => {
    event.preventDefault();

    if (newCode.trim().length < 6) {
      showError('Il codice d’accesso deve avere almeno 6 caratteri.');
      return;
    }

    if (newCode.trim() !== confirmCode.trim()) {
      showError('I due codici non coincidono.');
      return;
    }

    try {
      setCodeSaving(true);
      await systemStore.setAccessCode(newCode.trim());
      setNewCode('');
      setConfirmCode('');
      await loadConfig();
      showFeedback('Codice d’accesso aggiornato.');
    } catch (error) {
      showError(error?.message || 'Codice non aggiornato.');
    } finally {
      setCodeSaving(false);
    }
  };

  const handleToggleMaintenance = async (active) => {
    try {
      setMaintenanceSaving(true);
      await systemStore.setMaintenance(active, maintenanceMessage);
      await loadConfig();
      showFeedback(
        active
          ? 'Modalità manutenzione attivata: gli utenti non possono più usare l’app.'
          : 'Modalità manutenzione disattivata: l’app è di nuovo utilizzabile.'
      );
    } catch (error) {
      showError(error?.message || 'Stato manutenzione non aggiornato.');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleRepairOrphans = async () => {
    try {
      setRepairing(true);
      const result = await systemStore.repairOrphanRecords();
      const total = (result?.repaired || []).reduce(
        (sum, row) => sum + Number(row.updated || 0),
        0
      );

      await loadIntegrity();
      showFeedback(`Record sistemati: ${formatNumber(total)}.`);
    } catch (error) {
      showError(error?.message || 'Riparazione non riuscita.');
    } finally {
      setRepairing(false);
    }
  };

  const handleToggleUser = async (user) => {
    try {
      setBusyUserId(user.id);
      await systemStore.setUserActive(user.id, !user.attivo);
      await loadUsers();
      showFeedback(
        user.attivo
          ? `${user.nome || user.email} è stato disattivato.`
          : `${user.nome || user.email} è stato riattivato.`
      );
    } catch (error) {
      showError(error?.message || 'Utente non aggiornato.');
    } finally {
      setBusyUserId('');
    }
  };

  const handlePasswordReset = async (user) => {
    try {
      setBusyUserId(user.id);
      await systemStore.sendPasswordReset(user.email || user.username);
      showFeedback(`Email di reimpostazione password inviata a ${user.email || user.username}.`);
    } catch (error) {
      showError(error?.message || 'Email non inviata.');
    } finally {
      setBusyUserId('');
    }
  };

  const handleCreateOwner = async (event) => {
    event.preventDefault();

    if (!ownerForm.fullName.trim() || !ownerForm.email.trim() || !ownerForm.password.trim()) {
      showError('Nome, email e password sono obbligatori.');
      return;
    }

    try {
      setOwnerSaving(true);
      await systemStore.createOwner(ownerForm);
      setOwnerForm({ fullName: '', email: '', password: '' });
      await loadUsers();
      showFeedback('Account datore creato/ripristinato.');
    } catch (error) {
      showError(error?.message || 'Creazione datore non riuscita.');
    } finally {
      setOwnerSaving(false);
    }
  };

  return (
    <div className="prog-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <SafeIcon name="settings" className="ui-title-icon" size={22} /> Pannello Programmatore
          </h1>
          <p className="page-subtitle">
            Supporto tecnico e stato dell’applicazione — {company?.name || AZIENDA_NOME}
            {' · '}
            <code>{AZIENDA_ID}</code>
          </p>
        </div>

        <div className={`prog-status-pill ${status.className}`}>
          <span className="prog-status-dot" />
          {diagnosticsLoading ? 'Controllo in corso...' : status.label}
        </div>
      </div>

      {feedback && <div className="alert alert-success">{feedback}</div>}
      {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

      {config?.maintenance && (
        <div className="alert alert-warning">
          <strong>Manutenzione attiva.</strong>{' '}
          Gli utenti dell’azienda vedono la schermata di manutenzione e non possono
          usare l’app. Ricordati di disattivarla quando hai finito.
        </div>
      )}

      <div className="tabs prog-tabs">
        {SEZIONI.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ============================ STATO ============================ */}
      {tab === 'stato' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Diagnostica completa</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadDiagnostics}
                disabled={diagnosticsLoading}
              >
                {diagnosticsLoading ? 'Controllo...' : 'Riesegui controllo'}
              </button>
            </div>

            <div className="card-body">
              {diagnosticsError && <div className="alert alert-danger">{diagnosticsError}</div>}

              <p className="text-muted text-sm">
                Ultimo controllo: {formatDateTime(diagnostics?.generatedAt)}
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th>Esito</th>
                      <th>Tempo</th>
                      <th>Dettaglio</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(diagnostics?.checks || []).map((check) => (
                      <tr key={check.key}>
                        <td className="fw-semibold">{check.label}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              check.ok ? 'status-disponibile' : 'status-esaurito'
                            }`}
                          >
                            {check.ok ? 'OK' : 'Errore'}
                          </span>
                        </td>
                        <td className="numeric">{check.ms} ms</td>
                        <td className="text-sm">{check.detail}</td>
                      </tr>
                    ))}

                    {!diagnostics && !diagnosticsLoading && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          Nessun controllo eseguito.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Memoria e archivio</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadUsage}
              >
                Aggiorna
              </button>
            </div>

            <div className="card-body">
              {usage ? (
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-label">Database</div>
                    <div className="kpi-value">{formatBytes(usage.databaseBytes)}</div>
                    <div className="kpi-detail">{calcPercent(usage.databaseBytes)}% del piano</div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-label">File fatture</div>
                    <div className="kpi-value">{formatBytes(usage.storageBytes)}</div>
                    <div className="kpi-detail">
                      {(usage.buckets || []).reduce((sum, b) => sum + Number(b.files || 0), 0)} file
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-label">Totale occupato</div>
                    <div className="kpi-value">{formatBytes(usage.totalBytes)}</div>
                    <div className="kpi-detail">Aggiornato: {formatDateTime(usage.updatedAt)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted">Dati di memoria non disponibili al momento.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================== ANDAMENTO ========================== */}
      {tab === 'andamento' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Andamento ultimi 6 mesi</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadTrend}
                disabled={trendLoading}
              >
                {trendLoading ? 'Caricamento...' : 'Aggiorna'}
              </button>
            </div>

            <div className="card-body">
              {trendLoading && <p className="text-muted">Caricamento andamento...</p>}

              {trend && (
                <>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-label">Utenti attivi</div>
                      <div className="kpi-value">{formatNumber(trend.activeUsers)}</div>
                      <div className="kpi-detail">su {formatNumber(trend.totalUsers)} totali</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-label">Materiali da riordinare</div>
                      <div className="kpi-value">{formatNumber(trend.lowStock)}</div>
                      <div className="kpi-detail">sotto soglia o esauriti</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-label">Notifiche non lette</div>
                      <div className="kpi-value">{formatNumber(trend.unreadNotifications)}</div>
                      <div className="kpi-detail">da gestire</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-label">Ultimo movimento</div>
                      <div className="kpi-value prog-kpi-small">
                        {formatDateTime(trend.lastMovement?.data_movimento)}
                      </div>
                      <div className="kpi-detail">
                        {trend.lastMovement?.operatore_nome || 'nessun operatore'}
                      </div>
                    </div>
                  </div>

                  <div className="prog-bars">
                    {trend.months.map((month) => (
                      <div className="prog-bar-row" key={month.label}>
                        <span className="prog-bar-label">{month.label}</span>

                        <div className="prog-bar-track">
                          <div
                            className="prog-bar prog-bar-movements"
                            style={{ width: `${(month.movements / maxMonthValue) * 100}%` }}
                          />
                          <div
                            className="prog-bar prog-bar-invoices"
                            style={{ width: `${(month.invoices / maxMonthValue) * 100}%` }}
                          />
                        </div>

                        <span className="prog-bar-value">
                          {formatNumber(month.movements)} mov. · {formatNumber(month.invoices)} fatt.
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Ultime attività registrate</h2>
            </div>

            <div className="card-body">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Area</th>
                      <th>Azione</th>
                      <th>Dettaglio</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(trend?.lastLogs || []).map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.created_at)}</td>
                        <td>{log.entita || '—'}</td>
                        <td className="fw-semibold">{log.azione || '—'}</td>
                        <td className="text-sm">{log.descrizione || '—'}</td>
                      </tr>
                    ))}

                    {(!trend?.lastLogs || trend.lastLogs.length === 0) && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          Nessuna attività registrata.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================== INTEGRITÀ ========================== */}
      {tab === 'integrita' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Controllo integrità dati</h2>

              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadIntegrity}
                  disabled={integrityLoading}
                >
                  {integrityLoading ? 'Controllo...' : 'Ricontrolla'}
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRepairOrphans}
                  disabled={repairing}
                >
                  {repairing ? 'Sistemazione...' : 'Ripara record orfani'}
                </button>
              </div>
            </div>

            <div className="card-body">
              <p className="text-muted text-sm">
                Qui trovi i dati incoerenti che possono far comportare male l’app.
                “Ripara record orfani” riassegna all’azienda i record salvati senza
                riferimento aziendale.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Controllo</th>
                      <th>Esito</th>
                      <th>Record</th>
                      <th>Descrizione</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(integrity || []).map((issue) => (
                      <tr key={issue.label}>
                        <td className="fw-semibold">{issue.label}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              issue.ok ? 'status-disponibile' : 'status-sotto'
                            }`}
                          >
                            {issue.ok ? 'OK' : 'Da verificare'}
                          </span>
                        </td>
                        <td className="numeric">
                          {issue.count === null ? '—' : formatNumber(issue.count)}
                        </td>
                        <td className="text-sm">{issue.description}</td>
                      </tr>
                    ))}

                    {!integrity && !integrityLoading && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          Nessun controllo eseguito.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================== CODICE ============================ */}
      {tab === 'codice' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Codice d’accesso area programmatore</h2>
            </div>

            <div className="card-body">
              <p className="text-muted text-sm">
                Stato:{' '}
                <strong>{config?.hasAccessCode ? 'impostato' : 'non ancora impostato'}</strong>
                {config?.accessCodeUpdatedAt
                  ? ` · ultima modifica ${formatDateTime(config.accessCodeUpdatedAt)}`
                  : ''}
              </p>

              <p className="text-muted text-sm">
                Il codice viene salvato solo come impronta cifrata sul server: non è
                recuperabile, ma puoi sostituirlo quando vuoi. Serve unicamente per
                entrare in quest’area; gli utenti dell’azienda accedono con email e password.
              </p>

              <form onSubmit={handleSaveCode} className="form-row prog-form">
                <label className="form-group">
                  <span className="form-label">Nuovo codice</span>
                  <input
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value)}
                    placeholder="Almeno 6 caratteri"
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Conferma codice</span>
                  <input
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    value={confirmCode}
                    onChange={(event) => setConfirmCode(event.target.value)}
                    placeholder="Ripeti il codice"
                  />
                </label>

                <button type="submit" className="btn btn-primary" disabled={codeSaving}>
                  {codeSaving ? 'Salvataggio...' : 'Aggiorna codice'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================== MANUTENZIONE ========================= */}
      {tab === 'manutenzione' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Modalità manutenzione</h2>

              <span
                className={`status-badge ${
                  config?.maintenance ? 'status-esaurito' : 'status-disponibile'
                }`}
              >
                {config?.maintenance ? 'Attiva' : 'Non attiva'}
              </span>
            </div>

            <div className="card-body">
              <p className="text-muted text-sm">
                Con la manutenzione attiva gli utenti dell’azienda vedono un messaggio
                e non possono usare l’app, mentre tu continui a lavorarci normalmente.
                {config?.maintenanceSince
                  ? ` Attiva dal ${formatDateTime(config.maintenanceSince)}.`
                  : ''}
              </p>

              <label className="form-group">
                <span className="form-label">Messaggio mostrato agli utenti</span>
                <textarea
                  className="form-control"
                  rows={3}
                  value={maintenanceMessage}
                  onChange={(event) => setMaintenanceMessage(event.target.value)}
                  placeholder="Stiamo aggiornando il sistema. Torna tra poco."
                />
              </label>

              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => handleToggleMaintenance(true)}
                  disabled={maintenanceSaving}
                >
                  Attiva manutenzione
                </button>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleToggleMaintenance(false)}
                  disabled={maintenanceSaving}
                >
                  Disattiva manutenzione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ UTENTI =========================== */}
      {tab === 'utenti' && (
        <div className="prog-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Utenti dell’azienda</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadUsers}
                disabled={usersLoading}
              >
                {usersLoading ? 'Caricamento...' : 'Aggiorna'}
              </button>
            </div>

            <div className="card-body">
              <p className="text-muted text-sm">
                Da qui puoi sbloccare un utente che non riesce più ad accedere o
                inviargli l’email per reimpostare la password.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Ruolo</th>
                      <th>Stato</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="fw-semibold">{user.nome || '—'}</td>
                        <td>{user.email || user.username || '—'}</td>
                        <td>{user.ruolo || '—'}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              user.attivo ? 'status-disponibile' : 'status-esaurito'
                            }`}
                          >
                            {user.attivo ? 'Attivo' : 'Bloccato'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className={`btn btn-sm ${user.attivo ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => handleToggleUser(user)}
                              disabled={busyUserId === user.id}
                            >
                              {user.attivo ? 'Blocca' : 'Sblocca'}
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => handlePasswordReset(user)}
                              disabled={busyUserId === user.id}
                            >
                              Reset password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {users.length === 0 && !usersLoading && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted">
                          Nessun utente trovato.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Ripristino accesso amministrativo</h2>
            </div>

            <div className="card-body">
              <p className="text-muted text-sm">
                Da usare solo in emergenza, se in azienda non resta nessun account
                “datore” funzionante. Crea (o ripristina) un account con permessi completi.
              </p>

              <form onSubmit={handleCreateOwner} className="form-row prog-form">
                <label className="form-group">
                  <span className="form-label">Nome completo</span>
                  <input
                    className="form-control"
                    value={ownerForm.fullName}
                    onChange={(event) =>
                      setOwnerForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Email</span>
                  <input
                    className="form-control"
                    type="email"
                    value={ownerForm.email}
                    onChange={(event) =>
                      setOwnerForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Password iniziale</span>
                  <input
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    value={ownerForm.password}
                    onChange={(event) =>
                      setOwnerForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                  />
                </label>

                <button type="submit" className="btn btn-primary" disabled={ownerSaving}>
                  {ownerSaving ? 'Creazione...' : 'Crea datore'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

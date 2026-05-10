import { useEffect, useMemo, useState } from 'react';
import { companyStore } from '../../data/store';
import { useAuth } from '../../App';
import FaIcon from '../../components/FaIcon';

const SUPER_ADMIN_EMAILS = [
  'giulia@gmail.com',
];

const SUBSCRIPTION_STATUSES = [
  { value: 'attivo', label: 'Attivo' },
  { value: 'demo', label: 'Demo' },
  { value: 'sospeso', label: 'Sospeso' },
  { value: 'scaduto', label: 'Scaduto' },
  { value: 'disattivato', label: 'Disattivato' },
];

const PLANS = [
  { value: 'demo', label: 'Demo' },
  { value: 'base', label: 'Base' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canManageCompanies(user) {
  const role = normalizeRole(user?.role);
  const email = String(user?.email || '').trim().toLowerCase();

  return (
    role === 'sviluppatore' ||
    role === 'super_admin' ||
    role === 'admin_tecnico' ||
    SUPER_ADMIN_EMAILS.includes(email)
  );
}

function createEmptyForm() {
  return {
    name: '',
    code: '',
    active: true,
    subscriptionStatus: 'attivo',
    plan: 'pro',
    subscriptionStartDate: new Date().toISOString().slice(0, 10),
    subscriptionEndDate: '',
    maxUsers: '',
    suspensionReason: '',
    notes: '',
  };
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return `${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function isExpired(company) {
  const endDate = company.subscriptionEndDate || company.data_scadenza_abbonamento;

  if (!endDate) return false;

  const end = new Date(`${endDate}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end < new Date();
}

function getCompanyAccessState(company) {
  const status = String(company.subscriptionStatus || company.stato_abbonamento || 'attivo')
    .trim()
    .toLowerCase();

  if (company.active === false || company.attiva === false) {
    return { label: 'Spenta', className: 'status-esaurito' };
  }

  if (status === 'sospeso') {
    return { label: 'Sospesa', className: 'status-sotto_soglia' };
  }

  if (status === 'scaduto' || isExpired(company)) {
    return { label: 'Scaduta', className: 'status-esaurito' };
  }

  if (status === 'demo') {
    return { label: 'Demo', className: 'status-sotto_soglia' };
  }

  if (status === 'disattivato') {
    return { label: 'Disattivata', className: 'status-esaurito' };
  }

  return { label: 'Attiva', className: 'status-disponibile' };
}

export default function GestioneAziende() {
  const { user } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [editingCompany, setEditingCompany] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allowed = canManageCompanies(user);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError('');

      const rows = await companyStore.getAll();
      setCompanies(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Errore caricamento aziende:', err);
      setError(err?.message || 'Errore durante il caricamento delle aziende.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) {
      loadCompanies();
    } else {
      setLoading(false);
    }
  }, [allowed]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return companies;

    return companies.filter((company) => {
      return (
        String(company.name || company.nome || '').toLowerCase().includes(q) ||
        String(company.code || company.codice || '').toLowerCase().includes(q) ||
        String(company.id || '').toLowerCase().includes(q) ||
        String(company.subscriptionStatus || company.stato_abbonamento || '').toLowerCase().includes(q) ||
        String(company.plan || company.piano || '').toLowerCase().includes(q)
      );
    });
  }, [companies, query]);

  const updateForm = (field, value) => {
    setError('');
    setSuccess('');

    if (field === 'code') {
      setForm((current) => ({
        ...current,
        code: String(value || '').toUpperCase().replace(/[^A-Z0-9_-]+/g, ''),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const startEdit = (company) => {
    setEditingCompany(company);
    setForm({
      name: company.name || company.nome || '',
      code: company.code || company.codice || '',
      active: company.active !== false,
      subscriptionStatus: company.subscriptionStatus || company.stato_abbonamento || 'attivo',
      plan: company.plan || company.piano || 'pro',
      subscriptionStartDate: company.subscriptionStartDate || company.data_inizio_abbonamento || '',
      subscriptionEndDate: company.subscriptionEndDate || company.data_scadenza_abbonamento || '',
      maxUsers: company.maxUsers ?? company.max_utenti ?? '',
      suspensionReason: company.suspensionReason || company.sospesa_motivo || '',
      notes: company.notes || company.note || '',
    });
    setSuccess('');
    setError('');
  };

  const resetForm = () => {
    setEditingCompany(null);
    setForm(createEmptyForm());
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Inserisci il nome azienda.');
      return;
    }

    if (!form.code.trim()) {
      setError('Inserisci il codice azienda.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = {
        ...form,
        maxUsers: form.maxUsers === '' ? null : Number(form.maxUsers),
      };

      if (editingCompany?.id) {
        await companyStore.update(editingCompany.id, payload);
        setSuccess('Licenza aziendale aggiornata correttamente.');
      } else {
        await companyStore.create(payload);
        setSuccess('Azienda creata e licenza configurata correttamente.');
      }

      resetForm();
      await loadCompanies();
    } catch (err) {
      console.error('Errore salvataggio azienda:', err);
      setError(err?.message || 'Errore durante il salvataggio dell’azienda.');
    } finally {
      setSaving(false);
    }
  };

  const setQuickStatus = async (company, status) => {
    try {
      setError('');
      setSuccess('');

      const update =
        status === 'spenta'
          ? {
              active: false,
              subscriptionStatus: 'disattivato',
              suspensionReason: 'Accesso disattivato dal pannello programmatore.',
            }
          : status === 'attiva'
            ? {
                active: true,
                subscriptionStatus: 'attivo',
                suspensionReason: '',
              }
            : status === 'sospesa'
              ? {
                  active: true,
                  subscriptionStatus: 'sospeso',
                  suspensionReason: 'Abbonamento sospeso dal pannello programmatore.',
                }
              : {
                  active: true,
                  subscriptionStatus: status,
                };

      await companyStore.update(company.id, update);

      setSuccess('Stato licenza aggiornato.');
      await loadCompanies();
    } catch (err) {
      console.error('Errore cambio stato azienda:', err);
      setError(err?.message || 'Errore durante il cambio stato.');
    }
  };

  if (!allowed) {
    return (
      <div className="animate-slideUp">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <FaIcon name="business" className="ui-title-icon" /> Licenze Aziendali
            </h1>
            <p className="page-subtitle">Area riservata allo sviluppatore</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">
                <FaIcon name="lock" />
              </div>
              <div className="empty-state-title">Accesso non autorizzato</div>
              <div className="empty-state-text">
                Questa sezione è riservata al programmatore o a un super amministratore.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp super-companies-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FaIcon name="business" className="ui-title-icon" /> Licenze Aziendali
          </h1>
          <p className="page-subtitle">
            Crea aziende, assegna codici di accesso e gestisci lo stato degli abbonamenti.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={loadCompanies} disabled={loading}>
          <FaIcon name="sync" className="ui-inline-icon" /> Aggiorna
        </button>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {success && (
        <div className="company-success-message">
          <FaIcon name="check_circle" className="ui-inline-icon" /> {success}
        </div>
      )}

      <div className="license-kpi-grid">
        <div className="license-kpi-card">
          <span>Aziende totali</span>
          <strong>{companies.length}</strong>
        </div>
        <div className="license-kpi-card">
          <span>Attive</span>
          <strong>{companies.filter((c) => getCompanyAccessState(c).label === 'Attiva').length}</strong>
        </div>
        <div className="license-kpi-card">
          <span>Demo</span>
          <strong>{companies.filter((c) => getCompanyAccessState(c).label === 'Demo').length}</strong>
        </div>
        <div className="license-kpi-card danger">
          <span>Bloccate</span>
          <strong>
            {
              companies.filter((c) =>
                ['Spenta', 'Sospesa', 'Scaduta', 'Disattivata'].includes(getCompanyAccessState(c).label)
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              {editingCompany ? 'Modifica licenza' : 'Nuova azienda'}
            </h3>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  Nome azienda <span className="required">*</span>
                </label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Es. Impianti Rossi"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Codice accesso <span className="required">*</span>
                </label>
                <input
                  className="form-control"
                  value={form.code}
                  onChange={(e) => updateForm('code', e.target.value)}
                  placeholder="Es. IMPIANTIROSSI"
                />
                <div className="form-hint">
                  Questo è il codice che l’azienda userà nella prima schermata di login.
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Piano</label>
                  <select
                    className="form-control"
                    value={form.plan}
                    onChange={(e) => updateForm('plan', e.target.value)}
                  >
                    {PLANS.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Stato abbonamento</label>
                  <select
                    className="form-control"
                    value={form.subscriptionStatus}
                    onChange={(e) => updateForm('subscriptionStatus', e.target.value)}
                  >
                    {SUBSCRIPTION_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Inizio abbonamento</label>
                  <input
                    className="form-control"
                    type="date"
                    value={form.subscriptionStartDate}
                    onChange={(e) => updateForm('subscriptionStartDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scadenza abbonamento</label>
                  <input
                    className="form-control"
                    type="date"
                    value={form.subscriptionEndDate}
                    onChange={(e) => updateForm('subscriptionEndDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Numero massimo utenti</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.maxUsers}
                  onChange={(e) => updateForm('maxUsers', e.target.value)}
                  placeholder="Lascia vuoto se illimitato"
                />
              </div>

              <label className="company-active-switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => updateForm('active', e.target.checked)}
                />
                <span>Software attivo per questa azienda</span>
              </label>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Motivo sospensione / blocco</label>
                <textarea
                  className="form-control"
                  value={form.suspensionReason}
                  onChange={(e) => updateForm('suspensionReason', e.target.value)}
                  placeholder="Es. Abbonamento non rinnovato, prova terminata, cliente sospeso..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Note interne</label>
                <textarea
                  className="form-control"
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Note interne sul cliente, contratto, configurazione..."
                  rows={3}
                />
              </div>

              <div className="btn-group" style={{ marginTop: 18 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving
                    ? 'Salvataggio...'
                    : editingCompany
                      ? 'Salva licenza'
                      : 'Crea azienda'}
                </button>

                {editingCompany && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Aziende e abbonamenti</h3>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Cerca azienda</label>
              <input
                className="form-control"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per nome, codice, piano, stato..."
              />
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-title">Caricamento aziende...</div>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FaIcon name="business" />
                </div>
                <div className="empty-state-title">Nessuna azienda trovata</div>
              </div>
            ) : (
              <div className="company-list">
                {filteredCompanies.map((company) => {
                  const accessState = getCompanyAccessState(company);

                  return (
                    <div className="company-list-item" key={company.id}>
                      <div className="company-list-main">
                        <div className="company-list-title">
                          {company.name || company.nome}
                        </div>

                        <div className="company-list-meta">
                          Codice accesso: <strong>{company.code || company.codice}</strong>
                        </div>

                        <div className="company-list-meta">
                          ID: {company.id}
                        </div>

                        <div className="company-list-meta">
                          Piano: <strong>{company.plan || company.piano || 'pro'}</strong>
                        </div>

                        <div className="company-list-meta">
                          Scadenza: {formatDate(company.subscriptionEndDate || company.data_scadenza_abbonamento)}
                        </div>

                        <div className="company-list-meta">
                          Ultimo accesso: {formatDateTime(company.lastAccessAt || company.ultimo_accesso)}
                        </div>

                        {(company.suspensionReason || company.sospesa_motivo) && (
                          <div className="company-list-warning">
                            {company.suspensionReason || company.sospesa_motivo}
                          </div>
                        )}
                      </div>

                      <div className="company-list-actions">
                        <span className={`status-badge ${accessState.className}`}>
                          {accessState.label}
                        </span>

                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(company)}>
                          Modifica
                        </button>

                        <button className="btn btn-sm btn-primary" onClick={() => setQuickStatus(company, 'attiva')}>
                          Attiva
                        </button>

                        <button className="btn btn-sm btn-warning" onClick={() => setQuickStatus(company, 'sospesa')}>
                          Sospendi
                        </button>

                        <button className="btn btn-sm btn-danger" onClick={() => setQuickStatus(company, 'spenta')}>
                          Spegni
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { companyStore } from '../../data/store';
import { authStore } from '../../data/authStore';
import { useAuth } from '../../App';
import FaIcon from '../../components/FaIcon';
import { firebaseAuth } from '../../firebaseClient';

const ADMIN_CREATE_COMPANY_OWNER_URL =
  import.meta.env.VITE_ADMIN_CREATE_COMPANY_OWNER_URL ||
  '/api/admin/create-company-owner';

const SUPER_ADMIN_EMAILS = [
  'giulia@gmail.com',
];

const SUBSCRIPTION_STATUSES = [
  { value: 'attivo', label: 'Attivo' },
  { value: 'sospeso', label: 'Sospeso' },
  { value: 'scaduto', label: 'Scaduto' },
  { value: 'disattivato', label: 'Disattivato' },
];

const PLANS = [
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

function createEmptyOwnerForm() {
  return {
    fullName: '',
    email: '',
    password: '',
  };
}

function createEmptyForm() {
  return {
    name: '',
    code: '',
    active: true,
    subscriptionStatus: 'attivo',
    plan: 'base',
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

function isTechnicalProgrammerCompany(company) {
  const id = String(company?.id || '').trim().toLowerCase();
  const code = String(company?.code || company?.codice || '').trim().toUpperCase();

  return id === 'programmatore' || code === 'PROGRAMMATORE';
}

function formatUserLimit(company) {
  const activeUsers = Number(company?.activeUsers || 0);
  const maxUsers = Number(company?.maxUsers ?? company?.max_utenti ?? 0);

  if (!maxUsers || maxUsers <= 0) {
    return `${activeUsers} / illimitati`;
  }

  return `${activeUsers} / ${maxUsers}`;
}

function getUserLimitClass(company) {
  const activeUsers = Number(company?.activeUsers || 0);
  const maxUsers = Number(company?.maxUsers ?? company?.max_utenti ?? 0);

  if (!maxUsers || maxUsers <= 0) return '';

  if (activeUsers >= maxUsers) return 'danger';

  if (activeUsers >= Math.max(1, Math.floor(maxUsers * 0.8))) {
    return 'warning';
  }

  return '';
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

  if (status === 'disattivato') {
    return { label: 'Disattivata', className: 'status-esaurito' };
  }

  return { label: 'Attiva', className: 'status-disponibile' };
}

const PLAN_MATRIX = [
  {
    feature: 'Dashboard di controllo',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Giacenza / inventario',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Carico e scarico materiale',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Categorie',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Utenti con limite abbonamento',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Notifiche sotto soglia',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Impostazioni prezzi',
    base: true,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Storico movimenti',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Reintegro e rettifica magazzino',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Fatture e archivio documenti',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Fornitori',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Rendicontazione economica',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Storico prezzi',
    base: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Riordino automatico',
    base: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: 'Proposte ordine',
    base: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: 'Inventario fisico',
    base: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: 'Backup sistema',
    base: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: 'Registro modifiche / audit',
    base: false,
    pro: false,
    enterprise: true,
  },
];

function PlanCheck({ value }) {
  return (
    <span className={`plan-check ${value ? 'included' : 'excluded'}`}>
      {value ? '✓' : '—'}
    </span>
  );
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
  const [ownerCompany, setOwnerCompany] = useState(null);
  const [ownerForm, setOwnerForm] = useState(createEmptyOwnerForm());
  const [ownerSaving, setOwnerSaving] = useState(false);

  const allowed = canManageCompanies(user);

  const managedCompanies = useMemo(() => {
    return companies.filter((company) => !isTechnicalProgrammerCompany(company));
  }, [companies]);

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

    if (!q) return managedCompanies;

    return managedCompanies.filter((company) => {
      return (
        String(company.name || company.nome || '').toLowerCase().includes(q) ||
        String(company.code || company.codice || '').toLowerCase().includes(q) ||
        String(company.id || '').toLowerCase().includes(q) ||
        String(company.subscriptionStatus || company.stato_abbonamento || '').toLowerCase().includes(q) ||
        String(company.plan || company.piano || '').toLowerCase().includes(q)
      );
    });
  }, [managedCompanies, query]);

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

      const cleanMaxUsersText = String(form.maxUsers ?? '').trim();
      const cleanMaxUsersNumber = cleanMaxUsersText ? Number(cleanMaxUsersText) : null;

      const payload = {
        ...form,
        maxUsers:
          cleanMaxUsersNumber && Number.isFinite(cleanMaxUsersNumber) && cleanMaxUsersNumber > 0
            ? Math.floor(cleanMaxUsersNumber)
            : null,
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

  const handleDeleteCompany = async (company) => {
    const companyName = company?.name || company?.nome || company?.id;
    const companyCode = company?.code || company?.codice || '';

    if (!company?.id) {
      setError('Azienda non valida.');
      return;
    }

    if (company.id === 'programmatore') {
      setError('L’ambiente programmatore non può essere eliminato.');
      return;
    }

    const firstConfirm = window.confirm(
      `Vuoi davvero eliminare l’azienda "${companyName}"?\n\nQuesta operazione non è una sospensione: l’azienda verrà cancellata.`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `CONFERMA DEFINITIVA\n\nVerranno eliminati anche dati collegati a "${companyName}" (${companyCode}):\n- utenti\n- materiali\n- categorie\n- movimenti\n- notifiche\n- fatture importate\n- log\n- impostazioni\n\nL’operazione non è reversibile. Procedere?`
    );

    if (!secondConfirm) return;

    try {
      setError('');
      setSuccess('');
      setSaving(true);

      await companyStore.delete(company.id);

      setSuccess(`Azienda "${companyName}" eliminata definitivamente.`);
      await loadCompanies();
    } catch (err) {
      console.error('Errore eliminazione azienda:', err);
      setError(err?.message || 'Errore durante eliminazione azienda.');
    } finally {
      setSaving(false);
    }
  };

  const openOwnerCreator = (company) => {
    setOwnerCompany(company);
    setOwnerForm(createEmptyOwnerForm());
    setError('');
    setSuccess('');
  };

  const closeOwnerCreator = () => {
    if (ownerSaving) return;

    setOwnerCompany(null);
    setOwnerForm(createEmptyOwnerForm());
  };

  const updateOwnerForm = (field, value) => {
    setOwnerForm((current) => ({
      ...current,
      [field]: value,
    }));
    setError('');
    setSuccess('');
  };

  const handleCreateOwner = async (e) => {
    e.preventDefault();

    if (!ownerCompany?.id) {
      setError('Seleziona un’azienda valida.');
      return;
    }

    if (!ownerForm.fullName.trim()) {
      setError('Inserisci il nome completo del datore.');
      return;
    }

    if (!ownerForm.email.trim()) {
      setError('Inserisci l’email del datore.');
      return;
    }

    if (!ownerForm.password.trim()) {
      setError('Inserisci una password iniziale.');
      return;
    }

    try {
      setOwnerSaving(true);
      setError('');
      setSuccess('');

      const currentFirebaseUser = firebaseAuth.currentUser;

      if (!currentFirebaseUser) {
        throw new Error('Sessione Firebase non valida. Esci e accedi di nuovo come programmatore.');
      }

      const token = await currentFirebaseUser.getIdToken(true);

      const response = await fetch(ADMIN_CREATE_COMPANY_OWNER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: ownerCompany.id,
          email: ownerForm.email.trim(),
          password: ownerForm.password.trim(),
          fullName: ownerForm.fullName.trim(),
        }),
      });

      const responseText = await response.text();

      let result = null;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = null;
      }

      if (!response.ok || result?.ok === false) {
        throw new Error(
          result?.message ||
            responseText ||
            `Errore creazione datore (${response.status}).`
        );
      }

      setSuccess(
        `Datore creato per ${ownerCompany.name || ownerCompany.nome}. Ora può accedere con il codice azienda ${
          ownerCompany.code || ownerCompany.codice
        }.`
      );

      closeOwnerCreator();
      await loadCompanies();
    } catch (err) {
      console.error('Errore creazione datore:', err);
      setError(err?.message || 'Errore durante la creazione del datore.');
    } finally {
      setOwnerSaving(false);
    }
  };

  const handleEnterCompany = (company) => {
    try {
      companyStore.setSelected(company);
      const currentUser = authStore.getCurrentUser();
      if (currentUser) {
        // Forza l'impostazione dell'azienda ma mantieni il flag programmerMode vero
        currentUser.selectedCompany = { ...company };
        currentUser.programmerMode = true;
        authStore.setCurrentUser(currentUser);
        // Forza un full reload in modo che l'app reinizializzi layout e contesti
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Errore entrata in azienda:', err);
      setError('Impossibile entrare nel contesto aziendale.');
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
          <strong>{managedCompanies.length}</strong>
        </div>
        <div className="license-kpi-card">
          <span>Attive</span>
          <strong>{managedCompanies.filter((c) => getCompanyAccessState(c).label === 'Attiva').length}</strong>
        </div>
        <div className="license-kpi-card danger">
          <span>Bloccate</span>
          <strong>
            {
              managedCompanies.filter((c) =>
                ['Spenta', 'Sospesa', 'Scaduta', 'Disattivata'].includes(getCompanyAccessState(c).label)
              ).length
            }
          </strong>
        </div>
      </div>

      <div className="card plan-matrix-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Confronto piani abbonamento</h3>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              Riepilogo rapido delle funzionalità disponibili per Base, Pro ed Enterprise.
            </p>
          </div>
        </div>

        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="plan-matrix-table-wrap">
            <table className="plan-matrix-table">
              <thead>
                <tr>
                  <th>Funzionalità</th>
                  <th>Base</th>
                  <th>Pro</th>
                  <th>Enterprise</th>
                </tr>
              </thead>

              <tbody>
                {PLAN_MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td><PlanCheck value={row.base} /></td>
                    <td><PlanCheck value={row.pro} /></td>
                    <td><PlanCheck value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  placeholder="Lascia vuoto o 0 se illimitato"
                />
                <div className="form-hint">
                  Se impostato, il datore non potrà creare più utenti attivi di questo limite.
                </div>
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

                        <div className="company-license-grid">
                          <div className="company-license-pill">
                            <span>Piano</span>
                            <strong>{String(company.plan || company.piano || 'base').toUpperCase()}</strong>
                          </div>

                          <div className={`company-license-pill ${getUserLimitClass(company)}`}>
                            <span>Utenti</span>
                            <strong>{formatUserLimit(company)}</strong>
                          </div>

                          <div className="company-license-pill">
                            <span>Scadenza</span>
                            <strong>{formatDate(company.subscriptionEndDate || company.data_scadenza_abbonamento)}</strong>
                          </div>

                          <div className="company-license-pill">
                            <span>Ultimo accesso</span>
                            <strong>{formatDateTime(company.lastAccessAt || company.ultimo_accesso)}</strong>
                          </div>
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

                        <button className="btn btn-sm btn-primary" onClick={() => handleEnterCompany(company)}>
                          <FaIcon name="login" className="ui-inline-icon" /> Entra
                        </button>

                        <button className="btn btn-sm btn-secondary" onClick={() => openOwnerCreator(company)}>
                          Crea datore
                        </button>

                        <button className="btn btn-sm btn-primary" onClick={() => setQuickStatus(company, 'attiva')}>
                          Attiva
                        </button>

                        <button className="btn btn-sm btn-warning" onClick={() => setQuickStatus(company, 'sospesa')}>
                          Sospendi
                        </button>

                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCompany(company)}>
                          Elimina
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
      {ownerCompany && (
        <div className="modal-overlay">
          <div className="modal-content owner-modal">
            <div className="modal-header">
              <div>
                <h2>Crea datore azienda</h2>
                <p className="text-sm text-muted">
                  Primo amministratore per {ownerCompany.name || ownerCompany.nome} · codice accesso{' '}
                  <strong>{ownerCompany.code || ownerCompany.codice}</strong>
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeOwnerCreator}
                disabled={ownerSaving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOwner} className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Nome completo <span className="required">*</span>
                </label>
                <input
                  className="form-control"
                  value={ownerForm.fullName}
                  onChange={(e) => updateOwnerForm('fullName', e.target.value)}
                  placeholder="Es. Mario Rossi"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email datore <span className="required">*</span>
                </label>
                <input
                  className="form-control"
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) => updateOwnerForm('email', e.target.value)}
                  placeholder="datore@azienda.it"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password iniziale <span className="required">*</span>
                </label>
                <input
                  className="form-control"
                  type="password"
                  value={ownerForm.password}
                  onChange={(e) => updateOwnerForm('password', e.target.value)}
                  placeholder="Password temporanea"
                />
                <div className="form-hint">
                  Il datore entrerà con codice azienda, email e questa password.
                </div>
              </div>

              <div className="company-owner-summary">
                <div>
                  <span>Azienda</span>
                  <strong>{ownerCompany.name || ownerCompany.nome}</strong>
                </div>
                <div>
                  <span>ID azienda</span>
                  <strong>{ownerCompany.id}</strong>
                </div>
                <div>
                  <span>Ruolo</span>
                  <strong>DATORE</strong>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: 18 }}>
                <button className="btn btn-primary" type="submit" disabled={ownerSaving}>
                  {ownerSaving ? 'Creazione...' : 'Crea datore'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeOwnerCreator}
                  disabled={ownerSaving}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

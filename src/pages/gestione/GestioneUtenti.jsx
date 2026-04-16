import { useState, useEffect } from 'react';
import { userStore, adminLogStore } from '../../data/store';
import { USER_ROLES } from '../../data/initialData';
import { useAuth } from '../../App';

const EMPTY_FORM = { username: '', password: '', fullName: '', email: '', role: 'operatore' };

export default function GestioneUtenti() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
    try {
      const allUsers = await userStore.getAll();
      setUsers(allUsers);
    } catch (err) {
      console.error('Errore refresh utenti:', err);
    }
  };
  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditItem(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, email: u.email || '', role: u.role });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.fullName.trim() || !form.role) {
      setError('Username, nome completo e ruolo sono obbligatori');
      return;
    }
    if (!editItem && !form.password.trim()) {
      setError('La password è obbligatoria per un nuovo utente');
      return;
    }
    try {
      if (editItem) {
        const updates = { username: form.username, fullName: form.fullName, email: form.email, role: form.role };
        if (form.password.trim()) updates.password = form.password;
        await userStore.update(editItem.id, updates);
        await adminLogStore.create({ action: 'Modifica utente', entity: 'utente', entityId: editItem.id, details: `Utente "${form.fullName}" (${form.username}) modificato — ruolo: ${form.role}`, userId: currentUser.id, userName: currentUser.fullName });
      } else {
        await userStore.create(form);
        await adminLogStore.create({ action: 'Nuovo utente', entity: 'utente', details: `Utente "${form.fullName}" (${form.username}) creato — ruolo: ${form.role}`, userId: currentUser.id, userName: currentUser.fullName });
      }
      await refresh();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) { setConfirmDelete(null); return; }
    try {
      await userStore.delete(u.id);
      await adminLogStore.create({ action: 'Eliminazione utente', entity: 'utente', entityId: u.id, details: `Utente "${u.fullName}" (${u.username}) eliminato`, userId: currentUser.id, userName: currentUser.fullName });
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione utente:', err);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === currentUser.id) return;
    try {
      await userStore.update(u.id, { active: !u.active });
      await adminLogStore.create({ action: u.active ? 'Disattivazione utente' : 'Attivazione utente', entity: 'utente', entityId: u.id, details: `Utente "${u.fullName}" ${u.active ? 'disattivato' : 'attivato'}`, userId: currentUser.id, userName: currentUser.fullName });
      await refresh();
    } catch (err) {
      console.error('Errore toggle stato utente:', err);
    }
  };

  const getRoleLabel = (val) => USER_ROLES.find(r => r.value === val)?.label || val;

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Gestione Utenti</h1>
          <p className="page-subtitle">{users.length} utenti registrati nel sistema</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuovo Utente</button>
      </div>

      {/* Roles Legend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 24px' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="text-sm fw-semibold text-muted">Ruoli disponibili:</span>
            {USER_ROLES.map(r => (
              <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: r.value === 'admin' ? 'var(--danger-500)' : r.value === 'operatore' ? 'var(--success-500)' : r.value === 'segreteria' ? 'var(--primary-500)' : 'var(--warning-500)'
                }}></span>
                <span className="text-sm"><strong>{r.label}</strong>: {r.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>Username</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>Creato il</th>
              <th style={{ width: 160 }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                <td><strong>{u.fullName}</strong></td>
                <td className="text-sm">{u.username}</td>
                <td className="text-sm text-muted">{u.email || '—'}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: u.role === 'admin' ? 'var(--danger-50)' : u.role === 'operatore' ? 'var(--success-50)' : u.role === 'segreteria' ? 'var(--primary-50)' : 'var(--warning-50)',
                    color: u.role === 'admin' ? 'var(--danger-700)' : u.role === 'operatore' ? 'var(--success-700)' : u.role === 'segreteria' ? 'var(--primary-700)' : 'var(--warning-700)',
                  }}>
                    {getRoleLabel(u.role)}
                  </span>
                </td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                    color: u.active ? 'var(--success-600)' : 'var(--gray-400)'
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? 'var(--success-500)' : 'var(--gray-300)' }}></span>
                    {u.active ? 'Attivo' : 'Disattivato'}
                  </span>
                </td>
                <td className="text-sm text-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('it-IT') : '—'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)} title="Modifica">✏️</button>
                    {u.id !== currentUser.id ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => toggleActive(u)} title={u.active ? 'Disattiva' : 'Attiva'}>
                        {u.active ? '🔒' : '🔓'}
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-ghost" disabled title="Impossibile alterare lo stato del proprio account" style={{ opacity: 0.3 }}>
                        🔒
                      </button>
                    )}
                    {u.id !== currentUser.id && (
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => setConfirmDelete(u)} title="Elimina">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editItem ? 'Modifica Utente' : 'Nuovo Utente'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">Nome Completo <span className="required">*</span></label>
                <input type="text" className="form-control" value={form.fullName} onChange={e => updateForm('fullName', e.target.value)} placeholder="Nome e Cognome" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Username <span className="required">*</span></label>
                  <input type="text" className="form-control" value={form.username} onChange={e => updateForm('username', e.target.value)} placeholder="nome.cognome" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password {!editItem && <span className="required">*</span>}</label>
                  <input type="password" className="form-control" value={form.password} onChange={e => updateForm('password', e.target.value)} placeholder={editItem ? 'Lascia vuoto per non cambiare' : 'Imposta password'} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="email@azienda.it" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ruolo <span className="required">*</span></label>
                  <select className="form-control" value={form.role} onChange={e => updateForm('role', e.target.value)}>
                    {USER_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave}>{editItem ? 'Salva Modifiche' : 'Crea Utente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Conferma Eliminazione</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger">🗑️</div>
              <p className="confirm-message">Eliminare l'utente <strong>{confirmDelete.fullName}</strong> ({confirmDelete.username})?<br />Questa azione non può essere annullata.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annulla</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

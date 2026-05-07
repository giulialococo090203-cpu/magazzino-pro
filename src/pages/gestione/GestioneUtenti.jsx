import { useState, useEffect, useMemo } from 'react';
import { userStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import {
  PERMISSIONS,
  groupPermissions,
  getDefaultPermissionsByRole,
  getEffectivePermissions,
  normalizeRole,
} from '../../data/permissions';
import Icon from '../../components/Icon';

const USER_ROLES = [
  {
    value: 'operaio',
    label: 'Operaio',
    description: 'Vede solo la giacenza e il prezzo di listino',
  },
  {
    value: 'segretaria',
    label: 'Segretaria',
    description: 'Gestisce fatture, categorie, soglie, notifiche e movimenti',
  },
  {
    value: 'magazziniere',
    label: 'Magazziniere',
    description: 'Gestisce giacenza, notifiche e movimenti',
  },
  {
    value: 'datore',
    label: 'Datore',
    description: 'Accesso completo a controllo, utenti, log e configurazioni',
  },
];

const EMPTY_FORM = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 'operaio',
  active: true,
  permissions: {},
};

function getRoleVisuals(role) {
  const normalized = normalizeRole(role);

  if (normalized === 'datore') {
    return {
      bg: 'var(--danger-50)',
      color: 'var(--danger-700)',
      dot: 'var(--danger-500)',
      label: 'Datore',
    };
  }

  if (normalized === 'segretaria') {
    return {
      bg: 'var(--primary-50)',
      color: 'var(--primary-700)',
      dot: 'var(--primary-500)',
      label: 'Segretaria',
    };
  }

  if (normalized === 'magazziniere') {
    return {
      bg: 'var(--warning-50)',
      color: 'var(--warning-700)',
      dot: 'var(--warning-500)',
      label: 'Magazziniere',
    };
  }

  return {
    bg: 'var(--success-50)',
    color: 'var(--success-700)',
    dot: 'var(--success-500)',
    label: 'Operaio',
  };
}

function countCustomPermissions(user) {
  const permissions = user?.permissions || {};
  return Object.keys(permissions).filter((key) => permissions[key] !== undefined).length;
}

export default function GestioneUtenti() {
  const { user: currentUser, refreshCurrentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const permissionGroups = useMemo(() => groupPermissions(), []);

  const refresh = async () => {
    try {
      const allUsers = await userStore.getAll();
      setUsers(allUsers);
    } catch (err) {
      console.error('Errore refresh utenti:', err);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const basePermissions = useMemo(() => {
    return getDefaultPermissionsByRole(form.role);
  }, [form.role]);

  const effectiveFormPermissions = useMemo(() => {
    return {
      ...basePermissions,
      ...(form.permissions || {}),
    };
  }, [basePermissions, form.permissions]);

  const openNew = () => {
    setEditItem(null);
    setForm({
      ...EMPTY_FORM,
      role: 'operaio',
      permissions: {},
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditItem(u);
    setForm({
      username: u.username || '',
      password: '',
      fullName: u.fullName || '',
      email: u.email || '',
      role: normalizeRole(u.role),
      active: u.active ?? true,
      permissions: u.permissions || {},
    });
    setError('');
    setShowModal(true);
  };

  const handleRoleChange = (role) => {
    setForm((prev) => ({
      ...prev,
      role: normalizeRole(role),
      permissions: {},
    }));
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (permissionKey) => {
    if (normalizeRole(form.role) === 'datore') return;

    setForm((prev) => {
      const baseValue = Boolean(basePermissions[permissionKey]);
      const currentValue =
        prev.permissions?.[permissionKey] !== undefined
          ? Boolean(prev.permissions[permissionKey])
          : baseValue;

      const nextValue = !currentValue;
      const nextPermissions = { ...(prev.permissions || {}) };

      if (nextValue === baseValue) {
        delete nextPermissions[permissionKey];
      } else {
        nextPermissions[permissionKey] = nextValue;
      }

      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  const resetPermissionsToRole = () => {
    setForm((prev) => ({
      ...prev,
      permissions: {},
    }));
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
      const cleanPermissions =
        normalizeRole(form.role) === 'datore'
          ? {}
          : form.permissions || {};

      if (editItem) {
        const updates = {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          email: form.email?.trim() || null,
          role: normalizeRole(form.role),
          active: form.active,
          permissions: cleanPermissions,
        };

        if (form.password.trim()) {
          updates.password = form.password.trim();
        }

        const updatedUser = await userStore.update(editItem.id, updates);

        if (updatedUser.id === currentUser.id && refreshCurrentUser) {
          refreshCurrentUser(updatedUser);
        }

        await adminLogStore.create({
          action: 'Modifica utente',
          entity: 'utente',
          entityId: editItem.id,
          details: `Utente "${form.fullName}" (${form.username}) modificato — ruolo: ${form.role}, permessi personalizzati: ${Object.keys(cleanPermissions).length}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
        });
      } else {
        await userStore.create({
          username: form.username.trim(),
          password: form.password.trim(),
          fullName: form.fullName.trim(),
          email: form.email?.trim() || null,
          role: normalizeRole(form.role),
          active: true,
          permissions: cleanPermissions,
        });

        await adminLogStore.create({
          action: 'Nuovo utente',
          entity: 'utente',
          details: `Utente "${form.fullName}" (${form.username}) creato — ruolo: ${form.role}, permessi personalizzati: ${Object.keys(cleanPermissions).length}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
        });
      }

      await refresh();
      setShowModal(false);
    } catch (err) {
      console.error('Errore salvataggio utente:', err);
      setError(err.message || 'Errore durante il salvataggio utente');
    }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) {
      setConfirmDelete(null);
      return;
    }

    try {
      await userStore.delete(u.id);

      await adminLogStore.create({
        action: 'Eliminazione utente',
        entity: 'utente',
        entityId: u.id,
        details: `Utente "${u.fullName}" (${u.username}) eliminato`,
        userId: currentUser.id,
        userName: currentUser.fullName,
      });

      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione utente:', err);
      setError(err.message || 'Errore durante l’eliminazione utente');
    }
  };

  const toggleActive = async (u) => {
    if (u.id === currentUser.id) return;

    try {
      await userStore.update(u.id, { active: !u.active });

      await adminLogStore.create({
        action: u.active ? 'Disattivazione utente' : 'Attivazione utente',
        entity: 'utente',
        entityId: u.id,
        details: `Utente "${u.fullName}" ${u.active ? 'disattivato' : 'attivato'}`,
        userId: currentUser.id,
        userName: currentUser.fullName,
      });

      await refresh();
    } catch (err) {
      console.error('Errore toggle stato utente:', err);
      setError(err.message || 'Errore durante cambio stato utente');
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Gestione Utenti</h1>
          <p className="page-subtitle">
            {users.length} utenti registrati nel sistema · permessi personalizzabili per singolo utente
          </p>
        </div>

        <button className="btn btn-primary" onClick={openNew}>
          + Nuovo Utente
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 24px' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="text-sm fw-semibold text-muted">Ruoli base:</span>

            {USER_ROLES.map((r) => {
              const visual = getRoleVisuals(r.value);

              return (
                <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: visual.dot,
                    }}
                  />
                  <span className="text-sm">
                    <strong>{r.label}</strong>: {r.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>Username</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Permessi personalizzati</th>
              <th>Stato</th>
              <th>Creato il</th>
              <th style={{ width: 170 }}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => {
              const visual = getRoleVisuals(u.role);
              const customCount = countCustomPermissions(u);

              return (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                  <td>
                    <strong>{u.fullName}</strong>
                  </td>

                  <td className="text-sm">{u.username}</td>

                  <td className="text-sm text-muted">{u.email || '—'}</td>

                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: visual.bg,
                        color: visual.color,
                      }}
                    >
                      {visual.label}
                    </span>
                  </td>

                  <td>
                    {normalizeRole(u.role) === 'datore' ? (
                      <span className="text-sm text-muted">Accesso completo</span>
                    ) : customCount > 0 ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'var(--primary-50)',
                          color: 'var(--primary-700)',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {customCount} modifiche
                      </span>
                    ) : (
                      <span className="text-sm text-muted">Ruolo base</span>
                    )}
                  </td>

                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: u.active ? 'var(--success-600)' : 'var(--gray-400)',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: u.active ? 'var(--success-500)' : 'var(--gray-300)',
                        }}
                      />
                      {u.active ? 'Attivo' : 'Disattivato'}
                    </span>
                  </td>

                  <td className="text-sm text-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('it-IT') : '—'}
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEdit(u)}
                        title="Modifica"
                      >
                        <Icon name="edit_square" className="ui-inline-icon" aria-hidden="true" />
                      </button>

                      {u.id !== currentUser.id ? (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => toggleActive(u)}
                          title={u.active ? 'Disattiva' : 'Attiva'}
                        >
                          {u.active ? '🔒' : '🔓'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled
                          title="Impossibile alterare lo stato del proprio account"
                          style={{ opacity: 0.3 }}
                        >
                          🔒
                        </button>
                      )}

                      {u.id !== currentUser.id && (
                        <button
                          className="btn btn-sm btn-ghost text-danger"
                          onClick={() => setConfirmDelete(u)}
                          title="Elimina"
                        >
                          <Icon name="delete" className="ui-inline-icon" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">Nessun utente trovato</div>
                    <div className="empty-state-text">Crea il primo utente del sistema</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editItem ? 'Modifica Utente e Permessi' : 'Nuovo Utente'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="login-error" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Nome Completo <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={form.fullName}
                  onChange={(e) => updateForm('fullName', e.target.value)}
                  placeholder="Nome e Cognome"
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    Username <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.username}
                    onChange={(e) => updateForm('username', e.target.value)}
                    placeholder="nome.cognome"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Password {!editItem && <span className="required">*</span>}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    placeholder={editItem ? 'Lascia vuoto per non cambiare' : 'Imposta password'}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    placeholder="email@azienda.it"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Ruolo base <span className="required">*</span>
                  </label>
                  <select
                    className="form-control"
                    value={form.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} — {r.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card" style={{ marginTop: 18 }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Permessi personalizzati</h3>
                    <p className="card-subtitle">
                      Il ruolo dà i permessi base. Qui puoi aggiungere o togliere funzioni a questo singolo utente.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={resetPermissionsToRole}
                    disabled={normalizeRole(form.role) === 'datore'}
                  >
                    Ripristina ruolo base
                  </button>
                </div>

                <div className="card-body">
                  {normalizeRole(form.role) === 'datore' ? (
                    <div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-state-icon">👑</div>
                      <div className="empty-state-title">Il datore ha sempre accesso completo</div>
                      <div className="empty-state-text">
                        Per sicurezza, i permessi principali del datore non vengono limitati.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 16,
                      }}
                    >
                      {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                        <div
                          key={groupName}
                          style={{
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--border-radius-md)',
                            padding: 14,
                            background: 'var(--gray-25)',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 900,
                              marginBottom: 10,
                              color: 'var(--gray-800)',
                            }}
                          >
                            {groupName}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {permissions.map((permission) => {
                              const baseValue = Boolean(basePermissions[permission.key]);
                              const customValue = form.permissions?.[permission.key];
                              const enabled = Boolean(effectiveFormPermissions[permission.key]);
                              const customized = customValue !== undefined;

                              return (
                                <button
                                  key={permission.key}
                                  type="button"
                                  onClick={() => togglePermission(permission.key)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    textAlign: 'left',
                                    padding: 10,
                                    borderRadius: 'var(--border-radius-md)',
                                    border: customized
                                      ? '2px solid var(--primary-300)'
                                      : '1px solid var(--gray-200)',
                                    background: enabled ? '#ffffff' : 'var(--gray-50)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 38,
                                      height: 22,
                                      borderRadius: 999,
                                      background: enabled
                                        ? 'var(--success-500)'
                                        : 'var(--gray-300)',
                                      position: 'relative',
                                      flexShrink: 0,
                                      marginTop: 2,
                                    }}
                                  >
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: 3,
                                        left: enabled ? 19 : 3,
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        transition: 'left 150ms',
                                      }}
                                    />
                                  </span>

                                  <span style={{ flex: 1 }}>
                                    <span
                                      style={{
                                        display: 'block',
                                        fontWeight: 800,
                                        color: enabled
                                          ? 'var(--gray-800)'
                                          : 'var(--gray-500)',
                                      }}
                                    >
                                      {permission.label}
                                    </span>
                                    <span
                                      style={{
                                        display: 'block',
                                        fontSize: 12,
                                        color: 'var(--gray-500)',
                                        marginTop: 2,
                                      }}
                                    >
                                      {permission.description}
                                    </span>
                                    <span
                                      style={{
                                        display: 'block',
                                        fontSize: 11,
                                        marginTop: 4,
                                        color: customized
                                          ? 'var(--primary-700)'
                                          : 'var(--gray-400)',
                                        fontWeight: 800,
                                      }}
                                    >
                                      {customized
                                        ? enabled
                                          ? 'Personalizzato: aggiunto'
                                          : 'Personalizzato: tolto'
                                        : baseValue
                                          ? 'Attivo dal ruolo base'
                                          : 'Non attivo dal ruolo base'}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Annulla
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editItem ? 'Salva Modifiche' : 'Crea Utente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Conferma Eliminazione</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger"><Icon name="delete" className="ui-inline-icon" aria-hidden="true" /></div>
              <p className="confirm-message">
                Eliminare l'utente <strong>{confirmDelete.fullName}</strong> ({confirmDelete.username})?
                <br />
                Questa azione non può essere annullata.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Annulla
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

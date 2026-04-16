import { useState, useEffect } from 'react';
import { categoryStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';

export default function GestioneCategorie() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
    try {
      const cats = await categoryStore.getAll();
      setCategories(cats);
    } catch (err) {
      console.error('Errore refresh categorie:', err);
    }
  };
  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', description: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditItem(cat);
    setForm({ name: cat.name, description: cat.description || '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return; }
    try {
      if (editItem) {
        await categoryStore.update(editItem.id, form);
        await adminLogStore.create({ action: 'Modifica categoria', entity: 'categoria', entityId: editItem.id, details: `Categoria "${form.name}" modificata`, userId: user.id, userName: user.fullName });
      } else {
        await categoryStore.create(form);
        await adminLogStore.create({ action: 'Nuova categoria', entity: 'categoria', details: `Categoria "${form.name}" creata`, userId: user.id, userName: user.fullName });
      }
      await refresh();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (cat) => {
    try {
      await categoryStore.delete(cat.id);
      await adminLogStore.create({ action: 'Eliminazione categoria', entity: 'categoria', entityId: cat.id, details: `Categoria "${cat.name}" eliminata`, userId: user.id, userName: user.fullName });
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione categoria:', err);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏷️ Gestione Categorie</h1>
          <p className="page-subtitle">{categories.length} categorie configurate</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuova Categoria</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome Categoria</th>
              <th>Descrizione</th>
              <th>Data Creazione</th>
              <th style={{ width: 140 }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan="4"><div className="empty-state"><div className="empty-state-icon">🏷️</div><div className="empty-state-title">Nessuna categoria</div></div></td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id}>
                <td><strong>{cat.name}</strong></td>
                <td className="text-muted">{cat.description || '—'}</td>
                <td className="text-sm text-muted">{cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('it-IT') : '—'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(cat)}>✏️ Modifica</button>
                    <button className="btn btn-sm btn-ghost text-danger" onClick={() => setConfirmDelete(cat)}>🗑️</button>
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
              <h3 className="modal-title">{editItem ? 'Modifica Categoria' : 'Nuova Categoria'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <div className="form-group">
                <label className="form-label">Nome Categoria <span className="required">*</span></label>
                <input type="text" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Es: Ferramenta, Elettrico..." autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Descrizione</label>
                <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrizione opzionale..." rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave}>{editItem ? 'Salva Modifiche' : 'Crea Categoria'}</button>
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
              <p className="confirm-message">Sei sicuro di voler eliminare la categoria <strong>"{confirmDelete.name}"</strong>? Questa azione non può essere annullata.</p>
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

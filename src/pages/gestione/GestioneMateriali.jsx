import { useState, useEffect } from 'react';
import { materialStore, categoryStore, unitStore, adminLogStore, movementStore } from '../../data/store';
import { useAuth } from '../../App';

const EMPTY_FORM = {
  code: '', description: '', brand: '', category: '', quantity: '',
  unit: 'pz', minThreshold: '', location: '', supplier: '', notes: ''
};

export default function GestioneMateriali() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
    try {
      const [mats, cats, unts] = await Promise.all([
        materialStore.getAll(),
        categoryStore.getAll(),
        unitStore.getAll()
      ]);
      setMaterials(mats);
      setCategories(cats);
      setUnits(unts);
    } catch (err) {
      console.error('Errore refresh:', err);
    }
  };
  useEffect(() => { refresh(); }, []);

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || id;

  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    return !q || m.code?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q) || m.brand?.toLowerCase().includes(q);
  });

  const openNew = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  };

  const openEdit = (mat) => {
    setEditItem(mat);
    setForm({
      code: mat.code, description: mat.description, brand: mat.brand,
      category: mat.category, quantity: mat.quantity, unit: mat.unit,
      minThreshold: mat.minThreshold, location: mat.location,
      supplier: mat.supplier, notes: mat.notes || ''
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.description.trim() || !form.category) {
      setError('Codice, descrizione e categoria sono obbligatori');
      return;
    }
    try {
      if (editItem) {
        await materialStore.update(editItem.id, {
          ...form,
          minThreshold: Number(form.minThreshold) || 0,
        });
        await adminLogStore.create({ action: 'Modifica materiale', entity: 'materiale', entityId: editItem.id, details: `Materiale "${form.code}" modificato`, userId: user.id, userName: user.fullName });
      } else {
        const created = await materialStore.create({
          ...form,
          quantity: 0,
          minThreshold: Number(form.minThreshold) || 0,
        });
        await adminLogStore.create({ action: 'Nuovo materiale', entity: 'materiale', details: `Materiale "${form.code}" creato`, userId: user.id, userName: user.fullName });
        
        const initialQty = Number(form.quantity) || 0;
        if (initialQty > 0) {
          await movementStore.create({
            materialId: created.id,
            type: 'entrata',
            quantity: initialQty,
            reason: 'altro',
            notes: 'Carico iniziale da anagrafica',
            userId: user.id,
            userName: user.fullName,
          });
        }
      }
      await refresh();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (mat) => {
    try {
      await materialStore.delete(mat.id);
      await adminLogStore.create({ action: 'Eliminazione materiale', entity: 'materiale', entityId: mat.id, details: `Materiale "${mat.code}" eliminato`, userId: user.id, userName: user.fullName });
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione:', err);
    }
  };

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔧 Gestione Materiali</h1>
          <p className="page-subtitle">Anagrafica completa dei materiali — {materials.length} registrati</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuovo Materiale</button>
      </div>

      <div className="filters-row" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <span className="search-bar-icon">🔍</span>
          <input type="text" className="form-control" placeholder="Cerca per codice, descrizione, marca..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Descrizione</th>
              <th>Marca</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'center' }}>Qtà</th>
              <th>UM</th>
              <th>Soglia</th>
              <th>Posizione</th>
              <th>Stato</th>
              <th style={{ width: 130 }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="10"><div className="empty-state"><div className="empty-state-icon">🔧</div><div className="empty-state-title">Nessun materiale trovato</div></div></td></tr>
            ) : filtered.map(m => (
              <tr key={m.id}>
                <td><strong>{m.code}</strong></td>
                <td>{m.description}</td>
                <td className="text-sm">{m.brand}</td>
                <td className="text-sm">{getCategoryName(m.category)}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{m.quantity}</td>
                <td className="text-muted">{m.unit}</td>
                <td className="text-muted">{m.minThreshold}</td>
                <td className="text-sm">{m.location}</td>
                <td>
                  <span className={`status-badge status-${m.status}`}>
                    {m.status === 'disponibile' ? 'Disponibile' : m.status === 'sotto_soglia' ? 'Sotto soglia' : 'Esaurito'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(m)}>✏️</button>
                    <button className="btn btn-sm btn-ghost text-danger" onClick={() => setConfirmDelete(m)}>🗑️</button>
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
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editItem ? 'Modifica Materiale' : 'Nuovo Materiale'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Codice <span className="required">*</span></label>
                  <input type="text" className="form-control" value={form.code} onChange={e => updateForm('code', e.target.value)} placeholder="Es: FER-001" disabled={!!editItem} />
                </div>
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input type="text" className="form-control" value={form.brand} onChange={e => updateForm('brand', e.target.value)} placeholder="Es: Fischer, Bosch..." />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrizione <span className="required">*</span></label>
                <input type="text" className="form-control" value={form.description} onChange={e => updateForm('description', e.target.value)} placeholder="Descrizione completa del materiale" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categoria <span className="required">*</span></label>
                  <select className="form-control" value={form.category} onChange={e => updateForm('category', e.target.value)}>
                    <option value="">-- Seleziona --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unità di Misura</label>
                  <select className="form-control" value={form.unit} onChange={e => updateForm('unit', e.target.value)}>
                    {units.map(u => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{editItem ? 'Quantità Attuale' : 'Quantità Iniziale'}</label>
                  <input type="number" className="form-control" value={form.quantity} onChange={e => updateForm('quantity', e.target.value)} placeholder="0" min="0" disabled={!!editItem} title={editItem ? 'Usa la funzione Rettifica per modificare la giacenza' : ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Soglia Minima</label>
                  <input type="number" className="form-control" value={form.minThreshold} onChange={e => updateForm('minThreshold', e.target.value)} placeholder="0" min="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Posizione / Scaffale</label>
                  <input type="text" className="form-control" value={form.location} onChange={e => updateForm('location', e.target.value)} placeholder="Es: A1-01, Scaffale B2..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Fornitore</label>
                  <input type="text" className="form-control" value={form.supplier} onChange={e => updateForm('supplier', e.target.value)} placeholder="Nome fornitore" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <textarea className="form-control" value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Note opzionali..." rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={handleSave}>{editItem ? 'Salva Modifiche' : 'Crea Materiale'}</button>
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
              <p className="confirm-message">Eliminare il materiale <strong>{confirmDelete.code} — {confirmDelete.description}</strong>?<br />Questa azione non può essere annullata.</p>
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

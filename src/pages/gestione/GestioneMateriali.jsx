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
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [isNewCat, setIsNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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
    setIsNewCat(false);
    setNewCatName('');
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
    setIsNewCat(false);
    setNewCatName('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      setError('Codice e descrizione sono obbligatori');
      return;
    }
    if (isNewCat && !newCatName.trim()) {
      setError('Inserisci il nome della nuova categoria');
      return;
    }
    if (!isNewCat && !form.category) {
      setError('Seleziona una categoria');
      return;
    }

    try {
      let categoryId = form.category;
      
      // Se è una nuova categoria, creiamola prima
      if (isNewCat) {
        const newCat = await categoryStore.create({ name: newCatName.trim(), description: 'Creata durante inserimento materiale' });
        categoryId = newCat.id;
      }

      if (editItem) {
        await materialStore.update(editItem.id, {
          ...form,
          category: categoryId,
          minThreshold: Number(form.minThreshold) || 0,
        });
        await adminLogStore.create({ action: 'Modifica materiale', entity: 'materiale', entityId: editItem.id, details: `Materiale "${form.code}" modificato`, userId: user.id, userName: user.fullName });
      } else {
        const created = await materialStore.create({
          ...form,
          category: categoryId,
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

  const handleEmpty = async () => {
    try {
      await materialStore.deleteAll();
      await adminLogStore.create({ action: 'Svuotamento anagrafica', entity: 'magazzino', details: `Tutti i materiali e i movimenti sono stati eliminati dall'utente.`, userId: user.id, userName: user.fullName });
      setConfirmEmpty(false);
      await refresh();
    } catch (err) {
      console.error('Errore svuotamento:', err);
      setError('Errore durante lo svuotamento: ' + err.message);
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
        <div className="btn-group">
          <button className="btn btn-secondary text-danger" onClick={() => setConfirmEmpty(true)}>🗑️ Svuota Anagrafica</button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuovo Materiale</button>
        </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Categoria <span className="required">*</span></label>
                    <label style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary-600)' }}>
                      <input type="checkbox" checked={isNewCat} onChange={e => setIsNewCat(e.target.checked)} />
                      + Nuova
                    </label>
                  </div>
                  {isNewCat ? (
                    <input type="text" className="form-control" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome nuova categoria..." autoFocus />
                  ) : (
                    <select className="form-control" value={form.category} onChange={e => updateForm('category', e.target.value)}>
                      <option value="">-- Seleziona --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
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

      {/* Confirm Empty All */}
      {confirmEmpty && (
        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmEmpty(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Svuota Magazzino COMPLETAMENTE</h3>
              <button className="modal-close" onClick={() => setConfirmEmpty(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger">💥</div>
              <p className="confirm-message">
                <strong>ATTENZIONE!</strong><br />
                Stai per eliminare <strong>TUTTI</strong> i materiali, i movimenti e le notifiche.<br />
                Questa azione è assolutamente distruttiva e irreversibile.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmEmpty(false)}>Annulla</button>
              <button className="btn btn-danger" onClick={handleEmpty}>SÌ, SVUOTA TUTTO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

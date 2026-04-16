import { useState, useEffect } from 'react';
import { materialStore, categoryStore, unitStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';

export default function Soglie() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [editId, setEditId] = useState(null);
  const [editThreshold, setEditThreshold] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [success, setSuccess] = useState('');

  // Unit management
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

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
      console.error('Errore refresh soglie:', err);
    }
  };
  useEffect(() => { refresh(); }, []);

  const getCatName = (id) => categories.find(c => c.id === id)?.name || id;

  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.code?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
    const matchCat = !filterCat || m.category === filterCat;
    return matchSearch && matchCat;
  });

  const startEdit = (mat) => {
    setEditId(mat.id);
    setEditThreshold(String(mat.minThreshold));
    setEditUnit(mat.unit);
  };

  const saveEdit = async (mat) => {
    try {
      await materialStore.update(mat.id, {
        minThreshold: Number(editThreshold) || 0,
        unit: editUnit,
      });
      await adminLogStore.create({
        action: 'Modifica soglia',
        entity: 'materiale',
        entityId: mat.id,
        details: `Materiale "${mat.code}" — soglia aggiornata a ${Number(editThreshold) || 0}, unità: ${editUnit}`,
        userId: user.id,
        userName: user.fullName
      });
      setEditId(null);
      setSuccess(`Soglia aggiornata per ${mat.code}`);
      setTimeout(() => setSuccess(''), 3000);
      await refresh();
    } catch (err) {
      console.error('Errore salvataggio soglia:', err);
    }
  };

  const addUnit = async () => {
    if (!newUnitName.trim() || !newUnitAbbr.trim()) return;
    try {
      await unitStore.create({ name: newUnitName, abbreviation: newUnitAbbr });
      await adminLogStore.create({ action: 'Nuova unità', entity: 'categoria', details: `Unità di misura "${newUnitName}" (${newUnitAbbr}) creata`, userId: user.id, userName: user.fullName });
      setNewUnitName('');
      setNewUnitAbbr('');
      setShowUnitModal(false);
      await refresh();
    } catch (err) {
      console.error('Errore creazione unità:', err);
    }
  };

  const deleteUnit = async (u) => {
    try {
      await unitStore.delete(u.id);
      await adminLogStore.create({ action: 'Eliminazione unità', entity: 'categoria', details: `Unità di misura "${u.name}" eliminata`, userId: user.id, userName: user.fullName });
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione unità:', err);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Soglie e Unità di Misura</h1>
          <p className="page-subtitle">Gestisci le soglie minime per ogni materiale e le unità di misura</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUnitModal(true)}>+ Nuova Unità di Misura</button>
      </div>

      {success && (
        <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-100)', color: 'var(--success-700)', padding: '12px 20px', borderRadius: 'var(--border-radius-md)', marginBottom: 16, fontWeight: 600 }}>
          ✅ {success}
        </div>
      )}

      {/* Units section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">📏 Unità di Misura Configurate</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {units.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                borderRadius: 'var(--border-radius-md)', padding: '8px 14px'
              }}>
                <strong>{u.abbreviation}</strong>
                <span className="text-sm text-muted">{u.name}</span>
                <button className="btn btn-sm btn-ghost text-danger" onClick={() => deleteUnit(u)} style={{ padding: 2, fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Thresholds table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 Soglie Minime per Materiale</h3>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filters-row">
            <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
              <span className="search-bar-icon">🔍</span>
              <input type="text" className="form-control" placeholder="Cerca materiale..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
            </div>
            <div className="filter-group">
              <label>Categoria:</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'center' }}>Qtà Attuale</th>
                  <th style={{ textAlign: 'center' }}>Soglia Minima</th>
                  <th>Unità</th>
                  <th>Stato</th>
                  <th style={{ width: 120 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.code}</strong></td>
                    <td className="text-sm">{m.description}</td>
                    <td className="text-sm">{getCatName(m.category)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: m.quantity === 0 ? 'var(--danger-600)' : m.quantity <= m.minThreshold ? 'var(--warning-600)' : 'var(--gray-800)' }}>{m.quantity}</td>
                    <td style={{ textAlign: 'center' }}>
                      {editId === m.id ? (
                        <input type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} className="form-control" style={{ width: 80, padding: '6px 8px', textAlign: 'center', display: 'inline-block' }} min="0" autoFocus />
                      ) : (
                        <strong>{m.minThreshold}</strong>
                      )}
                    </td>
                    <td>
                      {editId === m.id ? (
                        <select value={editUnit} onChange={e => setEditUnit(e.target.value)} className="form-control" style={{ width: 80, padding: '6px 8px', display: 'inline-block' }}>
                          {units.map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted">{m.unit}</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${m.status}`}>
                        {m.status === 'disponibile' ? 'Disponibile' : m.status === 'sotto_soglia' ? 'Sotto soglia' : 'Esaurito'}
                      </span>
                    </td>
                    <td>
                      {editId === m.id ? (
                        <div className="table-actions">
                          <button className="btn btn-sm btn-success" onClick={() => saveEdit(m)}>✓</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(m)}>✏️ Modifica</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Unit Modal */}
      {showUnitModal && (
        <div className="modal-overlay" onClick={() => setShowUnitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nuova Unità di Misura</h3>
              <button className="modal-close" onClick={() => setShowUnitModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nome <span className="required">*</span></label>
                <input type="text" className="form-control" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="Es: Metro lineare" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Abbreviazione <span className="required">*</span></label>
                <input type="text" className="form-control" value={newUnitAbbr} onChange={e => setNewUnitAbbr(e.target.value)} placeholder="Es: ml" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUnitModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={addUnit}>Crea Unità</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

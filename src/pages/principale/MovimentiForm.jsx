import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { materialStore, categoryStore, movementStore } from '../../data/store';
import { MOVEMENT_REASONS } from '../../data/initialData';
import { useAuth } from '../../App';

const TIPO_CONFIG = {
  entrata: {
    title: 'Carica Materiale',
    subtitle: 'Registra un nuovo ingresso di materiale in magazzino',
    icon: '📥',
    color: 'var(--success-600)',
    btnLabel: 'Conferma Carico',
    btnClass: 'btn-success',
    successMsg: 'Materiale caricato con successo!'
  },
  uscita: {
    title: 'Scarica Materiale',
    subtitle: 'Registra un\'uscita di materiale dal magazzino',
    icon: '📤',
    color: 'var(--danger-600)',
    btnLabel: 'Conferma Scarico',
    btnClass: 'btn-danger',
    successMsg: 'Materiale scaricato con successo!'
  },
  reintegro: {
    title: 'Reintegra Materiale',
    subtitle: 'Rientra materiale precedentemente uscito e non utilizzato',
    icon: '🔄',
    color: 'var(--info-600)',
    btnLabel: 'Conferma Reintegro',
    btnClass: 'btn-primary',
    successMsg: 'Materiale reintegrato con successo!'
  },
  rettifica: {
    title: 'Rettifica Inventario',
    subtitle: 'Correggi la quantità a seguito di controllo inventariale',
    icon: '✏️',
    color: 'var(--warning-600)',
    btnLabel: 'Conferma Rettifica',
    btnClass: 'btn-warning',
    successMsg: 'Rettifica registrata con successo!'
  },
};

export default function MovimentiForm() {
  const { tipo } = useParams();
  const { user } = useAuth();
  const config = TIPO_CONFIG[tipo] || TIPO_CONFIG.entrata;

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [searchMat, setSearchMat] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [mats, cats] = await Promise.all([
          materialStore.getAll(),
          categoryStore.getAll()
        ]);
        setMaterials(mats);
        setCategories(cats);
        setSelectedMaterial('');
        setQuantity('');
        setReason('');
        setNotes('');
        setSuccess('');
        setError('');
      } catch (err) {
        console.error('Errore caricamento dati:', err);
      }
    }
    loadData();
  }, [tipo]);

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || id;
  const material = materials.find(m => m.id === selectedMaterial);

  const filteredMaterials = materials.filter(m => {
    const matchCat = !filterCat || m.category === filterCat;
    const q = searchMat.toLowerCase();
    const matchSearch = !q ||
      m.code?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handleSubmit = () => {
    setError('');
    if (!selectedMaterial) { setError('Seleziona un materiale'); return; }
    if (!quantity || Number(quantity) <= 0) { setError('Inserisci una quantità valida'); return; }
    if (!reason) { setError('Seleziona un motivo'); return; }

    if (tipo === 'uscita' && material && Number(quantity) > material.quantity) {
      setError(`Quantità insufficiente! Disponibilità attuale: ${material.quantity} ${material.unit}`);
      return;
    }

    setShowConfirm(true);
  };

  const confirmMovement = async () => {
    try {
      await movementStore.create({
        materialId: selectedMaterial,
        type: tipo,
        quantity: Number(quantity),
        reason,
        notes,
        userId: user.id,
        userName: user.fullName,
      });

      setSuccess(config.successMsg);
      setShowConfirm(false);
      
      const updatedMats = await materialStore.getAll();
      setMaterials(updatedMats);

      // Reset form after delay
      setTimeout(() => {
        setSelectedMaterial('');
        setQuantity('');
        setReason('');
        setNotes('');
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message);
      setShowConfirm(false);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{config.icon}</span>
            {config.title}
          </h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
      </div>

      {success && (
        <div style={{
          background: 'var(--success-50)',
          border: '1px solid var(--success-100)',
          color: 'var(--success-700)',
          padding: '14px 20px',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: 20,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ✅ {success}
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--danger-50)',
          border: '1px solid var(--danger-100)',
          color: 'var(--danger-700)',
          padding: '14px 20px',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: 20,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="grid-2">
        {/* Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Dati Movimento</h3>
          </div>
          <div className="card-body">
            {/* Filtro categoria */}
            <div className="form-group">
              <label className="form-label">Filtra per Categoria</label>
              <select className="form-control" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Tutte le categorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Ricerca materiale */}
            <div className="form-group">
              <label className="form-label">Cerca Materiale</label>
              <input
                type="text"
                className="form-control"
                placeholder="Cerca per codice o descrizione..."
                value={searchMat}
                onChange={e => setSearchMat(e.target.value)}
              />
            </div>

            {/* Selezione materiale */}
            <div className="form-group">
              <label className="form-label">Materiale <span className="required">*</span></label>
              <select
                className="form-control"
                value={selectedMaterial}
                onChange={e => setSelectedMaterial(e.target.value)}
              >
                <option value="">-- Seleziona materiale --</option>
                {filteredMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.description} ({m.quantity} {m.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantità */}
            <div className="form-group">
              <label className="form-label">
                {tipo === 'rettifica' ? 'Nuova Quantità' : 'Quantità'} <span className="required">*</span>
              </label>
              <input
                type="number"
                className="form-control"
                placeholder={tipo === 'rettifica' ? 'Inserisci la quantità corretta' : 'Inserisci la quantità'}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0"
                step="1"
              />
              {material && tipo !== 'rettifica' && (
                <div className="form-hint">
                  Disponibilità attuale: <strong>{material.quantity} {material.unit}</strong>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="form-group">
              <label className="form-label">Motivo <span className="required">*</span></label>
              <select className="form-control" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="">-- Seleziona motivo --</option>
                {MOVEMENT_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div className="form-group">
              <label className="form-label">Note (opzionale)</label>
              <textarea
                className="form-control"
                placeholder="Aggiungi note al movimento..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <button
              className={`btn ${config.btnClass} btn-lg w-full`}
              onClick={handleSubmit}
              style={{ marginTop: 8 }}
            >
              {config.icon} {config.btnLabel}
            </button>
          </div>
        </div>

        {/* Preview / Riepilogo */}
        <div>
          {material ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📦 Materiale Selezionato</h3>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 16 }}>
                  <div className="text-sm text-muted fw-semibold">Codice</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{material.code}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="text-sm text-muted fw-semibold">Descrizione</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{material.description}</div>
                </div>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Marca</div>
                    <div>{material.brand}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Categoria</div>
                    <div>{getCategoryName(material.category)}</div>
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Posizione</div>
                    <div>{material.location}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Fornitore</div>
                    <div>{material.supplier}</div>
                  </div>
                </div>
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: 20,
                  textAlign: 'center',
                  marginTop: 8
                }}>
                  <div className="text-sm text-muted fw-semibold mb-2">Disponibilità Attuale</div>
                  <div style={{
                    fontSize: 40,
                    fontWeight: 800,
                    color: material.quantity === 0 ? 'var(--danger-600)' : material.quantity <= material.minThreshold ? 'var(--warning-600)' : 'var(--primary-700)'
                  }}>
                    {material.quantity}
                  </div>
                  <div className="text-sm text-muted">{material.unit} · soglia minima: {material.minThreshold}</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`status-badge status-${material.status}`}>
                      {material.status === 'disponibile' ? 'Disponibile' : material.status === 'sotto_soglia' ? 'Sotto soglia' : 'Esaurito'}
                    </span>
                  </div>
                </div>

                {quantity && Number(quantity) >= 0 && (
                  <div style={{
                    background: tipo === 'rettifica' ? 'var(--warning-50)' : (tipo === 'uscita' ? 'var(--danger-50)' : 'var(--success-50)'),
                    borderRadius: 'var(--border-radius-md)',
                    padding: 16,
                    textAlign: 'center',
                    marginTop: 12,
                    border: `1px solid ${tipo === 'rettifica' ? 'var(--warning-100)' : (tipo === 'uscita' ? 'var(--danger-100)' : 'var(--success-100)')}`
                  }}>
                    <div className="text-sm fw-semibold" style={{ color: tipo === 'rettifica' ? 'var(--warning-700)' : (tipo === 'uscita' ? 'var(--danger-700)' : 'var(--success-700)') }}>
                      Quantità dopo l'operazione
                    </div>
                    <div style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: tipo === 'rettifica' ? 'var(--warning-700)' : (tipo === 'uscita' ? 'var(--danger-700)' : 'var(--success-700)')
                    }}>
                      {tipo === 'rettifica'
                        ? Number(quantity)
                        : tipo === 'uscita'
                          ? material.quantity - Number(quantity)
                          : material.quantity + Number(quantity)
                      } {material.unit}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">Seleziona un materiale</div>
                  <div className="empty-state-text">
                    Scegli un materiale dall'elenco a sinistra per visualizzarne i dettagli e registrare il movimento
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && material && (
        <div className="modal-overlay confirm-dialog" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Conferma Operazione</h3>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className={`confirm-icon ${tipo === 'uscita' ? 'danger' : 'warning'}`}>
                {config.icon}
              </div>
              <p className="confirm-message" style={{ marginBottom: 20 }}>
                Stai per registrare {tipo === 'rettifica' ? 'una rettifica' : (tipo === 'uscita' ? "un'uscita" : tipo === 'reintegro' ? 'un reintegro' : "un'entrata")} di:
              </p>
              <div style={{
                background: 'var(--gray-50)',
                borderRadius: 'var(--border-radius-md)',
                padding: 20,
                marginBottom: 16
              }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{material.code} — {material.description}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: config.color, marginTop: 8 }}>
                  {tipo === 'rettifica' ? 'Nuova qtà: ' : ''}{quantity} {material.unit}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Annulla</button>
              <button className={`btn ${config.btnClass}`} onClick={confirmMovement}>
                ✓ Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

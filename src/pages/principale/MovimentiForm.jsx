import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { materialStore, categoryStore, movementStore } from '../../data/store';
import { MOVEMENT_REASONS } from '../../data/initialData';
import { useAuth } from '../../App';
import FaIcon from '../../components/FaIcon';

const TIPO_CONFIG = {
  entrata: {
    title: 'Carica Materiale',
    subtitle: 'Registra un nuovo ingresso di materiale in magazzino',
    icon: 'entrata',
    color: 'var(--success-600)',
    btnLabel: 'Conferma Carico',
    btnClass: 'btn-success',
    successMsg: 'Materiale caricato con successo!'
  },
  uscita: {
    title: 'Scarica Materiale',
    subtitle: "Registra un'uscita di materiale dal magazzino",
    icon: 'uscita',
    color: 'var(--danger-600)',
    btnLabel: 'Conferma Scarico',
    btnClass: 'btn-danger',
    successMsg: 'Materiale scaricato con successo!'
  },
  reintegro: {
    title: 'Reintegra Materiale',
    subtitle: 'Rientra materiale precedentemente uscito e non utilizzato',
    icon: 'reintegro',
    color: 'var(--info-600)',
    btnLabel: 'Conferma Reintegro',
    btnClass: 'btn-primary',
    successMsg: 'Materiale reintegrato con successo!'
  },
  rettifica: {
    title: 'Rettifica Inventario',
    subtitle: 'Correggi la quantità a seguito di controllo inventariale',
    icon: 'rettifica',
    color: 'var(--warning-600)',
    btnLabel: 'Conferma Rettifica',
    btnClass: 'btn-warning',
    successMsg: 'Rettifica registrata con successo!'
  }
};

const MOVEMENT_ICON_LABELS = {
  entrata: '↧',
  uscita: '↥',
  reintegro: '↻',
  rettifica: '✎',
};

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canManageMovements(role) {
  return ['segretaria', 'segreteria', 'magazziniere', 'datore', 'admin'].includes(
    normalizeRole(role)
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getMaterialCode(material) {
  return material?.code || material?.codice || '';
}

function getMaterialName(material) {
  return material?.name || material?.nome || material?.description || material?.descrizione || '';
}

function getMaterialDescription(material) {
  return material?.description || material?.descrizione || material?.name || material?.nome || '';
}

function materialMatchesSearch(material, query) {
  const q = normalizeSearchText(query);

  if (!q) return true;

  const searchable = [
    material?.code,
    material?.codice,
    material?.name,
    material?.nome,
    material?.description,
    material?.descrizione,
    material?.brand,
    material?.marca
  ]
    .map(normalizeSearchText)
    .join(' ');

  return searchable.includes(q);
}

function formatNowDateTime() {
  return new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MovimentiForm() {
  const { tipo } = useParams();
  const { user } = useAuth();
  const config = TIPO_CONFIG[tipo] || TIPO_CONFIG.entrata;

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [searchMat, setSearchMat] = useState('');
  const [clientName, setClientName] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef(null);

  const canUsePage = canManageMovements(user?.role);

  useEffect(() => {
    async function loadData() {
      try {
        const [mats, cats] = await Promise.all([
          materialStore.getAll(),
          categoryStore.getAll()
        ]);

        setMaterials(Array.isArray(mats) ? mats : []);
        setCategories(Array.isArray(cats) ? cats : []);
        setSelectedMaterial('');
        setQuantity('');
        setReason('');
        setCustomReason('');
        setNotes('');
        setClientName('');
        setAuthorizedBy('');
        setOperatorName('');
        setSuccess('');
        setError('');
        setSearchMat('');
        setShowSuggestions(false);
      } catch (err) {
        console.error('Errore caricamento dati:', err);
        setError('Errore durante il caricamento dei dati.');
      }
    }

    loadData();
  }, [tipo]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  const material = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterial);
  }, [materials, selectedMaterial]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat = !filterCat || m.category === filterCat;
      const matchSearch = materialMatchesSearch(m, searchMat);
      return matchCat && matchSearch;
    });
  }, [materials, filterCat, searchMat]);

  const suggestions = useMemo(() => {
    const q = normalizeSearchText(searchMat);

    if (!q) return [];

    return materials
      .filter((m) => {
        const matchCat = !filterCat || m.category === filterCat;
        return matchCat && materialMatchesSearch(m, q);
      })
      .sort((a, b) => {
        const aCode = normalizeSearchText(getMaterialCode(a));
        const bCode = normalizeSearchText(getMaterialCode(b));
        const aName = normalizeSearchText(getMaterialName(a));
        const bName = normalizeSearchText(getMaterialName(b));
        const aDescription = normalizeSearchText(getMaterialDescription(a));
        const bDescription = normalizeSearchText(getMaterialDescription(b));

        const aStarts =
          aCode.startsWith(q) ||
          aName.startsWith(q) ||
          aDescription.startsWith(q);

        const bStarts =
          bCode.startsWith(q) ||
          bName.startsWith(q) ||
          bDescription.startsWith(q);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return aName.localeCompare(bName);
      })
      .slice(0, 10);
  }, [searchMat, materials, filterCat]);

  const selectedMaterialLabel = material
    ? `${getMaterialCode(material)} — ${getMaterialDescription(material)}`
    : '';

  const finalReason = reason === 'altro' ? customReason.trim() : reason;

  const resetFormAfterSuccess = () => {
    setSelectedMaterial('');
    setQuantity('');
    setReason('');
    setCustomReason('');
    setNotes('');
    setClientName('');
    setAuthorizedBy('');
    setOperatorName('');
    setSearchMat('');
    setSuccess('');
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    setError('');

    if (!canUsePage) {
      setError('Non hai i permessi per registrare movimenti di magazzino.');
      return;
    }

    if (!selectedMaterial) {
      setError('Seleziona un materiale.');
      return;
    }

    if (!quantity || Number(quantity) < 0 || (tipo !== 'rettifica' && Number(quantity) === 0)) {
      setError('Inserisci una quantità valida.');
      return;
    }

    if (!reason) {
      setError('Seleziona una motivazione.');
      return;
    }

    if (reason === 'altro' && !customReason.trim()) {
      setError('Scrivi la motivazione manuale.');
      return;
    }

    if (!operatorName.trim()) {
      setError('Inserisci il nome dell’operatore.');
      return;
    }

    if (tipo === 'uscita' && material && Number(quantity) > Number(material.quantity || 0)) {
      setError(`Quantità insufficiente! Disponibilità attuale: ${material.quantity} ${material.unit}`);
      return;
    }

    setShowConfirm(true);
  };

  const confirmMovement = async () => {
    try {
      if (!canUsePage) {
        setError('Non hai i permessi per registrare movimenti di magazzino.');
        setShowConfirm(false);
        return;
      }

      await movementStore.create({
        materialId: selectedMaterial,
        type: tipo,
        quantity: Number(quantity),
        reason: finalReason,
        notes,
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
        operatorName: operatorName.trim(),
        clientName,
        authorizedBy
      });

      setSuccess(config.successMsg);
      setShowConfirm(false);

      const updatedMats = await materialStore.getAll();
      setMaterials(Array.isArray(updatedMats) ? updatedMats : []);

      setTimeout(resetFormAfterSuccess, 2500);
    } catch (err) {
      setError(err?.message || 'Errore durante il salvataggio del movimento.');
      setShowConfirm(false);
    }
  };

  return (
      <div className="animate-slideUp">
        <div className="page-header">
          <div>
            <h1 className="page-title">
            <span className="ui-title-icon fa-title-icon" aria-hidden="true">
              <FaIcon name={config.icon} />
            </span>
            {config.title}
          </h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
      </div>

      {success && (
        <div
          style={{
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
          }}
        >
          <FaIcon name="check_circle" className="ui-inline-icon" /> {success}
        </div>
      )}

      {error && (
        <div
          style={{
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
          }}
        >
          <FaIcon name="warning" className="ui-inline-icon" /> {error}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Dati Movimento</h3>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Data movimento</label>
              <input type="text" className="form-control" value={formatNowDateTime()} readOnly />
              <div className="form-hint">La data viene registrata automaticamente al momento del salvataggio.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Filtra per Categoria</label>
              <select className="form-control" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                <option value="">Tutte le categorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" ref={searchWrapRef} style={{ position: 'relative' }}>
              <label className="form-label">Cerca Materiale <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Cerca per codice, nome o descrizione..."
                value={searchMat}
                onChange={(e) => {
                  setSearchMat(e.target.value);
                  setSelectedMaterial('');
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: '#fff',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--border-radius-md)',
                    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                    maxHeight: 300,
                    overflowY: 'auto'
                  }}
                >
                  {suggestions.map((item) => {
                    const code = getMaterialCode(item);
                    const name = getMaterialName(item);
                    const description = getMaterialDescription(item);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedMaterial(item.id);
                          setSearchMat(`${code} — ${description}`);
                          setShowSuggestions(false);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          padding: '12px 14px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--gray-100)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <strong>{code || 'Senza codice'}</strong>
                          <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                            {item.quantity ?? 0} {item.unit || ''}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 2 }}>
                          {name || description || 'Materiale senza descrizione'}
                        </div>

                        {description && description !== name && (
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {description}
                          </div>
                        )}

                        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                          {item.brand || '—'} · {getCategoryName(item.category)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Materiale selezionato</label>
              <select
                className="form-control"
                value={selectedMaterial}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMaterial(val);
                  const found = materials.find((m) => m.id === val);

                  if (found) {
                    setSearchMat(`${getMaterialCode(found)} — ${getMaterialDescription(found)}`);
                  }
                }}
              >
                <option value="">-- Seleziona materiale --</option>
                {filteredMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getMaterialCode(m)} — {getMaterialDescription(m)} ({m.quantity} {m.unit})
                  </option>
                ))}
              </select>
              {selectedMaterialLabel && (
                <div className="form-hint">
                  Selezionato: <strong>{selectedMaterialLabel}</strong>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  {tipo === 'rettifica' ? 'Nuova Quantità' : 'Quantità'} <span className="required">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder={tipo === 'rettifica' ? 'Inserisci la quantità corretta' : 'Inserisci la quantità'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  step="1"
                />
                {material && tipo !== 'rettifica' && (
                  <div className="form-hint">
                    Disponibilità attuale: <strong>{material.quantity} {material.unit}</strong>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Motivazione <span className="required">*</span></label>
                <select
                  className="form-control"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value !== 'altro') setCustomReason('');
                  }}
                >
                  <option value="">-- Seleziona motivazione --</option>
                  {MOVEMENT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>

                {reason === 'altro' && (
                  <input
                    type="text"
                    className="form-control"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Scrivi la motivazione..."
                    style={{ marginTop: 10 }}
                  />
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome Cliente</label>
                <input
                  type="text"
                  className="form-control"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Es: Rossi Impianti"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Autorizzato da chi</label>
                <input
                  type="text"
                  className="form-control"
                  value={authorizedBy}
                  onChange={(e) => setAuthorizedBy(e.target.value)}
                  placeholder="Es: Roberto Lococo"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Operatore <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Nome operatore"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea
                className="form-control"
                placeholder="Aggiungi note al movimento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <button className={`btn ${config.btnClass} btn-lg w-full`} onClick={handleSubmit} style={{ marginTop: 8 }}>
              <span className="movement-btn-icon" aria-hidden="true">{MOVEMENT_ICON_LABELS[tipo] || '•'}</span> {config.btnLabel}
            </button>
          </div>
        </div>

        <div>
          {material ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title"><FaIcon name="inventory_2" className="ui-inline-icon" /> Materiale Selezionato</h3>
              </div>

              <div className="card-body">
                <div style={{ marginBottom: 16 }}>
                  <div className="text-sm text-muted fw-semibold">Codice</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{getMaterialCode(material)}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div className="text-sm text-muted fw-semibold">Descrizione</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{getMaterialDescription(material)}</div>
                </div>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Marca</div>
                    <div>{material.brand || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Categoria</div>
                    <div>{getCategoryName(material.category)}</div>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Posizione</div>
                    <div>{material.location || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted fw-semibold">Fornitore</div>
                    <div>{material.supplier || '—'}</div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: 20,
                    textAlign: 'center',
                    marginTop: 8
                  }}
                >
                  <div className="text-sm text-muted fw-semibold mb-2">Disponibilità Attuale</div>
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 800,
                      color:
                        Number(material.quantity || 0) === 0
                          ? 'var(--danger-600)'
                          : Number(material.quantity || 0) <= Number(material.minThreshold || 0)
                            ? 'var(--warning-600)'
                            : 'var(--primary-700)'
                    }}
                  >
                    {material.quantity}
                  </div>
                  <div className="text-sm text-muted">{material.unit} · soglia minima: {material.minThreshold}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="empty-state-icon"><FaIcon name="inventory_2" className="ui-inline-icon" /></div>
                  <div className="empty-state-title">Seleziona un materiale</div>
                  <div className="empty-state-text">
                    Scegli un materiale dall'elenco a sinistra per visualizzarne i dettagli e registrare il movimento.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showConfirm && material && (
        <div className="modal-overlay confirm-dialog" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Conferma Operazione</h3>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className={`confirm-icon ${tipo === 'uscita' ? 'danger' : 'warning'}`}>
                {MOVEMENT_ICON_LABELS[tipo] || '•'}
              </div>

              <div
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: 20,
                  marginBottom: 16
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {getMaterialCode(material)} — {getMaterialDescription(material)}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: config.color, marginTop: 8 }}>
                  {tipo === 'rettifica' ? 'Nuova qtà: ' : ''}{quantity} {material.unit}
                </div>
                <div style={{ marginTop: 8, color: 'var(--gray-600)', fontSize: 13 }}>
                  Operatore: {operatorName.trim() || '—'}
                </div>
                <div style={{ marginTop: 4, color: 'var(--gray-600)', fontSize: 13 }}>
                  Cliente: {clientName || '—'} · Autorizzato da: {authorizedBy || '—'}
                </div>
                <div style={{ marginTop: 4, color: 'var(--gray-600)', fontSize: 13 }}>
                  Motivazione: {finalReason || '—'}
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

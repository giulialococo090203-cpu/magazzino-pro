import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { materialStore, categoryStore, movementStore } from '../../data/store';
import { MOVEMENT_TYPES } from '../../data/initialData';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatStatus(status) {
  const labels = {
    disponibile: 'Disponibile',
    sotto_soglia: 'Sotto soglia',
    esaurito: 'Esaurito'
  };
  return labels[status] || status;
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canSeeListPrice(role) {
  return ['operaio', 'operatore', 'segretaria', 'segreteria', 'magazziniere', 'datore', 'admin'].includes(
    normalizeRole(role)
  );
}

function canSeeInstallerPrice(role) {
  return ['segretaria', 'segreteria', 'magazziniere', 'datore', 'admin'].includes(
    normalizeRole(role)
  );
}

function calcListPrice(netPrice) {
  return Number(netPrice || 0) * 1.22;
}

function calcInstallerPrice(netPrice) {
  return Number(netPrice || 0) * 0.9 * 1.22;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(value || 0));
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
    material?.descrizione
  ]
    .map(normalizeSearchText)
    .join(' ');

  return searchable.includes(q);
}

export default function Inventario() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailMaterial, setDetailMaterial] = useState(null);
  const [materialMovements, setMaterialMovements] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef(null);

  const showListPrice = canSeeListPrice(user?.role);
  const showInstallerPrice = canSeeInstallerPrice(user?.role);

  const refresh = async () => {
    try {
      const mats = await materialStore.getAll();
      const cats = await categoryStore.getAll();
      setMaterials(mats);
      setCategories(cats);
    } catch (err) {
      console.error('Errore durante il refresh:', err);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    async function loadMovements() {
      if (detailMaterial) {
        try {
          const movs = await movementStore.getByMaterial(detailMaterial.id);
          setMaterialMovements(movs.slice(0, 20));
        } catch (err) {
          console.error('Errore caricamento movimenti:', err);
        }
      } else {
        setMaterialMovements([]);
      }
    }

    loadMovements();
  }, [detailMaterial]);

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

  const filtered = materials.filter((m) => {
    const matchSearch = materialMatchesSearch(m, search);
    const matchCat = !filterCategory || m.category === filterCategory;
    const matchStatus = !filterStatus || m.status === filterStatus;

    return matchSearch && matchCat && matchStatus;
  });

  const suggestions = useMemo(() => {
    const q = normalizeSearchText(search);

    if (!q) return [];

    return materials
      .filter((m) => materialMatchesSearch(m, q))
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
  }, [search, materials]);

  const exportExcel = () => {
    const data = filtered.map((m) => {
      const row = {
        Codice: m.code,
        Descrizione: m.description,
        Marca: m.brand,
        Categoria: getCategoryName(m.category),
        Quantità: m.quantity,
        Unità: m.unit,
        'Soglia Min.': m.minThreshold,
        Stato: formatStatus(m.status),
        Posizione: m.location,
        Fornitore: m.supplier,
        Note: m.notes || ''
      };

      if (showListPrice) {
        row['Prezzo di listino'] = calcListPrice(m.netPrice);
      }

      if (showInstallerPrice) {
        row['Prezzo installatore'] = calcInstallerPrice(m.netPrice);
      }

      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `Inventario_Magazzino_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Inventario Magazzino', 14, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
      14,
      28
    );
    doc.text(`Totale materiali: ${filtered.length}`, 14, 34);

    const head = [
      'Codice',
      'Descrizione',
      'Marca',
      'Categoria',
      'Qtà',
      'UM'
    ];

    if (showListPrice) head.push('Prezzo listino');
    if (showInstallerPrice) head.push('Prezzo installatore');

    head.push('Stato', 'Posizione', 'Fornitore');

    const tableData = filtered.map((m) => {
      const row = [
        m.code,
        m.description,
        m.brand,
        getCategoryName(m.category),
        m.quantity,
        m.unit
      ];

      if (showListPrice) row.push(formatCurrency(calcListPrice(m.netPrice)));
      if (showInstallerPrice) row.push(formatCurrency(calcInstallerPrice(m.netPrice)));

      row.push(
        formatStatus(m.status),
        m.location || '',
        m.supplier || ''
      );

      return row;
    });

    autoTable(doc, {
      startY: 40,
      head: [head],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Inventario_Magazzino_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const clearSearch = () => {
    setSearch('');
    setShowSuggestions(false);
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario Magazzino</h1>
          <p className="page-subtitle">{filtered.length} materiali trovati su {materials.length} totali</p>
        </div>
        <div className="btn-group">
          <button onClick={exportExcel} className="btn btn-secondary">
            📊 Esporta Excel
          </button>
          <button onClick={exportPDF} className="btn btn-secondary">
            📄 Esporta PDF
          </button>
        </div>
      </div>

      <div className="filters-row">
        <div
          className="search-bar"
          style={{ flex: 1, maxWidth: 520, position: 'relative' }}
          ref={searchWrapRef}
        >
          <span className="search-bar-icon">🔍</span>

          <input
            type="text"
            className="form-control"
            placeholder="Cerca materiale per codice, nome o descrizione..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            style={{ paddingLeft: 40, paddingRight: search ? 42 : undefined }}
          />

          {search && (
            <button
              type="button"
              onClick={clearSearch}
              title="Pulisci ricerca"
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--gray-500)',
                fontSize: 16,
                lineHeight: 1
              }}
            >
              ✕
            </button>
          )}

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
                maxHeight: 320,
                overflowY: 'auto'
              }}
            >
              {suggestions.map((item) => {
                const code = getMaterialCode(item);
                const name = getMaterialName(item);
                const description = getMaterialDescription(item);

                return (
                  <button
                    key={item.id || `${code}-${description}`}
                    type="button"
                    onClick={() => {
                      setSearch(code || name || description || '');
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

          {showSuggestions && search.trim() && suggestions.length === 0 && (
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
                padding: '14px',
                color: 'var(--gray-500)',
                fontSize: 13
              }}
            >
              Nessun suggerimento trovato
            </div>
          )}
        </div>

        <div className="filter-group">
          <label>Categoria:</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Tutte</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Stato:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tutti</option>
            <option value="disponibile">Disponibile</option>
            <option value="sotto_soglia">Sotto soglia</option>
            <option value="esaurito">Esaurito</option>
          </select>
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
              <th style={{ textAlign: 'center' }}>Quantità</th>
              <th>UM</th>
              {showListPrice && <th>Prezzo di listino</th>}
              {showInstallerPrice && <th>Prezzo installatore</th>}
              <th>Stato</th>
              <th>Posizione</th>
              <th>Fornitore</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    9 +
                    (showListPrice ? 1 : 0) +
                    (showInstallerPrice ? 1 : 0) +
                    2
                  }
                  className="text-center"
                  style={{ padding: 40 }}
                >
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div className="empty-state-title">Nessun materiale trovato</div>
                    <div className="empty-state-text">Prova a modificare i filtri di ricerca</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.code}</strong></td>
                  <td>{m.description}</td>
                  <td>{m.brand}</td>
                  <td>{getCategoryName(m.category)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <strong
                      style={{
                        fontSize: 15,
                        color:
                          m.quantity === 0
                            ? 'var(--danger-600)'
                            : m.quantity <= m.minThreshold
                              ? 'var(--warning-600)'
                              : 'var(--gray-800)'
                      }}
                    >
                      {m.quantity}
                    </strong>
                  </td>
                  <td className="text-muted">{m.unit}</td>
                  {showListPrice && (
                    <td>{formatCurrency(calcListPrice(m.netPrice))}</td>
                  )}
                  {showInstallerPrice && (
                    <td>{formatCurrency(calcInstallerPrice(m.netPrice))}</td>
                  )}
                  <td>
                    <span className={`status-badge status-${m.status}`}>
                      {formatStatus(m.status)}
                    </span>
                  </td>
                  <td>{m.location}</td>
                  <td className="text-sm">{m.supplier}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setDetailMaterial(m)}
                      title="Dettagli"
                    >
                      👁️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailMaterial && (
        <div className="modal-overlay" onClick={() => setDetailMaterial(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{detailMaterial.code} — {detailMaterial.description}</h3>
                <div className="text-sm text-muted">
                  {detailMaterial.brand} · {getCategoryName(detailMaterial.category)}
                </div>
              </div>
              <button className="modal-close" onClick={() => setDetailMaterial(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 20 }}>
                <div>
                  <div className="text-sm text-muted fw-semibold">Quantità Disponibile</div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: detailMaterial.quantity === 0 ? 'var(--danger-600)' : 'var(--primary-700)'
                    }}
                  >
                    {detailMaterial.quantity} <span style={{ fontSize: 14, fontWeight: 500 }}>{detailMaterial.unit}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Soglia Minima</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gray-400)' }}>
                    {detailMaterial.minThreshold} <span style={{ fontSize: 14, fontWeight: 500 }}>{detailMaterial.unit}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Stato</div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`status-badge status-${detailMaterial.status}`} style={{ fontSize: 14, padding: '6px 16px' }}>
                      {formatStatus(detailMaterial.status)}
                    </span>
                  </div>
                </div>
              </div>

              {(showListPrice || showInstallerPrice) && (
                <div className="form-row" style={{ marginBottom: 20 }}>
                  {showListPrice && (
                    <div>
                      <span className="text-sm text-muted fw-semibold">Prezzo di listino:</span>{' '}
                      <strong>{formatCurrency(calcListPrice(detailMaterial.netPrice))}</strong>
                    </div>
                  )}
                  {showInstallerPrice && (
                    <div>
                      <span className="text-sm text-muted fw-semibold">Prezzo installatore:</span>{' '}
                      <strong>{formatCurrency(calcInstallerPrice(detailMaterial.netPrice))}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="form-row" style={{ marginBottom: 20 }}>
                <div><span className="text-sm text-muted fw-semibold">Posizione:</span> <strong>{detailMaterial.location || '—'}</strong></div>
                <div><span className="text-sm text-muted fw-semibold">Fornitore:</span> <strong>{detailMaterial.supplier || '—'}</strong></div>
              </div>

              {detailMaterial.notes && (
                <div style={{ marginBottom: 20 }}>
                  <span className="text-sm text-muted fw-semibold">Note:</span>
                  <p style={{ marginTop: 4, color: 'var(--gray-600)' }}>{detailMaterial.notes}</p>
                </div>
              )}

              <h4 className="section-title" style={{ marginTop: 16 }}>📋 Ultimi Movimenti</h4>
              {materialMovements.length === 0 ? (
                <p className="text-muted">Nessun movimento registrato</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Qtà</th>
                        <th>Operatore</th>
                        <th>Cliente</th>
                        <th>Autorizzato da</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialMovements.map((mov) => (
                        <tr key={mov.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {new Date(mov.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-muted">
                              {new Date(mov.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td>
                            <span className={`movement-badge movement-${mov.type}`}>
                              {MOVEMENT_TYPES.find((mt) => mt.value === mov.type)?.label || mov.type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{mov.quantity}</td>
                          <td>{mov.operatorName || mov.userName || '—'}</td>
                          <td>{mov.clientName || '—'}</td>
                          <td>{mov.authorizedBy || '—'}</td>
                          <td className="text-muted">{mov.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailMaterial(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { materialStore, categoryStore, movementStore } from '../../data/store';
import { MOVEMENT_TYPES } from '../../data/initialData';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatStatus(status) {
  const labels = { disponibile: 'Disponibile', sotto_soglia: 'Sotto soglia', esaurito: 'Esaurito' };
  return labels[status] || status;
}

export default function Inventario() {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [, setTick] = useState(0);
  const [detailMaterial, setDetailMaterial] = useState(null);
  const [materialMovements, setMaterialMovements] = useState([]);

  const refresh = async () => {
    try {
      const mats = await materialStore.getAll();
      const cats = await categoryStore.getAll();
      setMaterials(mats);
      setCategories(cats);
      setTick(t => t + 1);
    } catch (err) {
      console.error('Errore durante il refresh:', err);
    }
  };

  useEffect(() => { refresh(); }, []);

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

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || id;

  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.code?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.brand?.toLowerCase().includes(q) ||
      getCategoryName(m.category)?.toLowerCase().includes(q);
    const matchCat = !filterCategory || m.category === filterCategory;
    const matchStatus = !filterStatus || m.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const exportExcel = () => {
    const data = filtered.map(m => ({
      'Codice': m.code,
      'Descrizione': m.description,
      'Marca': m.brand,
      'Categoria': getCategoryName(m.category),
      'Quantità': m.quantity,
      'Unità': m.unit,
      'Soglia Min.': m.minThreshold,
      'Stato': formatStatus(m.status),
      'Posizione': m.location,
      'Fornitore': m.supplier,
      'Note': m.notes || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 16 },
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
      { wch: 12 }, { wch: 22 }, { wch: 20 }
    ];
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
    doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`, 14, 28);
    doc.text(`Totale materiali: ${filtered.length}`, 14, 34);

    const tableData = filtered.map(m => [
      m.code, m.description, m.brand, getCategoryName(m.category),
      m.quantity, m.unit, m.minThreshold, formatStatus(m.status),
      m.location, m.supplier
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Codice', 'Descrizione', 'Marca', 'Categoria', 'Qtà', 'UM', 'Soglia', 'Stato', 'Posizione', 'Fornitore']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 50 },
        4: { halign: 'center' },
        6: { halign: 'center' },
      }
    });

    doc.save(`Inventario_Magazzino_${new Date().toISOString().slice(0, 10)}.pdf`);
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

      {/* Filters */}
      <div className="filters-row">
        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
          <span className="search-bar-icon">🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder="Cerca per codice, descrizione, marca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
        <div className="filter-group">
          <label>Categoria:</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Tutte</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Stato:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tutti</option>
            <option value="disponibile">Disponibile</option>
            <option value="sotto_soglia">Sotto soglia</option>
            <option value="esaurito">Esaurito</option>
          </select>
        </div>
      </div>

      {/* Table */}
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
              <th>Stato</th>
              <th>Posizione</th>
              <th>Fornitore</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <div className="empty-state-title">Nessun materiale trovato</div>
                    <div className="empty-state-text">Prova a modificare i filtri di ricerca</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.code}</strong></td>
                  <td>{m.description}</td>
                  <td>{m.brand}</td>
                  <td>{getCategoryName(m.category)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <strong style={{
                      fontSize: 15,
                      color: m.quantity === 0 ? 'var(--danger-600)' : m.quantity <= m.minThreshold ? 'var(--warning-600)' : 'var(--gray-800)'
                    }}>
                      {m.quantity}
                    </strong>
                  </td>
                  <td className="text-muted">{m.unit}</td>
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

      {/* Detail Modal */}
      {detailMaterial && (
        <div className="modal-overlay" onClick={() => setDetailMaterial(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{detailMaterial.code} — {detailMaterial.description}</h3>
                <div className="text-sm text-muted">{detailMaterial.brand} · {getCategoryName(detailMaterial.category)}</div>
              </div>
              <button className="modal-close" onClick={() => setDetailMaterial(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 20 }}>
                <div>
                  <div className="text-sm text-muted fw-semibold">Quantità Disponibile</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: detailMaterial.quantity === 0 ? 'var(--danger-600)' : 'var(--primary-700)' }}>
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
              <div className="form-row" style={{ marginBottom: 20 }}>
                <div><span className="text-sm text-muted fw-semibold">Posizione:</span> <strong>{detailMaterial.location}</strong></div>
                <div><span className="text-sm text-muted fw-semibold">Fornitore:</span> <strong>{detailMaterial.supplier}</strong></div>
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
                        <th>Utente</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialMovements.map(mov => (
                        <tr key={mov.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{new Date(mov.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                            <div className="text-xs text-muted">{new Date(mov.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td>
                            <span className={`movement-badge movement-${mov.type}`}>
                              {MOVEMENT_TYPES.find(mt => mt.value === mov.type)?.label || mov.type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{mov.quantity}</td>
                          <td>{mov.userName || mov.userId}</td>
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

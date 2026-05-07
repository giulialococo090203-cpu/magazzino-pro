import { useEffect, useMemo, useState } from 'react';
import { materialStore, categoryStore, movementStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Icon from '../../components/Icon';
import FaIcon from '../../components/FaIcon';

function formatDateTime() {
  return new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTodayFileName() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getDifference(systemQty, countedQty) {
  if (countedQty === '' || countedQty === null || countedQty === undefined) return null;
  return Number(countedQty || 0) - Number(systemQty || 0);
}

export default function InventarioFisico() {
  const { user } = useAuth();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOnlyDiff, setFilterOnlyDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [confirmApply, setConfirmApply] = useState(false);

  const refresh = async () => {
    try {
      setError('');

      const [mats, cats] = await Promise.all([
        materialStore.getAll(),
        categoryStore.getAll(),
      ]);

      const cleanMats = Array.isArray(mats) ? mats : [];

      setMaterials(cleanMats);
      setCategories(Array.isArray(cats) ? cats : []);

      setCounts((prev) => {
        const next = { ...prev };

        cleanMats.forEach((mat) => {
          if (next[mat.id] === undefined) next[mat.id] = '';
        });

        return next;
      });
    } catch (err) {
      console.error('Errore caricamento inventario fisico:', err);
      setError('Errore durante il caricamento dei materiali.');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const getCategoryName = (id) => {
    return categories.find((cat) => String(cat.id) === String(id))?.name || id || '—';
  };

  const rows = useMemo(() => {
    const q = normalizeText(search);

    return materials
      .map((m) => {
        const countedValue = counts[m.id];
        const diff = getDifference(m.quantity, countedValue);

        return {
          ...m,
          countedValue,
          diff,
          rowNote: notes[m.id] || '',
        };
      })
      .filter((m) => {
        const searchable = [
          m.code,
          m.description,
          m.brand,
          m.supplier,
          m.location,
          getCategoryName(m.category),
        ]
          .map(normalizeText)
          .join(' ');

        const matchSearch = !q || searchable.includes(q);
        const matchCategory = !filterCategory || String(m.category) === String(filterCategory);
        const matchDiff = !filterOnlyDiff || (m.diff !== null && Number(m.diff || 0) !== 0);

        return matchSearch && matchCategory && matchDiff;
      });
  }, [materials, counts, notes, search, filterCategory, filterOnlyDiff, categories]);

  const countedRows = useMemo(() => {
    return materials
      .map((m) => ({
        ...m,
        countedValue: counts[m.id],
        diff: getDifference(m.quantity, counts[m.id]),
        rowNote: notes[m.id] || '',
      }))
      .filter((m) => m.countedValue !== '' && m.countedValue !== null && m.countedValue !== undefined);
  }, [materials, counts, notes]);

  const differentRows = useMemo(() => {
    return countedRows.filter((m) => Number(m.diff || 0) !== 0);
  }, [countedRows]);

  const updateCount = (id, value) => {
    setCounts((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const updateNote = (id, value) => {
    setNotes((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const fillVisibleWithSystemQty = () => {
    setCounts((prev) => {
      const next = { ...prev };

      rows.forEach((row) => {
        next[row.id] = String(Number(row.quantity || 0));
      });

      return next;
    });
  };

  const clearVisibleCounts = () => {
    setCounts((prev) => {
      const next = { ...prev };

      rows.forEach((row) => {
        next[row.id] = '';
      });

      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('');
    setFilterOnlyDiff(false);
  };

  const buildExportRows = (sourceRows = countedRows) => {
    return sourceRows.map((m) => ({
      Codice: m.code || '',
      Descrizione: m.description || '',
      Marca: m.brand || '',
      Categoria: getCategoryName(m.category),
      'Qtà sistema': Number(m.quantity || 0),
      'Qtà contata': m.countedValue === '' ? '' : Number(m.countedValue || 0),
      Differenza: m.diff === null ? '' : Number(m.diff || 0),
      UM: m.unit || '',
      Posizione: m.location || '',
      Fornitore: m.supplier || '',
      Note: m.rowNote || '',
    }));
  };

  const exportExcel = () => {
    const sourceRows = countedRows.length > 0 ? countedRows : rows;

    if (sourceRows.length === 0) {
      alert('Non ci sono righe da esportare.');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(buildExportRows(sourceRows));

    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 38 },
      { wch: 18 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 18 },
      { wch: 22 },
      { wch: 34 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario Fisico');
    XLSX.writeFile(workbook, `Inventario_Fisico_${getTodayFileName()}.xlsx`);
  };

  const exportCSV = () => {
    const sourceRows = countedRows.length > 0 ? countedRows : rows;

    if (sourceRows.length === 0) {
      alert('Non ci sono righe da esportare.');
      return;
    }

    const exportRows = buildExportRows(sourceRows);
    const headers = Object.keys(exportRows[0]);

    const lines = [
      headers.map(csvEscape).join(';'),
      ...exportRows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
    ];

    downloadTextFile(
      `Inventario_Fisico_${getTodayFileName()}.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    );
  };

  const exportPDF = () => {
    const sourceRows = countedRows.length > 0 ? countedRows : rows;

    if (sourceRows.length === 0) {
      alert('Non ci sono righe da esportare.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Inventario Fisico / Conteggio Magazzino', 14, 18);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generato il ${formatDateTime()}`, 14, 25);
    doc.text(`Righe esportate: ${sourceRows.length}`, 14, 30);
    doc.text(`Differenze rilevate: ${sourceRows.filter((row) => Number(row.diff || 0) !== 0).length}`, 14, 35);

    autoTable(doc, {
      startY: 42,
      head: [[
        'Codice',
        'Descrizione',
        'Marca',
        'Categoria',
        'Qtà sistema',
        'Qtà contata',
        'Diff.',
        'UM',
        'Posizione',
        'Fornitore',
        'Note',
      ]],
      body: sourceRows.map((m) => [
        m.code || '',
        m.description || '',
        m.brand || '',
        getCategoryName(m.category),
        Number(m.quantity || 0),
        m.countedValue === '' ? '' : Number(m.countedValue || 0),
        m.diff === null ? '' : Number(m.diff || 0),
        m.unit || '',
        m.location || '',
        m.supplier || '',
        m.rowNote || '',
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 46 },
        2: { cellWidth: 22 },
        3: { cellWidth: 24 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 10, halign: 'center' },
        8: { cellWidth: 22 },
        9: { cellWidth: 28 },
        10: { cellWidth: 40 },
      },
    });

    doc.save(`Inventario_Fisico_${getTodayFileName()}.pdf`);
  };

  const applyDifferences = async () => {
    if (differentRows.length === 0) {
      setConfirmApply(false);
      alert('Non ci sono differenze da applicare.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      for (const row of differentRows) {
        await movementStore.create({
          materialId: row.id,
          type: 'rettifica',
          quantity: Number(row.countedValue || 0),
          reason: 'inventario_fisico',
          notes:
            `Inventario fisico del ${formatDateTime()}. ` +
            `Sistema: ${Number(row.quantity || 0)} ${row.unit || ''}. ` +
            `Conteggio: ${Number(row.countedValue || 0)} ${row.unit || ''}. ` +
            `Differenza: ${Number(row.diff || 0)}. ` +
            `${row.rowNote ? `Note: ${row.rowNote}` : ''}`,
          userId: user?.id,
          userName: user?.fullName || user?.username || '',
          operatorName: user?.fullName || user?.username || '',
          clientName: '',
          authorizedBy: user?.fullName || user?.username || '',
        });
      }

      await adminLogStore.create({
        action: 'Applicazione inventario fisico',
        entity: 'inventario_fisico',
        details:
          `Applicate ${differentRows.length} rettifiche da procedura di inventario fisico. ` +
          `Righe contate: ${countedRows.length}.`,
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
      });

      setSuccess(`Inventario fisico applicato: ${differentRows.length} rettifiche registrate.`);
      setConfirmApply(false);
      setCounts({});
      setNotes({});

      await refresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Errore applicazione inventario fisico:', err);
      setError(err?.message || 'Errore durante l’applicazione delle rettifiche.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Icon name="fact_check" className="ui-title-icon" aria-hidden="true" />Inventario Fisico</h1>
          <p className="page-subtitle">
            Procedura guidata per conteggio, differenze e rettifiche automatiche
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={refresh} disabled={saving}>
            ↻ Aggiorna
          </button>
          <button className="btn btn-secondary" onClick={exportExcel}>
            <Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /> Excel
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
             CSV
          </button>
          <button className="btn btn-secondary" onClick={exportPDF}>
            <Icon name="upload_file" className="ui-inline-icon" aria-hidden="true" /> PDF
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setConfirmApply(true)}
            disabled={saving || differentRows.length === 0}
          >
            ✓ Applica rettifiche
          </button>
        </div>
      </div>

      {success && (
        <div
          style={{
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            color: 'var(--success-700)',
            padding: '12px 18px',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 16,
            fontWeight: 800,
          }}
        >
          <Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /> {success}
        </div>
      )}

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali totali</div>
            <div className="kpi-value">{materials.length}</div>
            <div className="kpi-detail">anagrafica caricata</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"></div>
          <div className="kpi-content">
            <div className="kpi-label">Righe contate</div>
            <div className="kpi-value">{countedRows.length}</div>
            <div className="kpi-detail">conteggi inseriti</div>
          </div>
        </div>

        <div className={`kpi-card ${differentRows.length > 0 ? 'warning' : ''}`}>
          <div className="kpi-icon yellow"><Icon name="warning" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Differenze</div>
            <div className="kpi-value">{differentRows.length}</div>
            <div className="kpi-detail">rettifiche da applicare</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Icon name="filter_alt" className="ui-section-icon" aria-hidden="true" />Filtri e strumenti conteggio</h3>
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Azzera filtri
          </button>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
              <span className="search-bar-icon"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /></span>
              <input
                type="text"
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca codice, descrizione, marca, posizione..."
                style={{ paddingLeft: 40 }}
              />
            </div>

            <div className="filter-group">
              <label>Categoria:</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 800,
                color: 'var(--gray-700)',
              }}
            >
              <input
                type="checkbox"
                checked={filterOnlyDiff}
                onChange={(e) => setFilterOnlyDiff(e.target.checked)}
              />
              Solo differenze
            </label>

            <button className="btn btn-secondary" onClick={fillVisibleWithSystemQty}>
              Copia qtà sistema nei visibili
            </button>

            <button className="btn btn-secondary" onClick={clearVisibleCounts}>
              Svuota conteggi visibili
            </button>
          </div>

          <div className="text-xs text-muted" style={{ marginTop: 12 }}>
            Inserisci la quantità realmente contata. Se è diversa dalla quantità di sistema,
            la pagina genera una rettifica automatica quando premi “Applica rettifiche”.
          </div>
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
              <th>Posizione</th>
              <th style={{ textAlign: 'center' }}>Qtà sistema</th>
              <th style={{ textAlign: 'center' }}>Qtà contata</th>
              <th style={{ textAlign: 'center' }}>Differenza</th>
              <th>UM</th>
              <th>Note conteggio</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
                    <div className="empty-state-title">Nessun materiale trovato</div>
                    <div className="empty-state-text">
                      Prova a modificare i filtri.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const diff = m.diff;

                return (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.code}</strong>
                    </td>
                    <td className="text-sm">{m.description}</td>
                    <td className="text-sm">{m.brand}</td>
                    <td className="text-sm">{getCategoryName(m.category)}</td>
                    <td className="text-sm">{m.location || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>
                      {Number(m.quantity || 0)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={counts[m.id] ?? ''}
                        onChange={(e) => updateCount(m.id, e.target.value)}
                        min="0"
                        step="1"
                        placeholder="Conta"
                        style={{
                          width: 92,
                          padding: '7px 8px',
                          textAlign: 'center',
                          display: 'inline-block',
                        }}
                      />
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 900,
                        color:
                          diff === null || Number(diff || 0) === 0
                            ? 'var(--success-700)'
                            : Number(diff || 0) < 0
                              ? 'var(--danger-600)'
                              : 'var(--warning-700)',
                      }}
                    >
                      {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td>{m.unit}</td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={notes[m.id] || ''}
                        onChange={(e) => updateNote(m.id, e.target.value)}
                        placeholder="Nota opzionale..."
                        style={{ minWidth: 180 }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmApply && (
        <div
          className="modal-overlay confirm-dialog"
          onClick={() => !saving && setConfirmApply(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Applicare rettifiche inventario?</h3>
              <button
                className="modal-close"
                onClick={() => setConfirmApply(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon warning"><Icon name="fact_check" className="ui-inline-icon" aria-hidden="true" /></div>

              <p className="confirm-message">
                Verranno registrate <strong>{differentRows.length}</strong> rettifiche di magazzino.
                <br />
                Ogni rettifica aggiornerà la quantità del materiale e verrà salvata nello storico movimenti.
              </p>

              <div
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: 14,
                  textAlign: 'left',
                  maxHeight: 220,
                  overflowY: 'auto',
                  marginTop: 12,
                }}
              >
                {differentRows.slice(0, 12).map((row) => (
                  <div key={row.id} className="text-sm" style={{ marginBottom: 8 }}>
                    <strong>{row.code}</strong> — sistema {row.quantity}, contato {row.countedValue}, diff{' '}
                    <strong>{row.diff > 0 ? `+${row.diff}` : row.diff}</strong>
                  </div>
                ))}

                {differentRows.length > 12 && (
                  <div className="text-xs text-muted">
                    + altre {differentRows.length - 12} righe
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmApply(false)}
                disabled={saving}
              >
                Annulla
              </button>

              <button
                className="btn btn-primary"
                onClick={applyDifferences}
                disabled={saving}
              >
                {saving ? 'Applicazione...' : 'Sì, applica rettifiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

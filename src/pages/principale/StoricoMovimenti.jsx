import { useState, useEffect, useMemo, useRef } from 'react';
import { movementStore, categoryStore, materialStore, userStore } from '../../data/store';
import { MOVEMENT_TYPES, MOVEMENT_REASONS } from '../../data/initialData';
import { useAuth } from '../../App';
import { hasPermission } from '../../data/permissions';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatMovType(t) {
  return MOVEMENT_TYPES.find((mt) => mt.value === t)?.label || t || '—';
}

function formatReason(r) {
  return MOVEMENT_REASONS.find((mr) => mr.value === r)?.label || r || '—';
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function getExportDateName() {
  return new Date().toISOString().slice(0, 10);
}

function buildExportRows(movements = []) {
  return movements.map((mov) => ({
    Data: formatDate(mov.date),
    Ora: formatTime(mov.date),
    Tipo: formatMovType(mov.type),
    'Codice materiale': mov.materialCode || '',
    'Descrizione materiale': mov.materialDescription || '',
    Quantità: mov.quantity ?? '',
    Prima: mov.previousQty ?? '',
    Dopo: mov.newQty ?? '',
    Motivazione: formatReason(mov.reason),
    Operatore: mov.operatorName || mov.userName || '',
    Cliente: mov.clientName || '',
    'Autorizzato da': mov.authorizedBy || '',
    Note: mov.notes || '',
  }));
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

function csvEscape(value) {
  const raw = String(value ?? '');
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function StoricoMovimenti() {
  const { user } = useAuth();

  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [users, setUsers] = useState([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterClient, setFilterClient] = useState('');

  const [page, setPage] = useState(1);
  const perPage = 20;

  const clientWrapRef = useRef(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const canExportMovements = hasPermission(user, 'canExportMovements');

  useEffect(() => {
    async function loadStatic() {
      try {
        const [cats, mats, usrs] = await Promise.all([
          categoryStore.getAll(),
          materialStore.getAll(),
          userStore.getAll(),
        ]);

        setCategories(cats);
        setMaterials(mats);
        setUsers(usrs);
      } catch (err) {
        console.error('Errore caricamento dati statici:', err);
      }
    }

    loadStatic();
  }, []);

  useEffect(() => {
    async function loadFiltered() {
      try {
        const filtered = await movementStore.getFiltered({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          userId: filterUser || undefined,
          categoryId: filterCategory || undefined,
          materialId: filterMaterial || undefined,
          type: filterType || undefined,
        });

        const clientFiltered = filterClient
          ? filtered.filter((m) =>
              String(m.clientName || '').toLowerCase().includes(filterClient.toLowerCase())
            )
          : filtered;

        setMovements(clientFiltered);
        setPage(1);
      } catch (err) {
        console.error('Errore caricamento movimenti:', err);
      }
    }

    loadFiltered();
  }, [dateFrom, dateTo, filterUser, filterCategory, filterMaterial, filterType, filterClient]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (clientWrapRef.current && !clientWrapRef.current.contains(e.target)) {
        setShowClientSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const clientSuggestions = useMemo(() => {
    const allClients = [...new Set(movements.map((m) => m.clientName).filter(Boolean))];
    const q = filterClient.trim().toLowerCase();

    if (!q) return allClients.slice(0, 8);

    return allClients.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [movements, filterClient]);

  const totalPages = Math.ceil(movements.length / perPage);
  const paginated = movements.slice((page - 1) * perPage, page * perPage);

  const exportFileBaseName = useMemo(() => {
    const parts = ['Storico_Movimenti', getExportDateName()];

    if (dateFrom) parts.push(`dal_${dateFrom}`);
    if (dateTo) parts.push(`al_${dateTo}`);
    if (filterType) parts.push(filterType);
    if (filterClient) parts.push(filterClient);

    return sanitizeFileName(parts.join('_'));
  }, [dateFrom, dateTo, filterType, filterClient]);

  const exportRows = useMemo(() => buildExportRows(movements), [movements]);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterUser('');
    setFilterCategory('');
    setFilterMaterial('');
    setFilterType('');
    setFilterClient('');
  };

  const exportExcel = () => {
    if (movements.length === 0) {
      alert('Non ci sono movimenti da esportare.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 },
      { wch: 34 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 34 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Storico Movimenti');
    XLSX.writeFile(workbook, `${exportFileBaseName}.xlsx`);
  };

  const exportCSV = () => {
    if (movements.length === 0) {
      alert('Non ci sono movimenti da esportare.');
      return;
    }

    const headers = Object.keys(exportRows[0] || {});
    const lines = [
      headers.map(csvEscape).join(';'),
      ...exportRows.map((row) => headers.map((h) => csvEscape(row[h])).join(';')),
    ];

    downloadTextFile(`${exportFileBaseName}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  const exportPDF = () => {
    if (movements.length === 0) {
      alert('Non ci sono movimenti da esportare.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(17);
    doc.setFont(undefined, 'bold');
    doc.text('Storico Movimenti Magazzino', 14, 18);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
      14,
      25
    );

    doc.text(`Movimenti esportati: ${movements.length}`, 14, 30);

    const filterDescriptions = [];

    if (dateFrom) filterDescriptions.push(`Dal: ${formatDate(dateFrom)}`);
    if (dateTo) filterDescriptions.push(`Al: ${formatDate(dateTo)}`);
    if (filterType) filterDescriptions.push(`Tipo: ${formatMovType(filterType)}`);
    if (filterClient) filterDescriptions.push(`Cliente: ${filterClient}`);

    const userLabel = users.find((u) => String(u.id) === String(filterUser))?.fullName;
    const categoryLabel = categories.find((c) => String(c.id) === String(filterCategory))?.name;
    const materialLabel = materials.find((m) => String(m.id) === String(filterMaterial));

    if (userLabel) filterDescriptions.push(`Utente: ${userLabel}`);
    if (categoryLabel) filterDescriptions.push(`Categoria: ${categoryLabel}`);
    if (materialLabel) filterDescriptions.push(`Materiale: ${materialLabel.code} - ${materialLabel.description}`);

    if (filterDescriptions.length > 0) {
      doc.text(`Filtri: ${filterDescriptions.join(' · ')}`, 14, 35, { maxWidth: 265 });
    }

    autoTable(doc, {
      startY: filterDescriptions.length > 0 ? 42 : 36,
      head: [[
        'Data',
        'Ora',
        'Tipo',
        'Codice',
        'Materiale',
        'Qtà',
        'Prima',
        'Dopo',
        'Motivo',
        'Operatore',
        'Cliente',
        'Autorizzato da',
        'Note',
      ]],
      body: movements.map((mov) => [
        formatDate(mov.date),
        formatTime(mov.date),
        formatMovType(mov.type),
        mov.materialCode || '',
        mov.materialDescription || '',
        mov.quantity ?? '',
        mov.previousQty ?? '',
        mov.newQty ?? '',
        formatReason(mov.reason),
        mov.operatorName || mov.userName || '',
        mov.clientName || '',
        mov.authorizedBy || '',
        mov.notes || '',
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
        0: { cellWidth: 16 },
        1: { cellWidth: 13 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 34 },
        5: { cellWidth: 10, halign: 'center' },
        6: { cellWidth: 10, halign: 'center' },
        7: { cellWidth: 10, halign: 'center' },
        8: { cellWidth: 24 },
        9: { cellWidth: 24 },
        10: { cellWidth: 22 },
        11: { cellWidth: 24 },
        12: { cellWidth: 36 },
      },
    });

    doc.save(`${exportFileBaseName}.pdf`);
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Storico Movimenti</h1>
          <p className="page-subtitle">{movements.length} movimenti trovati</p>
        </div>

        {canExportMovements && (
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={exportExcel} disabled={movements.length === 0}>
              📊 Excel
            </button>
            <button className="btn btn-secondary" onClick={exportCSV} disabled={movements.length === 0}>
              🧾 CSV
            </button>
            <button className="btn btn-secondary" onClick={exportPDF} disabled={movements.length === 0}>
              📄 PDF
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🔍 Filtri di Ricerca</h3>
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Azzera filtri
          </button>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group">
              <label>Dal:</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="filter-group">
              <label>Al:</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="filter-group">
              <label>Tipo:</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tutti</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Categoria:</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Materiale:</label>
              <select value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)}>
                <option value="">Tutti</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Utente:</label>
              <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                <option value="">Tutti</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group" ref={clientWrapRef} style={{ position: 'relative' }}>
              <label>Cliente:</label>
              <input
                type="text"
                value={filterClient}
                onChange={(e) => {
                  setFilterClient(e.target.value);
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                placeholder="Cerca cliente..."
              />

              {showClientSuggestions && clientSuggestions.length > 0 && (
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
                    maxHeight: 220,
                    overflowY: 'auto',
                  }}
                >
                  {clientSuggestions.map((client) => (
                    <button
                      key={client}
                      type="button"
                      onClick={() => {
                        setFilterClient(client);
                        setShowClientSuggestions(false);
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--gray-100)',
                      }}
                    >
                      {client}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data / Ora</th>
              <th>Tipo</th>
              <th>Codice</th>
              <th>Materiale</th>
              <th style={{ textAlign: 'center' }}>Qtà</th>
              <th style={{ textAlign: 'center' }}>Prima</th>
              <th style={{ textAlign: 'center' }}>Dopo</th>
              <th>Motivo</th>
              <th>Utente</th>
              <th>Cliente</th>
              <th>Autorizzato da</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Nessun movimento trovato</div>
                    <div className="empty-state-text">Prova a modificare i filtri di ricerca</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((mov) => (
                <tr key={mov.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{formatDate(mov.date)}</div>
                    <div className="text-xs text-muted">{formatTime(mov.date)}</div>
                  </td>

                  <td>
                    <span className={`movement-badge movement-${mov.type}`}>
                      {formatMovType(mov.type)}
                    </span>
                  </td>

                  <td>
                    <strong>{mov.materialCode}</strong>
                  </td>

                  <td>
                    <div
                      className="text-sm"
                      title={mov.materialDescription}
                      style={{
                        maxWidth: 180,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {mov.materialDescription}
                    </div>
                  </td>

                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
                    {mov.quantity}
                  </td>

                  <td style={{ textAlign: 'center' }} className="text-muted">
                    {mov.previousQty ?? '—'}
                  </td>

                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {mov.newQty ?? '—'}
                  </td>

                  <td className="text-sm">{formatReason(mov.reason)}</td>
                  <td className="text-sm">{mov.operatorName || mov.userName || '—'}</td>
                  <td className="text-sm">{mov.clientName || '—'}</td>
                  <td className="text-sm">{mov.authorizedBy || '—'}</td>
                  <td className="text-sm text-muted">{mov.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Pagina {page} di {totalPages} — {movements.length} risultati
          </div>

          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ←
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;

              if (totalPages <= 7) pageNum = i + 1;
              else if (page <= 4) pageNum = i + 1;
              else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = page - 3 + i;

              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(Math.max(1, totalPages), p + 1))}
              disabled={page >= totalPages}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
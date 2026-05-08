import { useState, useEffect, useMemo, useRef } from 'react';
import {
  movementStore,
  categoryStore,
  materialStore,
  userStore,
  invoiceImportStore,
  adminLogStore,
} from '../../data/store';
import { MOVEMENT_TYPES, MOVEMENT_REASONS } from '../../data/initialData';
import { useAuth } from '../../App';
import { hasPermission, normalizeRole } from '../../data/permissions';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Icon from '../../components/Icon';

function formatDate(iso) {
  if (!iso) return '';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function getOperatorName(mov) {
  return (
    String(mov?.operatorName || mov?.userName || 'Senza operatore').trim() ||
    'Senza operatore'
  );
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
    Operatore: getOperatorName(mov),
    Cliente: mov.clientName || '',
    'Autorizzato da': mov.authorizedBy || '',
    Note: mov.notes || '',
  }));
}

function buildEmployeeHistoryRows(movements = []) {
  return [...movements]
    .sort((a, b) => {
      const operatorA = getOperatorName(a).toLowerCase();
      const operatorB = getOperatorName(b).toLowerCase();

      if (operatorA !== operatorB) {
        return operatorA.localeCompare(operatorB, 'it');
      }

      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    })
    .map((mov) => ({
      Operatore: getOperatorName(mov),
      Data: formatDate(mov.date),
      Ora: formatTime(mov.date),
      Tipo: formatMovType(mov.type),
      'Codice materiale': mov.materialCode || '',
      'Descrizione materiale': mov.materialDescription || '',
      Quantità: mov.quantity ?? '',
      Prima: mov.previousQty ?? '',
      Dopo: mov.newQty ?? '',
      Motivazione: formatReason(mov.reason),
      Cliente: mov.clientName || '',
      'Autorizzato da': mov.authorizedBy || '',
      Note: mov.notes || '',
    }));
}

function groupMovementsByOperator(movements = []) {
  const groups = {};

  movements.forEach((mov) => {
    const operator = getOperatorName(mov);

    if (!groups[operator]) {
      groups[operator] = [];
    }

    groups[operator].push(mov);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase(), 'it'))
    .map(([operator, rows]) => ({
      operator,
      rows: rows.sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ),
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

  const [confirmEmptyHistory, setConfirmEmptyHistory] = useState(false);
  const [emptyingHistory, setEmptyingHistory] = useState(false);
  const [emptyHistoryError, setEmptyHistoryError] = useState('');
  const [emptyHistoryResult, setEmptyHistoryResult] = useState(null);

  const canExportMovements = hasPermission(user, 'canExportMovements');
  const isDatore = ['datore', 'admin'].includes(normalizeRole(user?.role));
  const canEmptyHistory = isDatore || hasPermission(user, 'canViewAuditLog');

  const loadStatic = async () => {
    try {
      const [cats, mats, usrs] = await Promise.all([
        categoryStore.getAll(),
        materialStore.getAll(),
        userStore.getAll(),
      ]);

      setCategories(Array.isArray(cats) ? cats : []);
      setMaterials(Array.isArray(mats) ? mats : []);
      setUsers(Array.isArray(usrs) ? usrs : []);
    } catch (err) {
      console.error('Errore caricamento dati statici:', err);
    }
  };

  const loadFiltered = async () => {
    try {
      const userFilterValue = String(filterUser || '');
      const isOperatorFilter = userFilterValue.startsWith('operator:');
      const isUserFilter = userFilterValue.startsWith('user:');

      const selectedUserId = isUserFilter
        ? userFilterValue.replace(/^user:/, '')
        : isOperatorFilter
          ? ''
          : userFilterValue;

      const selectedOperator = isOperatorFilter
        ? userFilterValue.replace(/^operator:/, '')
        : '';

      const filtered = await movementStore.getFiltered({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: selectedUserId || undefined,
        categoryId: filterCategory || undefined,
        materialId: filterMaterial || undefined,
        type: filterType || undefined,
      });

      const operatorFiltered = selectedOperator
        ? filtered.filter((m) => getOperatorName(m) === selectedOperator)
        : filtered;

      const clientFiltered = filterClient
        ? operatorFiltered.filter((m) =>
            String(m.clientName || '').toLowerCase().includes(filterClient.toLowerCase())
          )
        : operatorFiltered;

      setMovements(Array.isArray(clientFiltered) ? clientFiltered : []);
      setPage(1);
    } catch (err) {
      console.error('Errore caricamento movimenti:', err);
    }
  };

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadFiltered();
  }, [dateFrom, dateTo, filterUser, filterCategory, filterMaterial, filterType, filterClient]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (clientWrapRef.current && !clientWrapRef.current.contains(e.target)) {
        setShowClientSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const clientSuggestions = useMemo(() => {
    const allClients = [...new Set(movements.map((m) => m.clientName).filter(Boolean))];
    const q = filterClient.trim().toLowerCase();

    if (!q) return allClients.slice(0, 8);

    return allClients.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [movements, filterClient]);

  const operatorOptions = useMemo(() => {
    return [...new Set(movements.map((m) => getOperatorName(m)).filter(Boolean))]
      .filter((name) => name !== 'Senza operatore')
      .sort((a, b) => a.localeCompare(b, 'it'));
  }, [movements]);

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

  const notifySupabaseUsageRefresh = () => {
    localStorage.setItem('wm_supabase_usage_refresh', String(Date.now()));
    window.dispatchEvent(new Event('wm_supabase_usage_refresh'));
  };

  const handleEmptyHistory = async () => {
    if (!canEmptyHistory) return;

    setEmptyingHistory(true);
    setEmptyHistoryError('');
    setEmptyHistoryResult(null);

    try {
      const currentMovementCount = movements.length;

      const invoiceCleanup = await invoiceImportStore.deleteAllWithFiles();
      await movementStore.deleteAll();

      await adminLogStore.create({
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
        entity: 'storico',
        action: 'Svuotamento storico',
        details:
          `Storico movimenti svuotato. ` +
          `Movimenti visibili al momento: ${currentMovementCount}. ` +
          `Fatture eliminate: ${invoiceCleanup.invoicesDeleted}. ` +
          `File richiesti in eliminazione: ${invoiceCleanup.filesRequested}. ` +
          `File eliminati: ${invoiceCleanup.filesDeleted}.`,
      });

      setMovements([]);
      setPage(1);
      setConfirmEmptyHistory(false);
      setEmptyHistoryResult(invoiceCleanup);

      notifySupabaseUsageRefresh();

      await loadStatic();
      await loadFiltered();
    } catch (err) {
      console.error('Errore svuotamento storico:', err);
      setEmptyHistoryError(err.message || 'Errore durante lo svuotamento dello storico.');
    } finally {
      setEmptyingHistory(false);
    }
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

    downloadTextFile(
      `${exportFileBaseName}.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    );
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

    const isOperatorFilter = String(filterUser || '').startsWith('operator:');
    const selectedOperatorLabel = isOperatorFilter
      ? String(filterUser).replace(/^operator:/, '')
      : '';
    const selectedUserId = String(filterUser || '').startsWith('user:')
      ? String(filterUser).replace(/^user:/, '')
      : filterUser;
    const userLabel = users.find((u) => String(u.id) === String(selectedUserId))?.fullName;
    const categoryLabel = categories.find((c) => String(c.id) === String(filterCategory))?.name;
    const materialLabel = materials.find((m) => String(m.id) === String(filterMaterial));

    if (userLabel) filterDescriptions.push(`Utente: ${userLabel}`);
    if (selectedOperatorLabel) filterDescriptions.push(`Operatore: ${selectedOperatorLabel}`);
    if (selectedOperatorLabel) filterDescriptions.push(`Operatore: ${selectedOperatorLabel}`);
    if (categoryLabel) filterDescriptions.push(`Categoria: ${categoryLabel}`);
    if (materialLabel) {
      filterDescriptions.push(`Materiale: ${materialLabel.code} - ${materialLabel.description}`);
    }

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
        getOperatorName(mov),
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

  const exportEmployeeCSV = () => {
    if (movements.length === 0) {
      alert('Non ci sono movimenti da esportare.');
      return;
    }

    const rows = buildEmployeeHistoryRows(movements);
    const headers = Object.keys(rows[0] || {});

    const lines = [
      headers.map(csvEscape).join(';'),
      ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(';')),
    ];

    downloadTextFile(
      `${exportFileBaseName}_Dipendenti.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    );
  };

  const exportEmployeePDF = () => {
    if (movements.length === 0) {
      alert('Non ci sono movimenti da esportare.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(17);
    doc.setFont(undefined, 'bold');
    doc.text('Storico Dipendenti - Movimenti Magazzino', 14, 18);

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

    const isOperatorFilter = String(filterUser || '').startsWith('operator:');
    const selectedOperatorLabel = isOperatorFilter
      ? String(filterUser).replace(/^operator:/, '')
      : '';
    const selectedUserId = String(filterUser || '').startsWith('user:')
      ? String(filterUser).replace(/^user:/, '')
      : filterUser;
    const userLabel = users.find((u) => String(u.id) === String(selectedUserId))?.fullName;
    const categoryLabel = categories.find((c) => String(c.id) === String(filterCategory))?.name;
    const materialLabel = materials.find((m) => String(m.id) === String(filterMaterial));

    if (userLabel) filterDescriptions.push(`Utente: ${userLabel}`);
    if (categoryLabel) filterDescriptions.push(`Categoria: ${categoryLabel}`);
    if (materialLabel) {
      filterDescriptions.push(`Materiale: ${materialLabel.code} - ${materialLabel.description}`);
    }

    if (filterDescriptions.length > 0) {
      doc.text(`Filtri: ${filterDescriptions.join(' · ')}`, 14, 35, { maxWidth: 265 });
    }

    const grouped = groupMovementsByOperator(movements);

    let startY = filterDescriptions.length > 0 ? 45 : 38;

    grouped.forEach((group, index) => {
      if (index > 0) {
        startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 12 : startY + 12;
      }

      if (startY > 180) {
        doc.addPage();
        startY = 18;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`${group.operator} — ${group.rows.length} operazioni`, 14, startY);

      autoTable(doc, {
        startY: startY + 5,
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
          'Cliente',
          'Autorizzato da',
          'Note',
        ]],
        body: group.rows.map((mov) => [
          formatDate(mov.date),
          formatTime(mov.date),
          formatMovType(mov.type),
          mov.materialCode || '',
          mov.materialDescription || '',
          mov.quantity ?? '',
          mov.previousQty ?? '',
          mov.newQty ?? '',
          formatReason(mov.reason),
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
          3: { cellWidth: 20 },
          4: { cellWidth: 44 },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 10, halign: 'center' },
          8: { cellWidth: 24 },
          9: { cellWidth: 26 },
          10: { cellWidth: 28 },
          11: { cellWidth: 42 },
        },
      });

      startY = doc.lastAutoTable?.finalY || startY;
    });

    doc.save(`${exportFileBaseName}_Dipendenti.pdf`);
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Icon name="assignment" className="ui-inline-icon" aria-hidden="true" /> Storico Movimenti</h1>
          <p className="page-subtitle">{movements.length} movimenti trovati</p>
        </div>

        <div className="btn-group">
          {canExportMovements && (
            <>
              <button
                className="btn btn-secondary"
                onClick={exportExcel}
                disabled={movements.length === 0}
              >
                <Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /> Excel
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportCSV}
                disabled={movements.length === 0}
              >
                 CSV
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportPDF}
                disabled={movements.length === 0}
              >
                <Icon name="upload_file" className="ui-inline-icon" aria-hidden="true" /> PDF
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportEmployeeCSV}
                disabled={movements.length === 0}
              >
                 Dipendenti CSV
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportEmployeePDF}
                disabled={movements.length === 0}
              >
                 Dipendenti PDF
              </button>
            </>
          )}

          {canEmptyHistory && (
            <button
              className="btn btn-danger"
              onClick={() => setConfirmEmptyHistory(true)}
              disabled={emptyingHistory}
            >
              <Icon name="delete" className="ui-inline-icon" aria-hidden="true" /> Svuota storico
            </button>
          )}
        </div>
      </div>

      {emptyHistoryError && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {emptyHistoryError}
        </div>
      )}

      {emptyHistoryResult && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            border: '1px solid var(--success-100)',
            background: 'var(--success-50)',
          }}
        >
          <div className="card-body" style={{ padding: 14 }}>
            <div className="text-sm" style={{ color: 'var(--success-700)', fontWeight: 800 }}>
              <Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /> Storico svuotato. Fatture eliminate: {emptyHistoryResult.invoicesDeleted}.
              File eliminati: {emptyHistoryResult.filesDeleted}.
            </div>

            {emptyHistoryResult.fileErrors?.length > 0 && (
              <div className="text-xs text-warning" style={{ marginTop: 6 }}>
                Alcuni file non sono stati eliminati dallo Storage:{' '}
                {emptyHistoryResult.fileErrors.join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /> Filtri di Ricerca</h3>

          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Azzera filtri
          </button>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group">
              <label>Dal:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Al:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
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
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
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
              <select
                value={filterMaterial}
                onChange={(e) => setFilterMaterial(e.target.value)}
              >
                <option value="">Tutti</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Utente / Operatore:</label>
              <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                <option value="">Tutti</option>

                {users.length > 0 && (
                  <optgroup label="Utenti app">
                    {users.map((u) => (
                      <option key={u.id} value={`user:${u.id}`}>
                        {u.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}

                {operatorOptions.length > 0 && (
                  <optgroup label="Operatori movimenti">
                    {operatorOptions.map((name) => (
                      <option key={name} value={`operator:${name}`}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                )}
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
                    <div className="empty-state-icon"><Icon name="assignment" className="ui-inline-icon" aria-hidden="true" /></div>
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
                  <td className="text-sm">{getOperatorName(mov)}</td>
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

      {confirmEmptyHistory && (
        <div
          className="modal-overlay confirm-dialog"
          onClick={() => !emptyingHistory && setConfirmEmptyHistory(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Svuotare lo storico?</h3>

              <button
                className="modal-close"
                onClick={() => setConfirmEmptyHistory(false)}
                disabled={emptyingHistory}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger"><Icon name="delete" className="ui-inline-icon" aria-hidden="true" /></div>

              <p className="confirm-message">
                Questa operazione eliminerà <strong>tutti i movimenti</strong>, i record delle
                <strong> fatture importate</strong> e i <strong>file originali</strong> salvati nel bucket Supabase <strong>fatture</strong>.
                <br />
                L’operazione non può essere annullata.
              </p>

              {emptyHistoryError && (
                <div className="login-error" style={{ marginTop: 16 }}>
                  {emptyHistoryError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmEmptyHistory(false)}
                disabled={emptyingHistory}
              >
                Annulla
              </button>

              <button
                className="btn btn-danger"
                onClick={handleEmptyHistory}
                disabled={emptyingHistory}
              >
                {emptyingHistory ? 'Svuotamento...' : 'Svuota tutto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

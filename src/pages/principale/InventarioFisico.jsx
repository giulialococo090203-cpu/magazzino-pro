import { useEffect, useMemo, useState } from 'react';
import { categoryStore, physicalInventoryStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDateTime(iso) {
  if (!iso) return '—';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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
  return `"${raw.replace(/"/g, '""')}"`;
}

function getStatusLabel(status) {
  const labels = {
    aperta: 'Aperta',
    chiusa: 'Chiusa',
    rettificata: 'Rettificata',
  };

  return labels[status] || status || '—';
}

export default function InventarioFisico() {
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || id || '—';

  const refreshSessions = async () => {
    try {
      setLoading(true);
      setError('');

      const [cats, allSessions] = await Promise.all([
        categoryStore.getAll(),
        physicalInventoryStore.getAllSessions(),
      ]);

      setCategories(Array.isArray(cats) ? cats : []);
      setSessions(Array.isArray(allSessions) ? allSessions : []);
    } catch (err) {
      console.error('Errore inventario fisico:', err);
      setError(err.message || 'Errore durante il caricamento inventario fisico.');
    } finally {
      setLoading(false);
    }
  };

  const reloadSelectedSession = async (id = selectedSession?.id) => {
    if (!id) return;

    const fresh = await physicalInventoryStore.getSessionById(id);
    setSelectedSession(fresh);
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const createSession = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const created = await physicalInventoryStore.createSession({
        title: title.trim() || '',
        category,
        notes,
        user,
      });

      await adminLogStore.create({
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
        entity: 'inventario_fisico',
        entityId: created.id,
        action: 'Creazione sessione inventario fisico',
        details: `Sessione ${created.number || created.title} creata con ${created.totalRows} righe.`,
      });

      setTitle('');
      setCategory('');
      setNotes('');
      setSelectedSession(created);
      setSuccess('Sessione inventario creata.');
      await refreshSessions();
    } catch (err) {
      console.error('Errore creazione inventario:', err);
      setError(err.message || 'Errore durante la creazione della sessione.');
    } finally {
      setSaving(false);
    }
  };

  const updateRowCount = async (row, countedQty, rowNotes) => {
    try {
      setError('');

      await physicalInventoryStore.updateCount(row.id, countedQty, rowNotes);
      await reloadSelectedSession(row.sessionId);
      await refreshSessions();
    } catch (err) {
      console.error('Errore conteggio:', err);
      setError(err.message || 'Errore durante il salvataggio del conteggio.');
    }
  };

  const applyRectifications = async () => {
    if (!selectedSession) return;

    const ok = window.confirm(
      'Confermi di applicare le rettifiche? Verranno creati movimenti di rettifica e aggiornate le giacenze.'
    );

    if (!ok) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updated = await physicalInventoryStore.applyRectifications(selectedSession.id, user);

      await adminLogStore.create({
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
        entity: 'inventario_fisico',
        entityId: selectedSession.id,
        action: 'Applicazione rettifiche inventario fisico',
        details: `Applicate rettifiche per sessione ${selectedSession.number || selectedSession.title}.`,
      });

      setSelectedSession(updated);
      setSuccess('Rettifiche applicate correttamente.');
      await refreshSessions();
    } catch (err) {
      console.error('Errore rettifiche inventario:', err);
      setError(err.message || 'Errore durante l’applicazione delle rettifiche.');
    } finally {
      setSaving(false);
    }
  };

  const closeSession = async () => {
    if (!selectedSession) return;

    const ok = window.confirm('Chiudere questa sessione senza applicare rettifiche?');

    if (!ok) return;

    try {
      setSaving(true);
      setError('');
      const updated = await physicalInventoryStore.closeSession(selectedSession.id);
      setSelectedSession(updated);
      await refreshSessions();
    } catch (err) {
      setError(err.message || 'Errore chiusura sessione.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (session) => {
    const ok = window.confirm(`Eliminare la sessione ${session.number || session.title}?`);

    if (!ok) return;

    try {
      await physicalInventoryStore.deleteSession(session.id);

      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
      }

      await refreshSessions();
    } catch (err) {
      setError(err.message || 'Errore eliminazione sessione.');
    }
  };

  const filteredRows = useMemo(() => {
    const rows = selectedSession?.rows || [];
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchSearch =
        !q ||
        String(row.code || '').toLowerCase().includes(q) ||
        String(row.description || '').toLowerCase().includes(q) ||
        String(row.brand || '').toLowerCase().includes(q) ||
        String(row.location || '').toLowerCase().includes(q);

      const matchDiff = !onlyDifferences || Number(row.difference || 0) !== 0;

      return matchSearch && matchDiff;
    });
  }, [selectedSession, search, onlyDifferences]);

  const buildExportRows = (session) => {
    return (session?.rows || []).map((row) => ({
      Codice: row.code || '',
      Descrizione: row.description || '',
      Marca: row.brand || '',
      Categoria: getCategoryName(row.category),
      Posizione: row.location || '',
      'Quantità teorica': row.theoreticalQty ?? 0,
      'Quantità contata': row.countedQty === '' ? '' : row.countedQty,
      Differenza: row.difference ?? 0,
      UM: row.unit || '',
      Contato: row.counted ? 'Sì' : 'No',
      Rettificato: row.rectified ? 'Sì' : 'No',
      Note: row.notes || '',
    }));
  };

  const exportExcel = (session) => {
    const rows = buildExportRows(session);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 40 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario Fisico');
    XLSX.writeFile(wb, `${sanitizeFileName(session.number || session.title)}.xlsx`);
  };

  const exportCSV = (session) => {
    const rows = buildExportRows(session);

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const lines = [
      headers.map(csvEscape).join(';'),
      ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(';')),
    ];

    downloadTextFile(
      `${sanitizeFileName(session.number || session.title)}.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    );
  };

  const exportPDF = (session) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(17);
    doc.setFont(undefined, 'bold');
    doc.text('Inventario fisico', 14, 18);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Sessione: ${session.number || '—'} · ${session.title}`, 14, 26);
    doc.text(`Stato: ${getStatusLabel(session.status)} · Creata: ${formatDateTime(session.createdAt)}`, 14, 32);
    doc.text(`Righe: ${session.totalRows} · Contate: ${session.countedRows} · Differenze: ${session.differences}`, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [
        [
          'Codice',
          'Descrizione',
          'Marca',
          'Posizione',
          'Teorica',
          'Contata',
          'Diff.',
          'UM',
          'Rett.',
          'Note',
        ],
      ],
      body: (session.rows || []).map((row) => [
        row.code || '',
        row.description || '',
        row.brand || '',
        row.location || '',
        row.theoreticalQty ?? 0,
        row.countedQty === '' ? '' : row.countedQty,
        row.difference ?? 0,
        row.unit || '',
        row.rectified ? 'Sì' : 'No',
        row.notes || '',
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    doc.save(`${sanitizeFileName(session.number || session.title)}.pdf`);
  };

  const canEditSelected = selectedSession && selectedSession.status === 'aperta';

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🧾 Inventario Fisico</h1>
          <p className="page-subtitle">
            Crea sessioni di conteggio, registra differenze e applica rettifiche automatiche
          </p>
        </div>

        <button className="btn btn-secondary" onClick={refreshSessions} disabled={loading}>
          ↻ Aggiorna
        </button>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            color: 'var(--success-700)',
            padding: '12px 20px',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 16,
            fontWeight: 700,
          }}
        >
          ✅ {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">➕ Nuova sessione inventario</h3>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group" style={{ minWidth: 260 }}>
              <label>Titolo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es: Inventario fine mese"
              />
            </div>

            <div className="filter-group">
              <label>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group" style={{ flex: 1, minWidth: 260 }}>
              <label>Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note opzionali..."
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={createSession}
              disabled={saving}
              style={{ alignSelf: 'end' }}
            >
              {saving ? 'Creo...' : 'Crea sessione'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Sessioni inventario</h3>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Titolo</th>
                  <th>Stato</th>
                  <th>Avanzamento</th>
                  <th>Diff.</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: 24 }} className="text-center text-muted">
                      Caricamento...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: 24 }} className="text-center text-muted">
                      Nessuna sessione inventario creata
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <strong>{session.number}</strong>
                      </td>
                      <td>{session.title}</td>
                      <td>{getStatusLabel(session.status)}</td>
                      <td>
                        {session.countedRows}/{session.totalRows}
                      </td>
                      <td>
                        <strong>{session.differences}</strong>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => physicalInventoryStore.getSessionById(session.id).then(setSelectedSession)}
                          >
                            👁️
                          </button>
                          <button
                            className="btn btn-sm btn-ghost text-danger"
                            onClick={() => deleteSession(session)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">ℹ️ Come funziona</h3>
          </div>

          <div className="card-body">
            <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
              Crea una sessione di inventario. Il sistema salva la quantità teorica attuale di ogni
              materiale. Durante il conteggio inserisci la quantità reale trovata a scaffale. Se ci
              sono differenze, puoi applicare le rettifiche: verranno creati movimenti di tipo
              rettifica e le giacenze saranno aggiornate automaticamente.
            </p>
          </div>
        </div>
      </div>

      {selectedSession && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">
                🧾 {selectedSession.number} — {selectedSession.title}
              </h3>
              <div className="text-sm text-muted">
                Stato: {getStatusLabel(selectedSession.status)} · Righe {selectedSession.totalRows} ·
                Contate {selectedSession.countedRows} · Differenze {selectedSession.differences}
              </div>
            </div>

            <div className="btn-group" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => exportExcel(selectedSession)}>
                📊 Excel
              </button>
              <button className="btn btn-secondary" onClick={() => exportCSV(selectedSession)}>
                🧾 CSV
              </button>
              <button className="btn btn-secondary" onClick={() => exportPDF(selectedSession)}>
                📄 PDF
              </button>

              {canEditSelected && selectedSession.differences > 0 && (
                <button className="btn btn-warning" onClick={applyRectifications} disabled={saving}>
                  Applica rettifiche
                </button>
              )}

              {canEditSelected && (
                <button className="btn btn-danger" onClick={closeSession} disabled={saving}>
                  Chiudi senza rettifiche
                </button>
              )}

              <button className="btn btn-ghost" onClick={() => setSelectedSession(null)}>
                Chiudi vista
              </button>
            </div>
          </div>

          <div className="card-body">
            <div className="filters-row">
              <div className="search-bar" style={{ flex: 1, maxWidth: 420 }}>
                <span className="search-bar-icon">🔍</span>
                <input
                  className="form-control"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca codice, descrizione, marca o posizione..."
                  style={{ paddingLeft: 40 }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={(e) => setOnlyDifferences(e.target.checked)}
                />
                Solo differenze
              </label>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Marca</th>
                  <th>Posizione</th>
                  <th style={{ textAlign: 'center' }}>Teorica</th>
                  <th style={{ textAlign: 'center' }}>Contata</th>
                  <th style={{ textAlign: 'center' }}>Diff.</th>
                  <th>UM</th>
                  <th>Note</th>
                  <th>Stato</th>
                  <th style={{ width: 130 }}>Azione</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: 36 }}>
                      <div className="empty-state">
                        <div className="empty-state-icon">🔎</div>
                        <div className="empty-state-title">Nessuna riga trovata</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <InventoryCountRow
                      key={row.id}
                      row={row}
                      disabled={!canEditSelected || row.rectified}
                      onSave={updateRowCount}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryCountRow({ row, disabled, onSave }) {
  const [countedQty, setCountedQty] = useState(row.countedQty === '' ? '' : String(row.countedQty));
  const [notes, setNotes] = useState(row.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCountedQty(row.countedQty === '' ? '' : String(row.countedQty));
    setNotes(row.notes || '');
  }, [row.id, row.countedQty, row.notes]);

  const diff = countedQty === '' ? row.difference : Number(countedQty || 0) - Number(row.theoreticalQty || 0);

  const save = async () => {
    setSaving(true);

    try {
      await onSave(row, Number(countedQty || 0), notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{row.code}</strong>
      </td>
      <td>{row.description}</td>
      <td>{row.brand || '—'}</td>
      <td>{row.location || '—'}</td>
      <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.theoreticalQty}</td>
      <td style={{ textAlign: 'center' }}>
        <input
          type="number"
          className="form-control"
          value={countedQty}
          onChange={(e) => setCountedQty(e.target.value)}
          min="0"
          disabled={disabled}
          style={{
            width: 90,
            textAlign: 'center',
            padding: '6px 8px',
            display: 'inline-block',
          }}
        />
      </td>
      <td
        style={{
          textAlign: 'center',
          fontWeight: 800,
          color:
            Number(diff || 0) === 0
              ? 'var(--success-700)'
              : Number(diff || 0) < 0
                ? 'var(--danger-700)'
                : 'var(--warning-700)',
        }}
      >
        {countedQty === '' && !row.counted ? '—' : diff}
      </td>
      <td>{row.unit}</td>
      <td>
        <input
          type="text"
          className="form-control"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          placeholder="Note..."
          style={{ minWidth: 150, padding: '6px 8px' }}
        />
      </td>
      <td>
        {row.rectified ? (
          <span className="status-badge status-disponibile">Rettificato</span>
        ) : row.counted ? (
          <span className="status-badge status-sotto_soglia">Contato</span>
        ) : (
          <span className="status-badge status-esaurito">Da contare</span>
        )}
      </td>
      <td>
        <button
          className="btn btn-sm btn-primary"
          onClick={save}
          disabled={disabled || countedQty === '' || saving}
        >
          {saving ? '...' : 'Salva'}
        </button>
      </td>
    </tr>
  );
}
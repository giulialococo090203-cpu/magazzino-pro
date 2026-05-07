import { useEffect, useMemo, useState } from 'react';
import { priceHistoryStore } from '../../data/store';

function formatCurrency(value = 0) {
  return Number(value || 0).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getVariation(current = 0, previous = 0) {
  const curr = Number(current || 0);
  const prev = Number(previous || 0);

  if (prev <= 0) return null;

  const deleteSingleRow = async (row) => {
    if (!row?.id) return;

    const label = `${row.code || ''} ${row.description || ''}`.trim() || 'questa riga';

    const firstConfirm = window.confirm(
      `Vuoi eliminare questa riga dallo storico prezzi?\n\n${label}`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'Conferma definitiva: questa riga verrà eliminata dallo storico prezzi e non potrà essere recuperata.'
    );

    if (!secondConfirm) return;

    try {
      setDeleting(true);

      await priceHistoryStore.delete(row.id);

      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));

      alert('Riga storico prezzi eliminata.');
    } catch (err) {
      console.error('Errore eliminazione riga storico prezzi:', err);
      alert(err?.message || 'Errore durante l’eliminazione della riga.');
    } finally {
      setDeleting(false);
    }
  };


  return ((curr - prev) / prev) * 100;
}

export default function StoricoPrezzi() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('');
  const [origin, setOrigin] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await priceHistoryStore.getAll();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore storico prezzi:', err);
      setError(err?.message || 'Errore durante il caricamento dello storico prezzi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const suppliers = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((row) => String(row.supplier || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const rowsWithVariation = useMemo(() => {
    const groups = {};

    rows.forEach((row) => {
      const key = String(row.code || row.materialId || '').trim() || 'senza-codice';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    Object.values(groups).forEach((items) => {
      items.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

      items.forEach((item, index) => {
        const previous = items[index + 1];

        item.previousPrice = previous?.netPrice || null;
        item.variation = previous ? getVariation(item.netPrice, previous.netPrice) : null;
      });
    });

    return Object.values(groups)
      .flat()
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rowsWithVariation.filter((row) => {
      const matchQuery =
        !q ||
        String(row.code || '').toLowerCase().includes(q) ||
        String(row.description || '').toLowerCase().includes(q) ||
        String(row.supplier || '').toLowerCase().includes(q) ||
        String(row.document || '').toLowerCase().includes(q);

      const matchSupplier = !supplier || String(row.supplier || '') === supplier;
      const matchOrigin = !origin || String(row.origin || '') === origin;

      return matchQuery && matchSupplier && matchOrigin;
    });
  }, [rowsWithVariation, query, supplier, origin]);

  const totals = useMemo(() => {
    const materialCodes = new Set(filteredRows.map((row) => row.code).filter(Boolean));
    const supplierNames = new Set(filteredRows.map((row) => row.supplier).filter(Boolean));
    const increases = filteredRows.filter((row) => Number(row.variation || 0) > 0).length;

    return {
      rows: filteredRows.length,
      materials: materialCodes.size,
      suppliers: supplierNames.size,
      increases,
    };
  }, [filteredRows]);

  const filteredIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);

  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => filteredIds.includes(id)),
    [selectedIds, filteredIds]
  );

  const allVisibleSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleRowSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...filteredIds])]);
  };

  const deleteSelectedRows = async () => {
    const idsToDelete = selectedVisibleIds;

    if (idsToDelete.length === 0) {
      alert('Seleziona almeno una riga di storico prezzi da eliminare.');
      return;
    }

    const firstConfirm = window.confirm(
      `Vuoi eliminare ${idsToDelete.length} righe dallo storico prezzi?\n\n` +
        'Questa operazione serve solo per pulizia dati.'
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `Conferma definitiva:\n\n` +
        `stai per eliminare ${idsToDelete.length} righe dallo storico prezzi.\n\n` +
        'L’operazione non può essere annullata.'
    );

    if (!secondConfirm) return;

    try {
      setDeleting(true);

      await priceHistoryStore.deleteMany(idsToDelete);

      setRows((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));
      setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));

      alert(`Eliminate ${idsToDelete.length} righe dallo storico prezzi.`);
    } catch (err) {
      console.error('Errore eliminazione storico prezzi:', err);
      alert(err?.message || 'Errore durante l’eliminazione dello storico prezzi.');
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><span className="ui-title-icon material-symbols-rounded">trending_up</span>Storico Prezzi</h1>
          <p className="page-subtitle">
            Elenco compatto dei prezzi registrati da fatture e inserimenti manuali.
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? 'Aggiorno...' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon blue">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Righe</div>
            <div className="kpi-value">{totals.rows}</div>
            <div className="kpi-detail">prezzi filtrati</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali</div>
            <div className="kpi-value">{totals.materials}</div>
            <div className="kpi-detail">codici diversi</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🏭</div>
          <div className="kpi-content">
            <div className="kpi-label">Fornitori</div>
            <div className="kpi-value">{totals.suppliers}</div>
            <div className="kpi-detail">fornitori filtrati</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon yellow">📈</div>
          <div className="kpi-content">
            <div className="kpi-label">Aumenti</div>
            <div className="kpi-value">{totals.increases}</div>
            <div className="kpi-detail">prezzi aumentati</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🔍 Filtri</h3>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group" style={{ minWidth: 280, flex: 1 }}>
              <label>Cerca:</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Codice, descrizione, fornitore o documento..."
              />
            </div>

            <div className="filter-group">
              <label>Fornitore:</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">Tutti</option>
                {suppliers.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Origine:</label>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option value="">Tutte</option>
                <option value="fattura">Fattura</option>
                <option value="manuale">Manuale</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!loading && filteredRows.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            border: '1px solid var(--gray-200)',
            background: 'var(--gray-50)',
          }}
        >
          <div
            className="card-body"
            style={{
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div className="text-sm" style={{ fontWeight: 900 }}>
              {selectedVisibleIds.length} righe selezionate su {filteredRows.length} visibili
            </div>

            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" onClick={toggleAllVisible}>
                {allVisibleSelected ? 'Deseleziona tutte' : 'Seleziona tutte'}
              </button>

              <button
                className="btn btn-sm btn-danger"
                onClick={deleteSelectedRows}
                disabled={selectedVisibleIds.length === 0 || deleting}
              >
                {deleting ? 'Eliminazione...' : '🗑️ Elimina selezionate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  title="Seleziona tutte le righe visibili"
                />
              </th>
              <th style={{ width: 80, textAlign: 'center' }}>Azioni</th>
              <th style={{ whiteSpace: 'nowrap' }}>Data</th>
              <th>Codice</th>
              <th>Descrizione</th>
              <th>Fornitore</th>
              <th>Prezzo netto</th>
              <th>Prec.</th>
              <th>Var.</th>
              <th>Qtà</th>
              <th>Origine</th>
              <th>Documento</th>
              <th>Utente</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="13" style={{ padding: 30 }}>
                  <div className="empty-state-text">Caricamento storico prezzi...</div>
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: 34 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📈</div>
                    <div className="empty-state-title">Nessuno storico disponibile</div>
                    <div className="empty-state-text">
                      Importa una fattura o fai un inserimento manuale con prezzo netto.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const variation = row.variation;

                return (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                      />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost text-danger"
                        onClick={() => deleteSingleRow(row)}
                        disabled={deleting}
                        title="Elimina riga"
                      >
                        🗑️
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(row.date || row.createdAt)}</td>
                    <td><strong>{row.code || '—'}</strong></td>
                    <td className="text-sm">{row.description || '—'}</td>
                    <td><strong>{row.supplier || '—'}</strong></td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(row.netPrice)}</td>
                    <td>{row.previousPrice ? formatCurrency(row.previousPrice) : '—'}</td>
                    <td
                      style={{
                        fontWeight: 900,
                        color:
                          variation > 0
                            ? 'var(--danger-600)'
                            : variation < 0
                              ? 'var(--success-600)'
                              : 'var(--gray-500)',
                      }}
                    >
                      {variation === null || variation === undefined
                        ? '—'
                        : `${variation > 0 ? '+' : ''}${variation.toFixed(1)}%`}
                    </td>
                    <td>{row.quantity}</td>
                    <td>{row.origin || '—'}</td>
                    <td
                      className="text-sm"
                      style={{
                        maxWidth: 220,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={row.document || ''}
                    >
                      {row.document || '—'}
                    </td>
                    <td
                      className="text-sm"
                      style={{
                        maxWidth: 150,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={row.userName || ''}
                    >
                      {row.userName || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

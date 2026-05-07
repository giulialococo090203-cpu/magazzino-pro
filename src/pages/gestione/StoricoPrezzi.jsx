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

function getPriceStats(rows = []) {
  const prices = rows
    .map((row) => Number(row.netPrice || 0))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    return {
      last: 0,
      min: 0,
      max: 0,
      avg: 0,
      variation: 0,
    };
  }

  const last = prices[0] || 0;
  const previous = prices[1] || 0;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const variation = previous > 0 ? ((last - previous) / previous) * 100 : 0;

  return { last, min, max, avg, variation };
}

export default function StoricoPrezzi() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('');
  const [origin, setOrigin] = useState('');

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
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
  }, [rows, query, supplier, origin]);

  const groupedByCode = useMemo(() => {
    const groups = {};

    filteredRows.forEach((row) => {
      const key = row.code || row.materialId || 'Senza codice';
      if (!groups[key]) {
        groups[key] = {
          code: row.code,
          description: row.description,
          rows: [],
        };
      }

      groups[key].rows.push(row);
    });

    return Object.values(groups).map((group) => {
      const stats = getPriceStats(group.rows);

      return {
        ...group,
        stats,
        count: group.rows.length,
        suppliers: [...new Set(group.rows.map((row) => row.supplier).filter(Boolean))],
      };
    });
  }, [filteredRows]);

  const totals = useMemo(() => {
    return {
      records: filteredRows.length,
      materials: groupedByCode.length,
      suppliers: new Set(filteredRows.map((row) => row.supplier).filter(Boolean)).size,
    };
  }, [filteredRows, groupedByCode]);

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Storico Prezzi</h1>
          <p className="page-subtitle">
            Monitora prezzi netti, fornitori, variazioni e ultimi acquisti dei materiali.
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
          <div className="kpi-icon blue">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali</div>
            <div className="kpi-value">{totals.materials}</div>
            <div className="kpi-detail">con storico prezzo</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🏭</div>
          <div className="kpi-content">
            <div className="kpi-label">Fornitori</div>
            <div className="kpi-value">{totals.suppliers}</div>
            <div className="kpi-detail">presenti nello storico</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">📈</div>
          <div className="kpi-content">
            <div className="kpi-label">Righe prezzo</div>
            <div className="kpi-value">{totals.records}</div>
            <div className="kpi-detail">acquisti registrati</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🔍 Filtri storico</h3>
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

      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state-text">Caricamento storico prezzi...</div>
          </div>
        </div>
      ) : groupedByCode.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">Nessuno storico disponibile</div>
              <div className="empty-state-text">
                Importa una fattura o fai un inserimento manuale con prezzo netto.
              </div>
            </div>
          </div>
        </div>
      ) : (
        groupedByCode.map((group) => (
          <div className="card" key={group.code || group.description} style={{ marginBottom: 18 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  {group.code || 'Senza codice'} · {group.description || 'Senza descrizione'}
                </h3>
                <p className="text-sm text-muted">
                  {group.count} prezzi registrati · Fornitori: {group.suppliers.join(', ') || '—'}
                </p>
              </div>
            </div>

            <div className="card-body">
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-card">
                  <div className="kpi-content">
                    <div className="kpi-label">Ultimo prezzo</div>
                    <div className="kpi-value">{formatCurrency(group.stats.last)}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-content">
                    <div className="kpi-label">Prezzo minimo</div>
                    <div className="kpi-value">{formatCurrency(group.stats.min)}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-content">
                    <div className="kpi-label">Prezzo massimo</div>
                    <div className="kpi-value">{formatCurrency(group.stats.max)}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-content">
                    <div className="kpi-label">Variazione ultimo</div>
                    <div
                      className="kpi-value"
                      style={{
                        color:
                          group.stats.variation > 0
                            ? 'var(--danger-600)'
                            : group.stats.variation < 0
                              ? 'var(--success-600)'
                              : 'var(--gray-800)',
                      }}
                    >
                      {group.stats.variation.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Fornitore</th>
                      <th>Prezzo netto</th>
                      <th>Quantità</th>
                      <th>Origine</th>
                      <th>Documento</th>
                      <th>Utente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.date || row.createdAt)}</td>
                        <td><strong>{row.supplier || '—'}</strong></td>
                        <td style={{ fontWeight: 900 }}>{formatCurrency(row.netPrice)}</td>
                        <td>{row.quantity}</td>
                        <td>{row.origin || '—'}</td>
                        <td>{row.document || '—'}</td>
                        <td>{row.userName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

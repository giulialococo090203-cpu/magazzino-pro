import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  materialStore,
  movementStore,
  priceHistoryStore,
  adminLogStore,
} from '../../data/store';
import { useAuth } from '../../App';

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

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getPeriodRange(period) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'mese') {
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'bimestre') {
    start.setMonth(start.getMonth() - 2);
  } else if (period === 'semestre') {
    start.setMonth(start.getMonth() - 6);
  } else if (period === 'anno') {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setMonth(start.getMonth() - 1);
  }

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getMovementDate(movement) {
  return movement.date || movement.createdAt || movement.dataMovimento || '';
}

function isWithinRange(value, start, end) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

export default function RendicontazioneEconomica() {
  const { user } = useAuth();

  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [prices, setPrices] = useState([]);
  const [period, setPeriod] = useState('mese');
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');

      const [mats, movs, priceRows] = await Promise.all([
        materialStore.getAll(),
        movementStore.getAll(),
        priceHistoryStore.getAll(),
      ]);

      setMaterials(Array.isArray(mats) ? mats : []);
      setMovements(Array.isArray(movs) ? movs : []);
      setPrices(Array.isArray(priceRows) ? priceRows : []);

      setSuccess(
        `Dati aggiornati: ${Array.isArray(mats) ? mats.length : 0} materiali, ` +
          `${Array.isArray(movs) ? movs.length : 0} movimenti, ` +
          `${Array.isArray(priceRows) ? priceRows.length : 0} prezzi.`
      );

      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      console.error('Errore rendicontazione economica:', err);
      setError(err?.message || 'Errore durante il caricamento della rendicontazione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [String(material.id), material])),
    [materials]
  );

  const suppliers = useMemo(() => {
    return [
      ...new Set(
        [
          ...materials.map((m) => String(m.supplier || '').trim()),
          ...prices.map((p) => String(p.supplier || '').trim()),
        ].filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [materials, prices]);

  const report = useMemo(() => {
    const { start, end } = getPeriodRange(period);

    const periodPrices = prices.filter((price) =>
      isWithinRange(price.date || price.createdAt, start, end)
    );

    const filteredPrices = periodPrices.filter((price) => {
      if (!supplier) return true;
      return String(price.supplier || '').trim() === String(supplier || '').trim();
    });

    const stockValue = materials
      .filter((material) => !supplier || String(material.supplier || '').trim() === String(supplier || '').trim())
      .reduce(
        (sum, material) =>
          sum + Number(material.quantity || 0) * Number(material.netPrice || 0),
        0
      );

    const entriesValue = filteredPrices.reduce(
      (sum, row) => sum + Number(row.netPrice || 0) * Number(row.quantity || 0),
      0
    );

    const supplierGroups = {};

    filteredPrices.forEach((row) => {
      const key = String(row.supplier || '').trim() || 'Senza fornitore';

      if (!supplierGroups[key]) {
        supplierGroups[key] = {
          supplier: key,
          invoices: 0,
          quantity: 0,
          value: 0,
          rows: 0,
        };
      }

      supplierGroups[key].rows += 1;
      supplierGroups[key].quantity += Number(row.quantity || 0);
      supplierGroups[key].value += Number(row.netPrice || 0) * Number(row.quantity || 0);

      const origin = String(row.origin || '').toLowerCase();
      const document = String(row.document || '').toLowerCase();

      if (
        origin.includes('fattura') ||
        origin.includes('import') ||
        document.includes('fattura') ||
        document.includes('.pdf')
      ) {
        supplierGroups[key].invoices += 1;
      }
    });

    const materialGroups = {};

    filteredPrices.forEach((row) => {
      const key = `${String(row.code || '').trim()}|${String(row.supplier || '').trim()}` || row.id;

      if (!materialGroups[key]) {
        materialGroups[key] = {
          code: row.code || '',
          description: row.description || '',
          supplier: row.supplier || '',
          quantity: 0,
          value: 0,
          lastPrice: 0,
          rows: 0,
        };
      }

      materialGroups[key].rows += 1;
      materialGroups[key].quantity += Number(row.quantity || 0);
      materialGroups[key].value += Number(row.netPrice || 0) * Number(row.quantity || 0);
      materialGroups[key].lastPrice = Number(row.netPrice || 0);
    });

    const supplierRows = Object.values(supplierGroups).sort((a, b) => b.value - a.value);
    const materialRows = Object.values(materialGroups).sort((a, b) => b.value - a.value);

    return {
      start,
      end,
      stockValue,
      entriesValue,
      exitsValue: 0,
      netBalance: entriesValue,
      movementsCount: filteredPrices.length,
      entriesCount: filteredPrices.length,
      exitsCount: 0,
      supplierRows,
      materialRows,
      filteredMovements: [],
      filteredPrices,
    };
  }, [period, supplier, prices, materials]);

  const exportExcel = async () => {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      {
        Periodo: period,
        Dal: formatDate(report.start),
        Al: formatDate(report.end),
        Fornitore: supplier || 'Tutti',
        'Valore carichi': Number(report.entriesValue || 0),
        'Valore uscite stimato': Number(report.exitsValue || 0),
        'Saldo stimato': Number(report.netBalance || 0),
        'Valore stock attuale': Number(report.stockValue || 0),
        Movimenti: report.movementsCount,
      },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');

    const suppliersSheet = XLSX.utils.json_to_sheet(
      report.supplierRows.map((row) => ({
        Fornitore: row.supplier,
        Righe: row.rows,
        Fatture: row.invoices,
        Quantità: row.quantity,
        Valore: Number(row.value || 0),
      }))
    );
    XLSX.utils.book_append_sheet(workbook, suppliersSheet, 'Fornitori');

    const materialsSheet = XLSX.utils.json_to_sheet(
      report.materialRows.map((row) => ({
        Codice: row.code,
        Descrizione: row.description,
        Fornitore: row.supplier,
        Righe: row.rows,
        Quantità: row.quantity,
        'Ultimo prezzo': Number(row.lastPrice || 0),
        Valore: Number(row.value || 0),
      }))
    );
    XLSX.utils.book_append_sheet(workbook, materialsSheet, 'Materiali');

    XLSX.writeFile(
      workbook,
      `Rendicontazione_Economica_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    try {
      await adminLogStore.create({
        action: 'Esportazione rendicontazione economica',
        entity: 'rendicontazione',
        details: `Esportata rendicontazione economica periodo ${period}.`,
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
      });
    } catch (err) {
      console.warn('Log esportazione rendicontazione non salvato:', err);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">💶 Rendicontazione Economica</h1>
          <p className="page-subtitle">
            Analisi economica per periodo: carichi, uscite, stock, fornitori e materiali.
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
            ↻ Aggiorna
          </button>
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            📊 Esporta Excel
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {success && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            color: 'var(--success-700)',
            fontWeight: 800,
          }}
        >
          ✅ {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Filtri rendicontazione</h3>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group">
              <label>Periodo:</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="mese">Mensile</option>
                <option value="bimestre">Bimestrale</option>
                <option value="semestre">Semestrale</option>
                <option value="anno">Annuale</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Fornitore:</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">Tutti</option>
                {suppliers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-muted" style={{ fontWeight: 700 }}>
              Dal {formatDate(report.start)} al {formatDate(report.end)}
              {' · '}
              Prezzi nel periodo: {report.filteredPrices.length}
              {' · '}
              Movimenti nel periodo: {report.filteredMovements.length}
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon green">📥</div>
          <div className="kpi-content">
            <div className="kpi-label">Valore carichi</div>
            <div className="kpi-value">{formatCurrency(report.entriesValue)}</div>
            <div className="kpi-detail">da storico economico permanente</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red">📤</div>
          <div className="kpi-content">
            <div className="kpi-label">Valore uscite stimato</div>
            <div className="kpi-value">{formatCurrency(report.exitsValue)}</div>
            <div className="kpi-detail">quantità uscita x prezzo netto</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Valore stock attuale</div>
            <div className="kpi-value">{formatCurrency(report.stockValue)}</div>
            <div className="kpi-detail">giacenza x prezzo netto</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🔁</div>
          <div className="kpi-content">
            <div className="kpi-label">Righe economiche periodo</div>
            <div className="kpi-value">{report.movementsCount}</div>
            <div className="kpi-detail">
              {report.filteredPrices.length} righe registrate
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🏭 Spesa per fornitore</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fornitore</th>
                <th>Righe</th>
                <th>Fatture</th>
                <th>Quantità caricata</th>
                <th>Valore</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5">Caricamento...</td>
                </tr>
              ) : report.supplierRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <div className="empty-state-icon">💶</div>
                      <div className="empty-state-title">Nessun dato economico nel periodo</div>
                    </div>
                  </td>
                </tr>
              ) : (
                report.supplierRows.map((row) => (
                  <tr key={row.supplier}>
                    <td>
                      <strong>{row.supplier}</strong>
                    </td>
                    <td>{row.rows}</td>
                    <td>{row.invoices}</td>
                    <td>{row.quantity}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(row.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📌 Materiali con maggiore impatto economico</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Descrizione</th>
                <th>Fornitore</th>
                <th>Righe</th>
                <th>Quantità</th>
                <th>Ultimo prezzo</th>
                <th>Valore</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">Caricamento...</td>
                </tr>
              ) : report.materialRows.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <div className="empty-state-icon">📌</div>
                      <div className="empty-state-title">Nessun materiale nel periodo</div>
                    </div>
                  </td>
                </tr>
              ) : (
                report.materialRows.slice(0, 80).map((row) => (
                  <tr key={`${row.code}-${row.supplier}`}>
                    <td>
                      <strong>{row.code || '—'}</strong>
                    </td>
                    <td className="text-sm">{row.description || '—'}</td>
                    <td className="text-sm">{row.supplier || '—'}</td>
                    <td>{row.rows}</td>
                    <td>{row.quantity}</td>
                    <td>{formatCurrency(row.lastPrice)}</td>
                    <td style={{ fontWeight: 900 }}>{formatCurrency(row.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

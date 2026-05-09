import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  materialStore,
  movementStore,
  priceHistoryStore,
  adminLogStore,
} from '../../data/store';
import { useAuth } from '../../App';
import Icon from '../../components/Icon';
import FaIcon from '../../components/FaIcon';

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

function getPeriodRange(period, year, month) {
  const safeYear = Number(year || new Date().getFullYear());
  const safeMonth = Number(month || 0);

  let start;
  let end;

  if (period === 'mese') {
    start = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);
    end = new Date(safeYear, safeMonth + 1, 1, 0, 0, 0, 0);
  } else if (period === 'bimestre') {
    start = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);
    end = new Date(safeYear, safeMonth + 2, 1, 0, 0, 0, 0);
  } else if (period === 'semestre') {
    start = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);
    end = new Date(safeYear, safeMonth + 6, 1, 0, 0, 0, 0);
  } else if (period === 'anno') {
    start = new Date(safeYear, 0, 1, 0, 0, 0, 0);
    end = new Date(safeYear + 1, 0, 1, 0, 0, 0, 0);
  } else {
    start = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);
    end = new Date(safeYear, safeMonth + 1, 1, 0, 0, 0, 0);
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
  return date >= start && date < end;
}

export default function RendicontazioneEconomica() {
  const { user } = useAuth();

  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [prices, setPrices] = useState([]);
  const [period, setPeriod] = useState('mese');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');

      const { start, end } = getPeriodRange(period, selectedYear, selectedMonth);
      const endInclusive = new Date(end.getTime() - 1);

      const dateFrom = start.toISOString().slice(0, 10);
      const dateTo = endInclusive.toISOString().slice(0, 10);

      const [mats, movs] = await Promise.all([
        materialStore.getAll(),
        movementStore.getFiltered({
          dateFrom,
          dateTo,
        }),
      ]);

      setMaterials(Array.isArray(mats) ? mats : []);
      setMovements(Array.isArray(movs) ? movs : []);
      setPrices([]);

      setSuccess(
        `Dati aggiornati: ${Array.isArray(mats) ? mats.length : 0} materiali, ` +
          `${Array.isArray(movs) ? movs.length : 0} movimenti nel periodo.`
      );

      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      console.error('Errore rendicontazione economica:', err);
      setError(err?.message || 'Errore durante il caricamento della rendicontazione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [period, selectedYear, selectedMonth]);

  const materialById = useMemo(
    () => new Map(materials.map((material) => [String(material.id), material])),
    [materials]
  );

  const suppliers = useMemo(() => {
    return [
      ...new Set(
        [
          ...materials.map((m) => String(m.supplier || '').trim()),
          ...movements.map((m) => String(m.supplier || m.fornitore || '').trim()),
          ...prices.map((p) => String(p.supplier || '').trim()),
        ].filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [materials, movements, prices]);

  const report = useMemo(() => {
    const { start, end } = getPeriodRange(period, selectedYear, selectedMonth);

    const periodMovements = movements.filter((movement) =>
      isWithinRange(getMovementDate(movement), start, end)
    );

    const filteredMovements = periodMovements.filter((movement) => {
      const material = materialById.get(String(movement.materialId));
      const movementSupplier = String(
        movement.supplier ||
          movement.fornitore ||
          material?.supplier ||
          ''
      ).trim();

      if (!supplier) return true;

      return movementSupplier === String(supplier || '').trim();
    });

    const stockValue = materials
      .filter((material) => !supplier || String(material.supplier || '').trim() === String(supplier || '').trim())
      .reduce(
        (sum, material) =>
          sum + Number(material.quantity || 0) * Number(material.netPrice || 0),
        0
      );

    let entriesValue = 0;
    let exitsValue = 0;
    let entriesCount = 0;
    let exitsCount = 0;

    const supplierGroups = {};
    const materialGroups = {};

    filteredMovements.forEach((movement) => {
      const material = materialById.get(String(movement.materialId));
      const code = movement.materialCode || material?.code || '';
      const description = movement.materialDescription || material?.description || '';
      const movementSupplier = String(
        movement.supplier ||
          movement.fornitore ||
          material?.supplier ||
          'Senza fornitore'
      ).trim() || 'Senza fornitore';

      const quantity = Number(movement.quantity || 0);
      const netPrice = Number(material?.netPrice || 0);
      const value = quantity * netPrice;
      const type = String(movement.type || '').toLowerCase();

      if (type === 'entrata' || type === 'reintegro') {
        entriesValue += value;
        entriesCount += 1;
      }

      if (type === 'uscita') {
        exitsValue += value;
        exitsCount += 1;
      }

      if (!supplierGroups[movementSupplier]) {
        supplierGroups[movementSupplier] = {
          supplier: movementSupplier,
          invoices: 0,
          quantity: 0,
          value: 0,
          rows: 0,
        };
      }

      supplierGroups[movementSupplier].rows += 1;
      supplierGroups[movementSupplier].quantity += quantity;

      if (type === 'entrata' || type === 'reintegro') {
        supplierGroups[movementSupplier].value += value;
      }

      const materialKey = `${code}|${movementSupplier}`;

      if (!materialGroups[materialKey]) {
        materialGroups[materialKey] = {
          code,
          description,
          supplier: movementSupplier,
          quantity: 0,
          value: 0,
          lastPrice: netPrice,
          rows: 0,
        };
      }

      materialGroups[materialKey].rows += 1;
      materialGroups[materialKey].quantity += quantity;
      materialGroups[materialKey].value += value;
      materialGroups[materialKey].lastPrice = netPrice;
    });

    const supplierRows = Object.values(supplierGroups).sort((a, b) => b.value - a.value);
    const materialRows = Object.values(materialGroups).sort((a, b) => b.value - a.value);

    return {
      start,
      end,
      stockValue,
      entriesValue,
      exitsValue,
      netBalance: entriesValue - exitsValue,
      movementsCount: filteredMovements.length,
      entriesCount,
      exitsCount,
      supplierRows,
      materialRows,
      filteredMovements,
      filteredPrices: [],
    };
  }, [period, selectedYear, selectedMonth, supplier, movements, materials, materialById]);

  const monthOptions = [
    { value: 0, label: 'Gennaio' },
    { value: 1, label: 'Febbraio' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Aprile' },
    { value: 4, label: 'Maggio' },
    { value: 5, label: 'Giugno' },
    { value: 6, label: 'Luglio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Settembre' },
    { value: 9, label: 'Ottobre' },
    { value: 10, label: 'Novembre' },
    { value: 11, label: 'Dicembre' },
  ];

  const yearOptions = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);

  const exportExcel = async () => {
    const workbook = XLSX.utils.book_new();

    const selectedSupplierLabel = supplier || 'Tutti i fornitori';

    const summaryRows = [
      {
        Periodo: period,
        Dal: formatDate(report.start),
        Al: formatDate(report.end),
        Fornitore: selectedSupplierLabel,
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

    const sortedMaterialRows = [...report.materialRows].sort((a, b) => {
      const supplierCompare = String(a.supplier || 'Senza fornitore').localeCompare(
        String(b.supplier || 'Senza fornitore'),
        'it'
      );

      if (supplierCompare !== 0) return supplierCompare;

      return String(a.description || a.code || '').localeCompare(
        String(b.description || b.code || ''),
        'it'
      );
    });

    const materialRowsForExcel = [];

    if (supplier) {
      sortedMaterialRows.forEach((row) => {
        materialRowsForExcel.push({
          Fornitore: row.supplier || 'Senza fornitore',
          Codice: row.code,
          Descrizione: row.description,
          Righe: row.rows,
          Quantità: row.quantity,
          'Ultimo prezzo': Number(row.lastPrice || 0),
          Valore: Number(row.value || 0),
        });
      });
    } else {
      const groupedBySupplier = sortedMaterialRows.reduce((acc, row) => {
        const supplierName = String(row.supplier || '').trim() || 'Senza fornitore';

        if (!acc[supplierName]) {
          acc[supplierName] = [];
        }

        acc[supplierName].push(row);
        return acc;
      }, {});

      Object.entries(groupedBySupplier)
        .sort(([a], [b]) => a.localeCompare(b, 'it'))
        .forEach(([supplierName, rows]) => {
          const supplierTotal = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
          const supplierQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
          const supplierRowCount = rows.reduce((sum, row) => sum + Number(row.rows || 0), 0);

          materialRowsForExcel.push({
            Fornitore: supplierName,
            Codice: '',
            Descrizione: `TOTALE ${supplierName}`,
            Righe: supplierRowCount,
            Quantità: supplierQuantity,
            'Ultimo prezzo': '',
            Valore: Number(supplierTotal || 0),
          });

          rows.forEach((row) => {
            materialRowsForExcel.push({
              Fornitore: supplierName,
              Codice: row.code,
              Descrizione: row.description,
              Righe: row.rows,
              Quantità: row.quantity,
              'Ultimo prezzo': Number(row.lastPrice || 0),
              Valore: Number(row.value || 0),
            });
          });

          materialRowsForExcel.push({
            Fornitore: '',
            Codice: '',
            Descrizione: '',
            Righe: '',
            Quantità: '',
            'Ultimo prezzo': '',
            Valore: '',
          });
        });
    }

    const materialsSheet = XLSX.utils.json_to_sheet(materialRowsForExcel);
    XLSX.utils.book_append_sheet(workbook, materialsSheet, 'Materiali per fornitore');

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
          <h1 className="page-title"><FaIcon name="euro" className="ui-title-icon" />Rendicontazione Economica</h1>
          <p className="page-subtitle">
            Analisi economica per periodo: carichi, uscite, stock, fornitori e materiali.
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
            ↻ Aggiorna
          </button>
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            <Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /> Esporta Excel
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
          <Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /> {success}
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
              <label>Anno:</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {period !== 'anno' && (
              <div className="filter-group">
                <label>Da mese:</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              Periodo: {formatDate(report.start)} → {formatDate(report.end)}
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
          <div className="kpi-icon green"><Icon name="move_to_inbox" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valore carichi</div>
            <div className="kpi-value">{formatCurrency(report.entriesValue)}</div>
            <div className="kpi-detail">da storico economico permanente</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red"><Icon name="outbox" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valore uscite stimato</div>
            <div className="kpi-value">{formatCurrency(report.exitsValue)}</div>
            <div className="kpi-detail">quantità uscita x prezzo netto</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
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
          <h3 className="card-title"><Icon name="factory" className="ui-inline-icon" aria-hidden="true" /> Spesa per fornitore</h3>
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
                      <div className="empty-state-icon"><Icon name="euro" className="ui-inline-icon" aria-hidden="true" /></div>
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
          <h3 className="card-title"><Icon name="push_pin" className="ui-section-icon" aria-hidden="true" />Materiali con maggiore impatto economico</h3>
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
                      <div className="empty-state-icon"><Icon name="push_pin" className="ui-inline-icon" aria-hidden="true" /></div>
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

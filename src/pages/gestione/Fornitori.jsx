// ============================================================
// FORNITORI.JSX - Monitoraggio fornitori da materiali e movimenti
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { materialStore, movementStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';

function normalizeSupplier(value = '') {
  const text = String(value || '').trim();
  return text || 'Senza fornitore';
}

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

function sanitizeSheetName(value = '') {
  return String(value || 'Fornitore')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .slice(0, 31)
    .trim() || 'Fornitore';
}

export default function Fornitori() {
  const { user } = useAuth();

  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [mats, movs] = await Promise.all([
        materialStore.getAll(),
        movementStore.getAll(),
      ]);

      setMaterials(Array.isArray(mats) ? mats : []);
      setMovements(Array.isArray(movs) ? movs : []);
    } catch (err) {
      console.error('Errore caricamento fornitori:', err);
      setError(err?.message || 'Errore durante il caricamento dei fornitori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const supplierRows = useMemo(() => {
    const materialById = new Map(materials.map((m) => [String(m.id), m]));

    const groups = {};

    materials.forEach((material) => {
      const supplier = normalizeSupplier(material.supplier);

      if (!groups[supplier]) {
        groups[supplier] = {
          supplier,
          materials: [],
          movements: [],
          materialCount: 0,
          totalQuantity: 0,
          stockValue: 0,
          entriesQuantity: 0,
          exitsQuantity: 0,
          invoiceEntries: 0,
          lastMovementAt: null,
        };
      }

      groups[supplier].materials.push(material);
      groups[supplier].materialCount += 1;
      groups[supplier].totalQuantity += Number(material.quantity || 0);
      groups[supplier].stockValue +=
        Number(material.quantity || 0) * Number(material.netPrice || 0);
    });

    movements.forEach((movement) => {
      const material = materialById.get(String(movement.materialId));
      const supplier = normalizeSupplier(material?.supplier);

      if (!groups[supplier]) {
        groups[supplier] = {
          supplier,
          materials: [],
          movements: [],
          materialCount: 0,
          totalQuantity: 0,
          stockValue: 0,
          entriesQuantity: 0,
          exitsQuantity: 0,
          invoiceEntries: 0,
          lastMovementAt: null,
        };
      }

      groups[supplier].movements.push(movement);

      const qty = Number(movement.quantity || 0);
      const type = String(movement.type || '').toLowerCase();
      const reason = String(movement.reason || '').toLowerCase();
      const notes = String(movement.notes || '').toLowerCase();

      if (type === 'entrata') groups[supplier].entriesQuantity += qty;
      if (type === 'uscita') groups[supplier].exitsQuantity += qty;

      if (
        reason.includes('fattura') ||
        reason.includes('importazione') ||
        notes.includes('fattura') ||
        notes.includes('importazione')
      ) {
        groups[supplier].invoiceEntries += 1;
      }

      const movementDate = movement.date || movement.createdAt;
      if (
        movementDate &&
        (!groups[supplier].lastMovementAt ||
          new Date(movementDate) > new Date(groups[supplier].lastMovementAt))
      ) {
        groups[supplier].lastMovementAt = movementDate;
      }
    });

    return Object.values(groups)
      .map((row) => ({
        ...row,
        movementCount: row.movements.length,
      }))
      .sort((a, b) => {
        if (b.stockValue !== a.stockValue) return b.stockValue - a.stockValue;
        return a.supplier.localeCompare(b.supplier);
      });
  }, [materials, movements]);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return supplierRows.filter((row) => {
      if (!q) return true;

      return (
        row.supplier.toLowerCase().includes(q) ||
        row.materials.some((m) =>
          `${m.code || ''} ${m.description || ''} ${m.brand || ''}`
            .toLowerCase()
            .includes(q)
        )
      );
    });
  }, [supplierRows, query]);

  const selectedSupplierData = useMemo(() => {
    if (!selectedSupplier) return null;
    return supplierRows.find((row) => row.supplier === selectedSupplier) || null;
  }, [selectedSupplier, supplierRows]);

  const totals = useMemo(
    () =>
      filteredSuppliers.reduce(
        (acc, row) => {
          acc.suppliers += 1;
          acc.materials += row.materialCount;
          acc.stockValue += row.stockValue;
          acc.invoiceEntries += row.invoiceEntries;
          return acc;
        },
        {
          suppliers: 0,
          materials: 0,
          stockValue: 0,
          invoiceEntries: 0,
        }
      ),
    [filteredSuppliers]
  );

  const exportExcel = async () => {
    if (filteredSuppliers.length === 0) {
      alert('Nessun fornitore da esportare.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    const summaryRows = filteredSuppliers.map((row) => ({
      Fornitore: row.supplier,
      Materiali: row.materialCount,
      'Quantità totale': row.totalQuantity,
      'Valore magazzino stimato': Number(row.stockValue || 0),
      'Movimenti totali': row.movementCount,
      'Entrate totali': row.entriesQuantity,
      'Uscite totali': row.exitsQuantity,
      'Movimenti da fatture/import': row.invoiceEntries,
      'Ultimo movimento': formatDate(row.lastMovementAt),
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Fornitori');

    filteredSuppliers.forEach((supplier) => {
      const rows = supplier.materials.map((material) => ({
        Codice: material.code || '',
        Descrizione: material.description || '',
        Marca: material.brand || '',
        Categoria: material.category || '',
        Quantità: Number(material.quantity || 0),
        UM: material.unit || '',
        'Prezzo netto': Number(material.netPrice || 0),
        'Valore stock': Number(material.quantity || 0) * Number(material.netPrice || 0),
        Posizione: material.location || '',
        Soglia: Number(material.minThreshold || 0),
        Note: material.notes || '',
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(supplier.supplier));
    });

    XLSX.writeFile(workbook, `Fornitori_Magazzino_${new Date().toISOString().slice(0, 10)}.xlsx`);

    try {
      await adminLogStore.create({
        userId: user?.id,
        entity: 'fornitori',
        action: 'export',
        details: `Esportazione Excel fornitori: ${filteredSuppliers.length} fornitori.`,
      });
    } catch (err) {
      console.warn('Log esportazione fornitori non salvato:', err);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏭 Fornitori</h1>
          <p className="page-subtitle">
            Monitora fornitori, materiali collegati, valore a magazzino e movimenti da fatture/importazioni.
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            🔄 Aggiorna
          </button>
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            📊 Esporta Excel
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon blue">🏭</div>
          <div className="kpi-content">
            <div className="kpi-label">Fornitori</div>
            <div className="kpi-value">{totals.suppliers}</div>
            <div className="kpi-detail">fornitori visualizzati</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali collegati</div>
            <div className="kpi-value">{totals.materials}</div>
            <div className="kpi-detail">componenti/anagrafiche</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">💶</div>
          <div className="kpi-content">
            <div className="kpi-label">Valore stock stimato</div>
            <div className="kpi-value">{formatCurrency(totals.stockValue)}</div>
            <div className="kpi-detail">quantità × prezzo netto</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon teal">📄</div>
          <div className="kpi-content">
            <div className="kpi-label">Movimenti da fatture</div>
            <div className="kpi-value">{totals.invoiceEntries}</div>
            <div className="kpi-detail">importazioni/fatture rilevate</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🔍 Cerca fornitore o materiale</h3>
        </div>
        <div className="card-body">
          <input
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca fornitore, codice materiale, descrizione o marca..."
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fornitore</th>
              <th>Materiali</th>
              <th>Quantità totale</th>
              <th>Valore stock</th>
              <th>Movimenti</th>
              <th>Da fatture/import</th>
              <th>Ultimo movimento</th>
              <th>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: 36 }}>
                  <div className="empty-state-text">Caricamento fornitori...</div>
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: 36 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🏭</div>
                    <div className="empty-state-title">Nessun fornitore trovato</div>
                    <div className="empty-state-text">
                      Inserisci il fornitore nei materiali o importa fatture con materiali collegati.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((row) => (
                <tr key={row.supplier}>
                  <td>
                    <strong>{row.supplier}</strong>
                  </td>
                  <td style={{ fontWeight: 800 }}>{row.materialCount}</td>
                  <td>{row.totalQuantity}</td>
                  <td style={{ fontWeight: 800 }}>{formatCurrency(row.stockValue)}</td>
                  <td>{row.movementCount}</td>
                  <td>{row.invoiceEntries}</td>
                  <td>{formatDate(row.lastMovementAt)}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setSelectedSupplier(row.supplier)}
                    >
                      Dettaglio
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSupplierData && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedSupplier(null)}
        >
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Dettaglio fornitore</h3>
                <div className="text-sm text-muted">{selectedSupplierData.supplier}</div>
              </div>

              <button className="modal-close" onClick={() => setSelectedSupplier(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div>
                  <div className="text-sm text-muted fw-semibold">Materiali collegati</div>
                  <div style={{ fontWeight: 900 }}>{selectedSupplierData.materialCount}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Valore stock stimato</div>
                  <div style={{ fontWeight: 900 }}>{formatCurrency(selectedSupplierData.stockValue)}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Entrate totali</div>
                  <div style={{ fontWeight: 900 }}>{selectedSupplierData.entriesQuantity}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Ultimo movimento</div>
                  <div style={{ fontWeight: 900 }}>{formatDate(selectedSupplierData.lastMovementAt)}</div>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Codice</th>
                      <th>Descrizione</th>
                      <th>Marca</th>
                      <th>Qtà</th>
                      <th>Prezzo netto</th>
                      <th>Valore</th>
                      <th>Posizione</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedSupplierData.materials.map((material) => {
                      const value = Number(material.quantity || 0) * Number(material.netPrice || 0);

                      return (
                        <tr key={material.id}>
                          <td>
                            <strong>{material.code}</strong>
                          </td>
                          <td>{material.description}</td>
                          <td>{material.brand || '—'}</td>
                          <td>{material.quantity}</td>
                          <td>{formatCurrency(material.netPrice)}</td>
                          <td>{formatCurrency(value)}</td>
                          <td>{material.location || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSupplier(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

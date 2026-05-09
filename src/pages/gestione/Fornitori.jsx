import Icon from '../../components/Icon';
// ============================================================
// FORNITORI.JSX - Monitoraggio fornitori da fatture e inserimenti
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  materialStore,
  movementStore,
  invoiceImportStore,
  adminLogStore,
} from '../../data/store';
import { useAuth } from '../../App';
import FaIcon from '../../components/FaIcon';

function normalizeSupplier(value = '') {
  const text = String(value || '').trim();
  if (!text) return 'Senza fornitore';

  return text
    .replace(/\bs\.p\.a\.?\b/gi, 'S.p.A.')
    .replace(/\bspa\b/gi, 'SpA')
    .replace(/\bs\.r\.l\.?\b/gi, 'S.r.l.')
    .replace(/\bsrl\b/gi, 'Srl');
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

function getMovementDate(movement) {
  return movement.date || movement.createdAt || '';
}

function isInvoiceMovement(movement) {
  const reason = String(movement.reason || '').toLowerCase();
  const notes = String(movement.notes || '').toLowerCase();

  return (
    reason.includes('fattura') ||
    reason.includes('importazione') ||
    notes.includes('fattura') ||
    notes.includes('importazione')
  );
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
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const today = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);

      const dateFrom = from.toISOString().slice(0, 10);
      const dateTo = today.toISOString().slice(0, 10);

      const [mats, movs, invs] = await Promise.all([
        materialStore.getAll(),
        movementStore.getFiltered({ dateFrom, dateTo }),
        invoiceImportStore.getAll(300),
      ]);

      setMaterials(Array.isArray(mats) ? mats : []);
      setMovements(Array.isArray(movs) ? movs : []);
      setInvoices(Array.isArray(invs) ? invs : []);
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

    const ensureGroup = (supplierName) => {
      const supplier = normalizeSupplier(supplierName);

      if (!groups[supplier]) {
        groups[supplier] = {
          supplier,
          invoices: [],
          movements: [],
          manualMovements: [],
          invoiceMovements: [],
          materials: [],
          invoiceCount: 0,
          manualCount: 0,
          movementCount: 0,
          materialCount: 0,
          totalQuantity: 0,
          estimatedValue: 0,
          stockValue: 0,
          createdItems: 0,
          updatedItems: 0,
          detectedItems: 0,
          lastActivityAt: null,
        };
      }

      return groups[supplier];
    };

    invoices.forEach((invoice) => {
      const supplier = normalizeSupplier(invoice.supplier || invoice.fornitore);
      const group = ensureGroup(supplier);

      group.invoices.push(invoice);
      group.invoiceCount += 1;
      group.createdItems += Number(invoice.createdItems || 0);
      group.updatedItems += Number(invoice.updatedItems || 0);
      group.detectedItems += Number(invoice.detectedItems || 0);

      const date = invoice.createdAt || invoice.updatedAt;
      if (date && (!group.lastActivityAt || new Date(date) > new Date(group.lastActivityAt))) {
        group.lastActivityAt = date;
      }
    });

    movements.forEach((movement) => {
      const material = materialById.get(String(movement.materialId));
      const supplier = normalizeSupplier(movement.supplier || movement.fornitore || material?.supplier);
      const group = ensureGroup(supplier);

      const qty = Number(movement.quantity || 0);
      const price = Number(material?.netPrice || 0);
      const value = qty * price;
      const type = String(movement.type || '').toLowerCase();

      group.movements.push({ ...movement, material });
      group.movementCount += 1;

      if (type === 'entrata') {
        group.totalQuantity += qty;
        group.estimatedValue += value;
      }

      if (isInvoiceMovement(movement)) {
        group.invoiceMovements.push({ ...movement, material });
      } else if (type === 'entrata') {
        group.manualMovements.push({ ...movement, material });
        group.manualCount += 1;
      }

      const date = getMovementDate(movement);
      if (date && (!group.lastActivityAt || new Date(date) > new Date(group.lastActivityAt))) {
        group.lastActivityAt = date;
      }
    });

    materials.forEach((material) => {
      const supplier = normalizeSupplier(material.supplier);
      const group = ensureGroup(supplier);

      group.materials.push(material);
      group.materialCount += 1;
      group.stockValue += Number(material.quantity || 0) * Number(material.netPrice || 0);
    });

    return Object.values(groups).sort((a, b) => {
      const dateA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const dateB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

      if (dateB !== dateA) return dateB - dateA;
      return a.supplier.localeCompare(b.supplier);
    });
  }, [materials, movements, invoices]);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return supplierRows.filter((row) => {
      if (!q) return true;

      return (
        row.supplier.toLowerCase().includes(q) ||
        row.invoices.some((invoice) =>
          `${invoice.originalFileName || ''} ${invoice.fileName || ''}`.toLowerCase().includes(q)
        ) ||
        row.movements.some((movement) =>
          `${movement.materialCode || ''} ${movement.materialDescription || ''} ${movement.notes || ''}`
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
          acc.invoices += row.invoiceCount;
          acc.manual += row.manualCount;
          acc.value += row.estimatedValue;
          acc.quantity += row.totalQuantity;
          return acc;
        },
        {
          suppliers: 0,
          invoices: 0,
          manual: 0,
          value: 0,
          quantity: 0,
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
      Fatture: row.invoiceCount,
      'Inserimenti manuali': row.manualCount,
      Movimenti: row.movementCount,
      'Quantità caricata': row.totalQuantity,
      'Valore acquisti stimato': Number(row.estimatedValue || 0),
      'Materiali collegati': row.materialCount,
      'Ultima attività': formatDate(row.lastActivityAt),
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Fornitori');

    filteredSuppliers.forEach((supplier) => {
      const rows = [
        ...supplier.invoices.map((invoice) => ({
          Tipo: 'Fattura',
          Data: formatDate(invoice.createdAt),
          Documento: invoice.originalFileName || invoice.fileName || '',
          Codice: '',
          Descrizione: '',
          Quantità: '',
          Valore: '',
          Note: invoice.errors || '',
        })),
        ...supplier.movements.map((movement) => ({
          Tipo: isInvoiceMovement(movement) ? 'Movimento da fattura' : 'Inserimento manuale',
          Data: formatDate(getMovementDate(movement)),
          Documento: movement.notes || '',
          Codice: movement.material?.code || movement.materialCode || '',
          Descrizione: movement.material?.description || movement.materialDescription || '',
          Quantità: Number(movement.quantity || 0),
          Valore:
            Number(movement.quantity || 0) *
            Number(movement.material?.netPrice || 0),
          Note: movement.reason || '',
        })),
      ];

      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(supplier.supplier));
    });

    XLSX.writeFile(workbook, `Fornitori_${new Date().toISOString().slice(0, 10)}.xlsx`);

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
          <h1 className="page-title"><Icon name="factory" className="ui-title-icon" aria-hidden="true" />Fornitori</h1>
          <p className="page-subtitle">
            Fatture, inserimenti manuali, movimenti e materiali raggruppati per fornitore.
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? 'Aggiorno...' : (<><Icon name="sync" className="ui-inline-icon" aria-hidden="true" /> Aggiorna</>)}
          </button>
          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            <Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /> Esporta Excel
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Icon name="factory" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Fornitori</div>
            <div className="kpi-value">{totals.suppliers}</div>
            <div className="kpi-detail">fornitori con storico</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple"><Icon name="upload_file" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Fatture</div>
            <div className="kpi-value">{totals.invoices}</div>
            <div className="kpi-detail">documenti collegati</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon teal">✍️</div>
          <div className="kpi-content">
            <div className="kpi-label">Manuali</div>
            <div className="kpi-value">{totals.manual}</div>
            <div className="kpi-detail">carichi manuali</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><Icon name="euro" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valore stimato</div>
            <div className="kpi-value">{formatCurrency(totals.value)}</div>
            <div className="kpi-detail">entrate × prezzo netto</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /> Cerca fornitore, fattura o materiale</h3>
        </div>
        <div className="card-body">
          <input
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca fornitore, file fattura, codice, descrizione..."
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fornitore</th>
              <th>Fatture</th>
              <th>Inserimenti manuali</th>
              <th>Movimenti</th>
              <th>Quantità caricata</th>
              <th>Valore stimato</th>
              <th>Ultima attività</th>
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
                    <div className="empty-state-icon"><Icon name="factory" className="ui-inline-icon" aria-hidden="true" /></div>
                    <div className="empty-state-title">Nessun fornitore trovato</div>
                    <div className="empty-state-text">
                      Importa fatture o registra carichi manuali con fornitore.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((row) => (
                <tr key={row.supplier}>
                  <td><strong>{row.supplier}</strong></td>
                  <td style={{ fontWeight: 800 }}>{row.invoiceCount}</td>
                  <td style={{ fontWeight: 800 }}>{row.manualCount}</td>
                  <td>{row.movementCount}</td>
                  <td>{row.totalQuantity}</td>
                  <td style={{ fontWeight: 800 }}>{formatCurrency(row.estimatedValue)}</td>
                  <td>{formatDate(row.lastActivityAt)}</td>
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
        <div className="modal-overlay" onClick={() => setSelectedSupplier(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
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
                  <div className="text-sm text-muted fw-semibold">Fatture</div>
                  <div style={{ fontWeight: 900 }}>{selectedSupplierData.invoiceCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted fw-semibold">Inserimenti manuali</div>
                  <div style={{ fontWeight: 900 }}>{selectedSupplierData.manualCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted fw-semibold">Quantità caricata</div>
                  <div style={{ fontWeight: 900 }}>{selectedSupplierData.totalQuantity}</div>
                </div>
                <div>
                  <div className="text-sm text-muted fw-semibold">Valore stimato</div>
                  <div style={{ fontWeight: 900 }}>{formatCurrency(selectedSupplierData.estimatedValue)}</div>
                </div>
              </div>

              <h4 style={{ marginBottom: 10 }}><Icon name="upload_file" className="ui-inline-icon" aria-hidden="true" /> Fatture collegate</h4>
              <div className="table-container" style={{ marginBottom: 24 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>File</th>
                      <th>Rilevati</th>
                      <th>Creati</th>
                      <th>Aggiornati</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplierData.invoices.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-muted">Nessuna fattura collegata.</td>
                      </tr>
                    ) : (
                      selectedSupplierData.invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{formatDate(invoice.createdAt)}</td>
                          <td><strong>{invoice.originalFileName || invoice.fileName}</strong></td>
                          <td>{invoice.detectedItems}</td>
                          <td>{invoice.createdItems}</td>
                          <td>{invoice.updatedItems}</td>
                          <td>{invoice.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginBottom: 10 }}><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /> Movimenti / inserimenti</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Codice</th>
                      <th>Descrizione</th>
                      <th>Qtà</th>
                      <th>Valore</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplierData.movements.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-muted">Nessun movimento collegato.</td>
                      </tr>
                    ) : (
                      selectedSupplierData.movements
                        .slice()
                        .sort((a, b) => new Date(getMovementDate(b)) - new Date(getMovementDate(a)))
                        .map((movement) => {
                          const value =
                            Number(movement.quantity || 0) *
                            Number(movement.material?.netPrice || 0);

                          return (
                            <tr key={movement.id}>
                              <td>{formatDate(getMovementDate(movement))}</td>
                              <td>{isInvoiceMovement(movement) ? 'Da fattura' : 'Manuale'}</td>
                              <td><strong>{movement.material?.code || movement.materialCode || '—'}</strong></td>
                              <td>{movement.material?.description || movement.materialDescription || '—'}</td>
                              <td>{movement.quantity}</td>
                              <td>{formatCurrency(value)}</td>
                              <td>{movement.notes || movement.reason || '—'}</td>
                            </tr>
                          );
                        })
                    )}
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

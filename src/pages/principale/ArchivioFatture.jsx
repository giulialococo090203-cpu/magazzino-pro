import { useEffect, useMemo, useState } from 'react';

import { invoiceImportStore, adminLogStore } from '../../data/store';

import { useAuth } from '../../App';

import { hasPermission, normalizeRole } from '../../data/permissions';

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

function formatDateOnly(iso) {

  if (!iso) return '';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';

  return d.toISOString().slice(0, 10);

}

function formatBytes(bytes = 0) {

  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;

  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;

  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;

}

function formatStatus(status) {

  const labels = {

    caricata: 'Caricata',

    analizzata: 'Analizzata',

    completata: 'Completata',

    completata_con_errori: 'Completata con errori',

    errore: 'Errore',

  };

  return labels[status] || status || '—';

}

function getStatusStyle(status) {

  if (status === 'completata') {

    return {

      background: 'var(--success-50)',

      color: 'var(--success-700)',

    };

  }

  if (status === 'completata_con_errori' || status === 'analizzata') {

    return {

      background: 'var(--warning-50)',

      color: 'var(--warning-700)',

    };

  }

  if (status === 'errore') {

    return {

      background: 'var(--danger-50)',

      color: 'var(--danger-700)',

    };

  }

  return {

    background: 'var(--primary-50)',

    color: 'var(--primary-700)',

  };

}

function isDatore(user) {

  return normalizeRole(user?.role) === 'datore';

}

function getFileTypeLabel(fileType = '', fileName = '') {

  const type = String(fileType || '').toLowerCase();

  const name = String(fileName || '').toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) return 'PDF';

  if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'Excel';

  if (type.includes('csv') || name.endsWith('.csv')) return 'CSV';

  if (type.includes('xml') || name.endsWith('.xml')) return 'XML';

  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'Word';

  return fileType || 'Documento';

}

export default function ArchivioFatture() {

  const { user } = useAuth();

  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState('');

  const [error, setError] = useState('');

  const [detailInvoice, setDetailInvoice] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);

  const [search, setSearch] = useState('');

  const [filterUser, setFilterUser] = useState('');

  const [filterStatus, setFilterStatus] = useState('');

  const [filterDate, setFilterDate] = useState('');

  const canAccess = hasPermission(user, 'canImportInvoices');

  const canDelete = isDatore(user);

  const loadInvoices = async () => {

    try {

      setLoading(true);

      setError('');

      const rows = await invoiceImportStore.getAll();

      setInvoices(Array.isArray(rows) ? rows : []);

    } catch (err) {

      console.error('Errore caricamento archivio fatture:', err);

      setError(err.message || 'Errore durante il caricamento dell’archivio fatture.');

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    if (!canAccess) return;

    loadInvoices();

  }, [canAccess]);

  const users = useMemo(() => {

    return [...new Set(invoices.map((invoice) => invoice.userName).filter(Boolean))].sort((a, b) =>

      a.localeCompare(b)

    );

  }, [invoices]);

  const statuses = useMemo(() => {

    return [...new Set(invoices.map((invoice) => invoice.status).filter(Boolean))];

  }, [invoices]);

  const filteredInvoices = useMemo(() => {

    const q = search.trim().toLowerCase();

    return invoices.filter((invoice) => {

      const matchSearch =

        !q ||

        String(invoice.fileName || '').toLowerCase().includes(q) ||

        String(invoice.originalFileName || '').toLowerCase().includes(q) ||

        String(invoice.userName || '').toLowerCase().includes(q);

      const matchUser = !filterUser || invoice.userName === filterUser;

      const matchStatus = !filterStatus || invoice.status === filterStatus;

      const matchDate = !filterDate || formatDateOnly(invoice.createdAt) === filterDate;

      return matchSearch && matchUser && matchStatus && matchDate;

    });

  }, [invoices, search, filterUser, filterStatus, filterDate]);

  const totals = useMemo(() => {

    return filteredInvoices.reduce(

      (acc, invoice) => {

        acc.files += 1;

        acc.bytes += Number(invoice.fileSize || 0);

        acc.detected += Number(invoice.detectedItems || 0);

        acc.created += Number(invoice.createdItems || 0);

        acc.updated += Number(invoice.updatedItems || 0);

        return acc;

      },

      {

        files: 0,

        bytes: 0,

        detected: 0,

        created: 0,

        updated: 0,

      }

    );

  }, [filteredInvoices]);

  const clearFilters = () => {

    setSearch('');

    setFilterUser('');

    setFilterStatus('');

    setFilterDate('');

  };

  const openFile = async (invoice) => {

    try {

      setActionLoading(`open-${invoice.id}`);

      const url = await invoiceImportStore.getSignedUrl(invoice.filePath);

      if (!url) {

        throw new Error('URL del file non disponibile.');

      }

      window.open(url, '_blank', 'noopener,noreferrer');

    } catch (err) {

      console.error('Errore apertura file:', err);

      alert(err.message || 'Non riesco ad aprire il file.');

    } finally {

      setActionLoading('');

    }

  };

  const downloadFile = async (invoice) => {

    try {

      setActionLoading(`download-${invoice.id}`);

      const url = await invoiceImportStore.getSignedUrl(invoice.filePath);

      if (!url) {

        throw new Error('URL del file non disponibile.');

      }

      const link = document.createElement('a');

      link.href = url;

      link.download = invoice.originalFileName || invoice.fileName || 'fattura';

      link.target = '_blank';

      link.rel = 'noopener noreferrer';

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

    } catch (err) {

      console.error('Errore download file:', err);

      alert(err.message || 'Non riesco a scaricare il file.');

    } finally {

      setActionLoading('');

    }

  };

  const handleDelete = async () => {

    if (!confirmDelete) return;

    try {

      setActionLoading(`delete-${confirmDelete.id}`);

      const result = await invoiceImportStore.deleteWithFile(confirmDelete.id);

      await adminLogStore.create({

        userId: user?.id,

        entity: 'fattura',

        entityId: confirmDelete.id,

        action: 'Eliminazione fattura archiviata',

        details: `Fattura/documento "${confirmDelete.originalFileName || confirmDelete.fileName}" eliminato dall’archivio. File eliminati: ${result.fileDeleted ? 'sì' : 'no'}.`,

      });

      setConfirmDelete(null);

      await loadInvoices();

      if (result.fileErrors?.length > 0) {

        alert(

          `Record eliminato, ma il file Storage potrebbe non essere stato rimosso:\n${result.fileErrors.join('\n')}`

        );

      }

    } catch (err) {

      console.error('Errore eliminazione fattura:', err);

      alert(err.message || 'Errore durante l’eliminazione della fattura.');

    } finally {

      setActionLoading('');

    }

  };

  if (!canAccess) {

    return (

      <div className="animate-slideUp">

        <div className="page-header">

          <div>

            <h1 className="page-title">🗂️ Archivio Fatture</h1>

            <p className="page-subtitle">Documenti importati e salvati su Supabase Storage</p>

          </div>

        </div>

        <div className="card">

          <div className="card-body">

            <div className="empty-state">

              <div className="empty-state-icon">🔒</div>

              <div className="empty-state-title">Accesso non consentito</div>

              <div className="empty-state-text">

                Non hai i permessi per vedere l’archivio delle fatture caricate.

              </div>

            </div>

          </div>

        </div>

      </div>

    );

  }

  return (

    <div className="animate-slideUp">

      <div className="page-header">

        <div>

          <h1 className="page-title">🗂️ Archivio Fatture</h1>

          <p className="page-subtitle">

            {filteredInvoices.length} documenti visualizzati su {invoices.length} caricati

          </p>

        </div>

        <div className="btn-group">

          <button className="btn btn-secondary" onClick={loadInvoices} disabled={loading}>

            🔄 Aggiorna

          </button>

        </div>

      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>

        <div className="kpi-card">

          <div className="kpi-icon blue">📄</div>

          <div className="kpi-content">

            <div className="kpi-label">Documenti</div>

            <div className="kpi-value">{totals.files}</div>

            <div className="kpi-detail">fatture / file archiviati</div>

          </div>

        </div>

        <div className="kpi-card">

          <div className="kpi-icon purple">📁</div>

          <div className="kpi-content">

            <div className="kpi-label">Spazio Usato</div>

            <div className="kpi-value">{formatBytes(totals.bytes)}</div>

            <div className="kpi-detail">solo risultati filtrati</div>

          </div>

        </div>

        <div className="kpi-card">

          <div className="kpi-icon green">✅</div>

          <div className="kpi-content">

            <div className="kpi-label">Materiali Creati</div>

            <div className="kpi-value">{totals.created}</div>

            <div className="kpi-detail">nuovi componenti</div>

          </div>

        </div>

        <div className="kpi-card">

          <div className="kpi-icon teal">🔄</div>

          <div className="kpi-content">

            <div className="kpi-label">Materiali Aggiornati</div>

            <div className="kpi-value">{totals.updated}</div>

            <div className="kpi-detail">giacenze caricate</div>

          </div>

        </div>

      </div>

      <div className="card" style={{ marginBottom: 20 }}>

        <div className="card-header">

          <h3 className="card-title">🔍 Filtri archivio</h3>

          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>

            Azzera filtri

          </button>

        </div>

        <div className="card-body">

          <div className="filters-row">

            <div className="filter-group" style={{ minWidth: 260 }}>

              <label>Cerca:</label>

              <input

                type="text"

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Nome file o utente..."

              />

            </div>

            <div className="filter-group">

              <label>Utente:</label>

              <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>

                <option value="">Tutti</option>

                {users.map((name) => (

                  <option key={name} value={name}>

                    {name}

                  </option>

                ))}

              </select>

            </div>

            <div className="filter-group">

              <label>Stato:</label>

              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>

                <option value="">Tutti</option>

                {statuses.map((status) => (

                  <option key={status} value={status}>

                    {formatStatus(status)}

                  </option>

                ))}

              </select>

            </div>

            <div className="filter-group">

              <label>Data:</label>

              <input

                type="date"

                value={filterDate}

                onChange={(e) => setFilterDate(e.target.value)}

              />

            </div>

          </div>

        </div>

      </div>

      {error && (

        <div className="login-error" style={{ marginBottom: 16 }}>

          {error}

        </div>

      )}

      {loading ? (

        <div className="card">

          <div className="card-body">

            <div className="empty-state">

              <div className="empty-state-icon">⏳</div>

              <div className="empty-state-title">Caricamento archivio...</div>

              <div className="empty-state-text">Sto leggendo le fatture importate</div>

            </div>

          </div>

        </div>

      ) : (

        <div className="table-container">

          <table className="data-table">

            <thead>

              <tr>

                <th>Data caricamento</th>

                <th>Nome file</th>

                <th>Utente</th>

                <th>Tipo</th>

                <th>Dimensione</th>

                <th>Stato</th>

                <th style={{ textAlign: 'center' }}>Rilevati</th>

                <th style={{ textAlign: 'center' }}>Creati</th>

                <th style={{ textAlign: 'center' }}>Aggiornati</th>

                <th>Errori</th>

                <th style={{ width: 210 }}>Azioni</th>

              </tr>

            </thead>

            <tbody>

              {filteredInvoices.length === 0 ? (

                <tr>

                  <td colSpan="11" style={{ padding: 40 }}>

                    <div className="empty-state">

                      <div className="empty-state-icon">🗂️</div>

                      <div className="empty-state-title">Nessuna fattura trovata</div>

                      <div className="empty-state-text">

                        Carica un documento da Importa / Inserisci oppure modifica i filtri.

                      </div>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredInvoices.map((invoice) => {

                  const statusStyle = getStatusStyle(invoice.status);

                  return (

                    <tr key={invoice.id}>

                      <td>

                        <div style={{ fontWeight: 700 }}>{formatDateTime(invoice.createdAt)}</div>

                      </td>

                      <td>

                        <div style={{ fontWeight: 800, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          {invoice.originalFileName || invoice.fileName}

                        </div>

                        <div className="text-xs text-muted" style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                          {invoice.filePath}

                        </div>

                      </td>

                      <td>{invoice.userName || '—'}</td>

                      <td>{getFileTypeLabel(invoice.fileType, invoice.originalFileName || invoice.fileName)}</td>

                      <td>{formatBytes(invoice.fileSize)}</td>

                      <td>

                        <span

                          style={{

                            display: 'inline-flex',

                            alignItems: 'center',

                            padding: '4px 10px',

                            borderRadius: 999,

                            fontSize: 11,

                            fontWeight: 900,

                            ...statusStyle,

                          }}

                        >

                          {formatStatus(invoice.status)}

                        </span>

                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 800 }}>

                        {invoice.detectedItems}

                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--success-600)' }}>

                        {invoice.createdItems}

                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary-600)' }}>

                        {invoice.updatedItems}

                      </td>

                      <td>

                        {invoice.errors ? (

                          <button

                            className="btn btn-sm btn-ghost text-warning"

                            onClick={() => setDetailInvoice(invoice)}

                          >

                            Vedi errori

                          </button>

                        ) : (

                          <span className="text-muted">—</span>

                        )}

                      </td>

                      <td>

                        <div className="table-actions">

                          <button

                            className="btn btn-sm btn-ghost"

                            onClick={() => openFile(invoice)}

                            disabled={actionLoading === `open-${invoice.id}`}

                            title="Apri file"

                          >

                            👁️

                          </button>

                          <button

                            className="btn btn-sm btn-ghost"

                            onClick={() => downloadFile(invoice)}

                            disabled={actionLoading === `download-${invoice.id}`}

                            title="Scarica file"

                          >

                            ⬇️

                          </button>

                          <button

                            className="btn btn-sm btn-ghost"

                            onClick={() => setDetailInvoice(invoice)}

                            title="Dettagli"

                          >

                            ℹ️

                          </button>

                          {canDelete && (

                            <button

                              className="btn btn-sm btn-ghost text-danger"

                              onClick={() => setConfirmDelete(invoice)}

                              disabled={actionLoading === `delete-${invoice.id}`}

                              title="Elimina file archiviato"

                            >

                              🗑️

                            </button>

                          )}

                        </div>

                      </td>

                    </tr>

                  );

                })

              )}

            </tbody>

          </table>

        </div>

      )}

      {detailInvoice && (

        <div className="modal-overlay" onClick={() => setDetailInvoice(null)}>

          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">

              <div>

                <h3 className="modal-title">Dettagli importazione</h3>

                <div className="text-sm text-muted">

                  {detailInvoice.originalFileName || detailInvoice.fileName}

                </div>

              </div>

              <button className="modal-close" onClick={() => setDetailInvoice(null)}>

                ✕

              </button>

            </div>

            <div className="modal-body">

              <div className="grid-2" style={{ marginBottom: 20 }}>

                <div>

                  <div className="text-sm text-muted fw-semibold">Data caricamento</div>

                  <div style={{ fontWeight: 800 }}>{formatDateTime(detailInvoice.createdAt)}</div>

                </div>

                <div>

                  <div className="text-sm text-muted fw-semibold">Utente</div>

                  <div style={{ fontWeight: 800 }}>{detailInvoice.userName || '—'}</div>

                </div>

                <div>

                  <div className="text-sm text-muted fw-semibold">Bucket</div>

                  <div style={{ fontWeight: 800 }}>{detailInvoice.bucket || 'fatture'}</div>

                </div>

                <div>

                  <div className="text-sm text-muted fw-semibold">Dimensione</div>

                  <div style={{ fontWeight: 800 }}>{formatBytes(detailInvoice.fileSize)}</div>

                </div>

                <div>

                  <div className="text-sm text-muted fw-semibold">Tipo file</div>

                  <div style={{ fontWeight: 800 }}>

                    {getFileTypeLabel(detailInvoice.fileType, detailInvoice.originalFileName || detailInvoice.fileName)}

                  </div>

                </div>

                <div>

                  <div className="text-sm text-muted fw-semibold">Stato</div>

                  <div style={{ fontWeight: 800 }}>{formatStatus(detailInvoice.status)}</div>

                </div>

              </div>

              <div className="table-container" style={{ marginBottom: 20 }}>

                <table className="data-table">

                  <thead>

                    <tr>

                      <th>Materiali rilevati</th>

                      <th>Materiali creati</th>

                      <th>Materiali aggiornati</th>

                    </tr>

                  </thead>

                  <tbody>

                    <tr>

                      <td style={{ fontWeight: 900 }}>{detailInvoice.detectedItems}</td>

                      <td style={{ fontWeight: 900, color: 'var(--success-600)' }}>

                        {detailInvoice.createdItems}

                      </td>

                      <td style={{ fontWeight: 900, color: 'var(--primary-600)' }}>

                        {detailInvoice.updatedItems}

                      </td>

                    </tr>

                  </tbody>

                </table>

              </div>

              <div style={{ marginBottom: 20 }}>

                <div className="text-sm text-muted fw-semibold">Percorso file Storage</div>

                <div

                  style={{

                    marginTop: 6,

                    padding: 10,

                    borderRadius: 'var(--border-radius-md)',

                    background: 'var(--gray-50)',

                    color: 'var(--gray-700)',

                    fontSize: 12,

                    wordBreak: 'break-all',

                  }}

                >

                  {detailInvoice.filePath || '—'}

                </div>

              </div>

              {detailInvoice.errors && (

                <div>

                  <div className="text-sm text-danger fw-semibold">Errori / note importazione</div>

                  <pre

                    style={{

                      marginTop: 8,

                      padding: 14,

                      borderRadius: 'var(--border-radius-md)',

                      background: 'var(--danger-50)',

                      color: 'var(--danger-700)',

                      whiteSpace: 'pre-wrap',

                      fontSize: 12,

                      lineHeight: 1.5,

                    }}

                  >

                    {detailInvoice.errors}

                  </pre>

                </div>

              )}

            </div>

            <div className="modal-footer">

              <button className="btn btn-secondary" onClick={() => setDetailInvoice(null)}>

                Chiudi

              </button>

              <button className="btn btn-primary" onClick={() => openFile(detailInvoice)}>

                Apri file

              </button>

            </div>

          </div>

        </div>

      )}

      {confirmDelete && (

        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmDelete(null)}>

          <div className="modal" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">

              <h3 className="modal-title">Eliminare documento?</h3>

              <button className="modal-close" onClick={() => setConfirmDelete(null)}>

                ✕

              </button>

            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>

              <div className="confirm-icon danger">🗑️</div>

              <p className="confirm-message">

                Vuoi eliminare dall’archivio il file{' '}

                <strong>{confirmDelete.originalFileName || confirmDelete.fileName}</strong>?

                <br />

                Verrà eliminato solo il documento archiviato e il relativo record.

                <br />

                <strong>Materiali e movimenti non verranno modificati.</strong>

              </p>

            </div>

            <div className="modal-footer">

              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>

                Annulla

              </button>

              <button className="btn btn-danger" onClick={handleDelete}>

                Elimina documento

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}
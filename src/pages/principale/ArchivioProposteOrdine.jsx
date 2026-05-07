import { useEffect, useMemo, useState } from 'react';
import { reorderProposalStore } from '../../data/store';
import Icon from '../../components/Icon';

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

function statusLabel(status = '') {
  return {
    aperta: 'Aperta',
    inviata: 'Inviata',
    completata: 'Completata',
    annullata: 'Annullata',
  }[status] || status || '—';
}

function statusStyle(status = '') {
  if (status === 'completata') {
    return { background: 'var(--success-50)', color: 'var(--success-700)' };
  }

  if (status === 'inviata') {
    return { background: 'var(--primary-50)', color: 'var(--primary-700)' };
  }

  if (status === 'annullata') {
    return { background: 'var(--danger-50)', color: 'var(--danger-700)' };
  }

  return { background: 'var(--warning-50)', color: 'var(--warning-700)' };
}

export default function ArchivioProposteOrdine() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await reorderProposalStore.getAll();
      setProposals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento proposte ordine:', err);
      setError(err?.message || 'Errore durante il caricamento delle proposte ordine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const matchQuery =
        !q ||
        String(proposal.number || '').toLowerCase().includes(q) ||
        String(proposal.supplier || '').toLowerCase().includes(q) ||
        String(proposal.userName || '').toLowerCase().includes(q);

      const matchStatus = !status || proposal.status === status;

      return matchQuery && matchStatus;
    });
  }, [proposals, query, status]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, proposal) => {
        acc.proposals += 1;
        acc.rows += Number(proposal.totalRows || proposal.rows?.length || 0);
        acc.quantity += Number(proposal.totalQuantity || 0);
        if (proposal.status === 'aperta') acc.open += 1;
        return acc;
      },
      { proposals: 0, rows: 0, quantity: 0, open: 0 }
    );
  }, [filtered]);

  const filteredIds = useMemo(() => filtered.map((proposal) => proposal.id), [filtered]);

  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => filteredIds.includes(id)),
    [selectedIds, filteredIds]
  );

  const allVisibleSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleProposalSelection = (id) => {
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

  const deleteSelectedProposals = async () => {
    const idsToDelete = selectedVisibleIds;

    if (idsToDelete.length === 0) {
      alert('Seleziona almeno una proposta da eliminare.');
      return;
    }

    const firstConfirm = window.confirm(
      `Vuoi eliminare ${idsToDelete.length} proposte ordine selezionate?\n\n` +
        'Verranno eliminate anche tutte le righe collegate.'
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `Conferma definitiva:\n\n` +
        `stai per eliminare ${idsToDelete.length} proposte ordine.\n\n` +
        'Questa operazione non può essere annullata.'
    );

    if (!secondConfirm) return;

    try {
      setSavingId('delete-selected');

      for (const id of idsToDelete) {
        await reorderProposalStore.delete(id);
      }

      setProposals((prev) => prev.filter((proposal) => !idsToDelete.includes(proposal.id)));
      setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));

      if (selectedProposal && idsToDelete.includes(selectedProposal.id)) {
        setSelectedProposal(null);
      }

      alert(`Eliminate ${idsToDelete.length} proposte ordine.`);
    } catch (err) {
      console.error('Errore eliminazione proposte selezionate:', err);
      alert(err?.message || 'Errore durante l’eliminazione delle proposte selezionate.');
    } finally {
      setSavingId('');
    }
  };

  const changeStatus = async (proposal, nextStatus) => {
    try {
      setSavingId(proposal.id);

      const updated = await reorderProposalStore.updateStatus(proposal.id, nextStatus);

      setProposals((prev) =>
        prev.map((item) => (item.id === proposal.id ? updated : item))
      );

      if (selectedProposal?.id === proposal.id) {
        setSelectedProposal(updated);
      }
    } catch (err) {
      console.error('Errore aggiornamento stato proposta:', err);
      alert(err?.message || 'Errore durante l’aggiornamento dello stato.');
    } finally {
      setSavingId('');
    }
  };

  const deleteProposal = async (proposal) => {
    const confirmed = window.confirm(
      `Vuoi eliminare la proposta ${proposal.number}?\\n\\nQuesta azione eliminerà anche le righe collegate.`
    );

    if (!confirmed) return;

    try {
      setSavingId(proposal.id);
      await reorderProposalStore.delete(proposal.id);

      setProposals((prev) => prev.filter((item) => item.id !== proposal.id));
      setSelectedIds((prev) => prev.filter((id) => id !== proposal.id));

      if (selectedProposal?.id === proposal.id) {
        setSelectedProposal(null);
      }
    } catch (err) {
      console.error('Errore eliminazione proposta:', err);
      alert(err?.message || 'Errore durante l’eliminazione della proposta.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Icon name="request_quote" className="ui-title-icon" aria-hidden="true" />Proposte Ordine</h1>
          <p className="page-subtitle">
            Archivio delle proposte generate dal riordino automatico, divise per fornitore.
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
          <div className="kpi-icon blue"><Icon name="request_quote" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Proposte</div>
            <div className="kpi-value">{totals.proposals}</div>
            <div className="kpi-detail">visualizzate</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon yellow">🟡</div>
          <div className="kpi-content">
            <div className="kpi-label">Aperte</div>
            <div className="kpi-value">{totals.open}</div>
            <div className="kpi-detail">da gestire</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Righe</div>
            <div className="kpi-value">{totals.rows}</div>
            <div className="kpi-detail">materiali proposti</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🔢</div>
          <div className="kpi-content">
            <div className="kpi-label">Quantità</div>
            <div className="kpi-value">{totals.quantity}</div>
            <div className="kpi-detail">pezzi totali</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /> Filtri</h3>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group" style={{ minWidth: 280, flex: 1 }}>
              <label>Cerca:</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Numero proposta, fornitore o utente..."
              />
            </div>

            <div className="filter-group">
              <label>Stato:</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tutti</option>
                <option value="aperta">Aperta</option>
                <option value="inviata">Inviata</option>
                <option value="completata">Completata</option>
                <option value="annullata">Annullata</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
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
              {selectedVisibleIds.length} proposte selezionate su {filtered.length} visibili
            </div>

            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" onClick={toggleAllVisible}>
                {allVisibleSelected ? 'Deseleziona tutte' : 'Seleziona tutte'}
              </button>

              <button
                className="btn btn-sm btn-danger"
                onClick={deleteSelectedProposals}
                disabled={selectedVisibleIds.length === 0 || savingId === 'delete-selected'}
              >
                {savingId === 'delete-selected' ? 'Eliminazione...' : (<><Icon name="delete" className="ui-inline-icon" aria-hidden="true" /> Elimina selezionate</>)}
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
                  title="Seleziona tutte le proposte visibili"
                />
              </th>
              <th>Data</th>
              <th>Numero</th>
              <th>Fornitore</th>
              <th>Stato</th>
              <th>Righe</th>
              <th>Quantità</th>
              <th>Utente</th>
              <th>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ padding: 32 }}>
                  <div className="empty-state-text">Caricamento proposte ordine...</div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="request_quote" className="ui-inline-icon" aria-hidden="true" /></div>
                    <div className="empty-state-title">Nessuna proposta trovata</div>
                    <div className="empty-state-text">
                      Vai nel Riordino Automatico e usa “Salva proposta”.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((proposal) => (
                <tr key={proposal.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(proposal.id)}
                      onChange={() => toggleProposalSelection(proposal.id)}
                    />
                  </td>
                  <td>{formatDate(proposal.createdAt)}</td>
                  <td><strong>{proposal.number}</strong></td>
                  <td><strong>{proposal.supplier || 'Senza fornitore'}</strong></td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontWeight: 900,
                        fontSize: 12,
                        ...statusStyle(proposal.status),
                      }}
                    >
                      {statusLabel(proposal.status)}
                    </span>
                  </td>
                  <td>{proposal.totalRows || proposal.rows?.length || 0}</td>
                  <td>{proposal.totalQuantity || 0}</td>
                  <td>{proposal.userName || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setSelectedProposal(proposal)}
                      >
                        👁️
                      </button>

                      <select
                        value={proposal.status || 'aperta'}
                        onChange={(e) => changeStatus(proposal, e.target.value)}
                        disabled={savingId === proposal.id}
                        style={{ maxWidth: 130 }}
                      >
                        <option value="aperta">Aperta</option>
                        <option value="inviata">Inviata</option>
                        <option value="completata">Completata</option>
                        <option value="annullata">Annullata</option>
                      </select>

                      <button
                        className="btn btn-sm btn-ghost text-danger"
                        onClick={() => deleteProposal(proposal)}
                        disabled={savingId === proposal.id}
                      >
                        <Icon name="delete" className="ui-inline-icon" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedProposal && (
        <div className="modal-overlay" onClick={() => setSelectedProposal(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Dettaglio proposta ordine</h3>
                <div className="text-sm text-muted">
                  {selectedProposal.number} · {selectedProposal.supplier}
                </div>
              </div>

              <button className="modal-close" onClick={() => setSelectedProposal(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2" style={{ marginBottom: 18 }}>
                <div>
                  <div className="text-sm text-muted fw-semibold">Data</div>
                  <div style={{ fontWeight: 800 }}>{formatDate(selectedProposal.createdAt)}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Stato</div>
                  <div style={{ fontWeight: 800 }}>{statusLabel(selectedProposal.status)}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Righe</div>
                  <div style={{ fontWeight: 800 }}>{selectedProposal.rows?.length || 0}</div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Quantità totale</div>
                  <div style={{ fontWeight: 800 }}>{selectedProposal.totalQuantity || 0}</div>
                </div>
              </div>

              {selectedProposal.notes && (
                <div style={{ marginBottom: 18 }}>
                  <div className="text-sm text-muted fw-semibold">Note</div>
                  <div
                    style={{
                      marginTop: 6,
                      padding: 10,
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
                    {selectedProposal.notes}
                  </div>
                </div>
              )}

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Codice</th>
                      <th>Descrizione</th>
                      <th>Marca</th>
                      <th>Qtà att.</th>
                      <th>Soglia</th>
                      <th>Da ordinare</th>
                      <th>UM</th>
                      <th>Posizione</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(selectedProposal.rows || []).map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.code}</strong></td>
                        <td className="text-sm">{row.description}</td>
                        <td>{row.brand || '—'}</td>
                        <td>{row.currentQty}</td>
                        <td>{row.minThreshold}</td>
                        <td><strong>{row.suggestedQty}</strong></td>
                        <td>{row.unit}</td>
                        <td>{row.location || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedProposal(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

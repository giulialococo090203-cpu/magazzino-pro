import { useState, useEffect } from 'react';
import { adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import { normalizeRole } from '../../data/permissions';

function isDatore(user) {
  return normalizeRole(user?.role) === 'datore';
}

export default function LogModifiche() {
  const { user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [filterEntity, setFilterEntity] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [error, setError] = useState('');

  const canDeleteAll = isDatore(user);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const recentLogs = await adminLogStore.getRecent(100);
      setLogs(Array.isArray(recentLogs) ? recentLogs : []);
    } catch (err) {
      console.error('Errore caricamento log:', err);
      setError(err.message || 'Errore durante il caricamento dei log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => !filterEntity || log.entity === filterEntity);

  const entityTypes = [...new Set(logs.map((log) => log.entity).filter(Boolean))];

  const getEntityIcon = (entity) => {
    switch (entity) {
      case 'categoria':
        return <span className="ui-inline-icon material-symbols-rounded">sell</span>;
      case 'materiale':
        return '🔧';
      case 'utente':
        return <span className="ui-inline-icon material-symbols-rounded">manage_accounts</span>;
      case 'fattura':
        return <span className="ui-inline-icon material-symbols-rounded">upload_file</span>;
      default:
        return '📝';
    }
  };

  const getActionColor = (action = '') => {
    if (action.includes('Eliminazione') || action.includes('elimin')) return 'var(--danger-600)';
    if (action.includes('Nuov') || action.includes('Creazione')) return 'var(--success-600)';
    if (action.includes('Modifica')) return 'var(--primary-600)';
    return 'var(--gray-600)';
  };

  const handleDeleteAllLogs = async () => {
    try {
      setDeletingAll(true);
      setError('');

      await adminLogStore.deleteAll();

      setLogs([]);
      setFilterEntity('');
      setShowConfirmDeleteAll(false);
    } catch (err) {
      console.error('Errore eliminazione log:', err);
      setError(err.message || 'Errore durante l’eliminazione dello storico log.');
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📝 Log Modifiche Amministrative</h1>
          <p className="page-subtitle">{filtered.length} operazioni registrate</p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={loadLogs} disabled={loading || deletingAll}>
            <span className="ui-inline-icon material-symbols-rounded">sync</span> Aggiorna
          </button>

          {canDeleteAll && logs.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setShowConfirmDeleteAll(true)}
              disabled={loading || deletingAll}
            >
              <span className="ui-inline-icon material-symbols-rounded">delete</span> Svuota storico
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="filters-row" style={{ marginBottom: 16 }}>
        <div className="filter-group">
          <label>Tipo:</label>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
            <option value="">Tutti</option>
            {entityTypes.map((entity) => (
              <option key={entity} value={entity}>
                {entity.charAt(0).toUpperCase() + entity.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-title">Caricamento log...</div>
              <div className="empty-state-text">Sto leggendo lo storico modifiche</div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <div className="empty-state-title">Nessun log registrato</div>
              <div className="empty-state-text">Le modifiche amministrative verranno registrate qui</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {filtered.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--gray-100)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--border-radius-md)',
                    background: 'var(--gray-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {getEntityIcon(log.entity)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: getActionColor(log.action), fontSize: 13 }}>
                    {log.action}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>
                    {log.details}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                    {log.userName || 'Sistema'} ·{' '}
                    {new Date(log.date).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}{' '}
                    {new Date(log.date).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConfirmDeleteAll && (
        <div className="modal-overlay confirm-dialog" onClick={() => setShowConfirmDeleteAll(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Svuotare tutto lo storico?</h3>
              <button className="modal-close" onClick={() => setShowConfirmDeleteAll(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger"><span className="ui-inline-icon material-symbols-rounded">delete</span></div>

              <p className="confirm-message">
                Vuoi eliminare definitivamente tutti i log amministrativi?
                <br />
                Questa operazione elimina davvero i record dal database.
                <br />
                <strong>Non verranno modificati materiali, fatture o movimenti.</strong>
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmDeleteAll(false)}>
                Annulla
              </button>

              <button className="btn btn-danger" onClick={handleDeleteAllLogs} disabled={deletingAll}>
                {deletingAll ? 'Eliminazione...' : 'Svuota tutto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { adminLogStore } from '../../data/store';

export default function LogModifiche() {
  const [logs, setLogs] = useState([]);
  const [filterEntity, setFilterEntity] = useState('');

  useEffect(() => {
    async function loadLogs() {
      try {
        const recentLogs = await adminLogStore.getRecent(100);
        setLogs(recentLogs);
      } catch (err) {
        console.error('Errore caricamento log:', err);
      }
    }
    loadLogs();
  }, []);

  const filtered = logs.filter(l => !filterEntity || l.entity === filterEntity);

  const entityTypes = [...new Set(logs.map(l => l.entity).filter(Boolean))];

  const getEntityIcon = (entity) => {
    switch (entity) {
      case 'categoria': return '🏷️';
      case 'materiale': return '🔧';
      case 'utente': return '👤';
      default: return '📝';
    }
  };

  const getActionColor = (action) => {
    if (action.includes('Eliminazione')) return 'var(--danger-600)';
    if (action.includes('Nuov') || action.includes('Creazione')) return 'var(--success-600)';
    if (action.includes('Modifica')) return 'var(--primary-600)';
    return 'var(--gray-600)';
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📝 Log Modifiche Amministrative</h1>
          <p className="page-subtitle">{filtered.length} operazioni registrate</p>
        </div>
      </div>

      <div className="filters-row" style={{ marginBottom: 16 }}>
        <div className="filter-group">
          <label>Tipo:</label>
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
            <option value="">Tutti</option>
            {entityTypes.map(e => (
              <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
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
            {filtered.map(log => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 24px', borderBottom: '1px solid var(--gray-100)'
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--border-radius-md)',
                  background: 'var(--gray-50)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18, flexShrink: 0
                }}>
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
                    {log.userName || 'Sistema'} · {new Date(log.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(log.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

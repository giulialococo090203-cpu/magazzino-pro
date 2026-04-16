import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsStore, movementStore, categoryStore } from '../data/store';
import { useAuth } from '../App';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatMovementType(type) {
  const labels = { entrata: 'Entrata', uscita: 'Uscita', reintegro: 'Reintegro', rettifica: 'Rettifica' };
  return labels[type] || type;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const updateStats = async () => {
      try {
        const [newStats, cats] = await Promise.all([
          statsStore.getDashboardStats(),
          categoryStore.getAll()
        ]);
        setStats(newStats);
        setCategories(cats);
        setTick(t => t + 1);
      } catch (err) {
        console.error('Errore aggiornamento statistiche:', err);
      }
    };
    updateStats();
    const interval = setInterval(updateStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return (
    <div className="animate-slideUp" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="text-muted">Caricamento dashboard in corso...</div>
    </div>
  );

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Punto di Controllo</h1>
          <p className="page-subtitle">Piattaforma Operativa · Benvenuto, {user.fullName}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali Totali</div>
            <div className="kpi-value">{stats.totalMaterials}</div>
            <div className="kpi-detail">{stats.totalCategories} categorie</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon yellow">⚠️</div>
          <div className="kpi-content">
            <div className="kpi-label">Sotto Soglia</div>
            <div className="kpi-value">{stats.belowThresholdCount}</div>
            <div className="kpi-detail">richiesta attenzione</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red">🚫</div>
          <div className="kpi-content">
            <div className="kpi-label">Esauriti</div>
            <div className="kpi-value">{stats.exhaustedCount}</div>
            <div className="kpi-detail">da riordinare</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Movimenti Oggi</div>
            <div className="kpi-value">{stats.todayMovements}</div>
            <div className="kpi-detail">operazioni registrate</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🔔</div>
          <div className="kpi-content">
            <div className="kpi-label">Notifiche Attive</div>
            <div className="kpi-value">{stats.unreadNotifications}</div>
            <div className="kpi-detail">da leggere</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon teal">🏷️</div>
          <div className="kpi-content">
            <div className="kpi-label">Categorie</div>
            <div className="kpi-value">{stats.totalCategories}</div>
            <div className="kpi-detail">aree di materiale</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {['admin', 'operatore', 'segreteria'].includes(user.role) && (
        <>
          <h2 className="section-title"><span className="icon">⚡</span> Azioni Rapide</h2>
          <div className="quick-actions">
            <Link to="/movimento/entrata" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>📥</div>
              <span>Carica Materiale</span>
            </Link>
            <Link to="/movimento/uscita" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>📤</div>
              <span>Scarica Materiale</span>
            </Link>
            <Link to="/movimento/reintegro" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>🔄</div>
              <span>Reintegra Materiale</span>
            </Link>
            <Link to="/inventario" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>🔍</div>
              <span>Cerca Materiale</span>
            </Link>
            <Link to="/storico" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#ecfdf5', color: '#059669' }}>📊</div>
              <span>Storico Movimenti</span>
            </Link>
          </div>
        </>
      )}

      {/* Grid: Recent Movements + Alerts */}
      <div className="grid-2" style={{ marginTop: 8 }}>
        {/* Recent Movements */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Ultimi Movimenti</h3>
            <Link to="/storico" className="btn btn-sm btn-ghost">Vedi tutti →</Link>
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Materiale</th>
                  <th>Tipo</th>
                  <th>Qtà</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMovements.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted" style={{ padding: 24 }}>Nessun movimento recente</td></tr>
                ) : (
                  stats.recentMovements.map(mov => (
                    <tr key={mov.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatDate(mov.date)}</div>
                        <div className="text-xs text-muted">{formatTime(mov.date)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{mov.materialCode}</div>
                        <div className="text-xs text-muted" style={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mov.materialDescription}</div>
                      </td>
                      <td>
                        <span className={`movement-badge movement-${mov.type}`}>
                          {formatMovementType(mov.type)}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{mov.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Materials */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">⚠️ Materiali Critici</h3>
            <Link to="/controllo/notifiche" className="btn btn-sm btn-ghost">Vedi tutti →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.belowThreshold.length === 0 && stats.exhausted.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">Tutto in ordine</div>
                <div className="empty-state-text">Nessun materiale in stato critico</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Descrizione</th>
                    <th>Stato</th>
                    <th>Qtà</th>
                    <th>Soglia</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.exhausted, ...stats.belowThreshold.filter(m => m.quantity > 0)]
                    .slice(0, 8)
                    .map(mat => (
                      <tr key={mat.id}>
                        <td style={{ fontWeight: 700 }}>{mat.code}</td>
                        <td>
                          <div className="text-xs" style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mat.description}</div>
                        </td>
                        <td>
                          <span className={`status-badge status-${mat.status}`}>
                            {mat.status === 'esaurito' ? 'Esaurito' : 'Sotto soglia'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: mat.quantity === 0 ? 'var(--danger-600)' : 'var(--warning-600)' }}>
                          {mat.quantity}
                        </td>
                        <td className="text-muted">{mat.minThreshold}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {stats.notifications.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">🔔 Notifiche Recenti</h3>
            <Link to="/controllo/notifiche" className="btn btn-sm btn-ghost">Gestisci →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.notifications.slice(0, 5).map(n => (
              <div key={n.id} className="notification-item unread">
                <div className={`notification-dot ${n.currentQty === 0 ? 'danger' : 'warning'}`}></div>
                <div className="notification-text">{n.message}</div>
                <div className="notification-time">{formatDate(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Distribution */}
      {stats.categoryDistribution.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">🏷️ Distribuzione per Categoria</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {stats.categoryDistribution.map(cat => (
                <div key={cat.name} style={{
                  background: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '12px 20px',
                  textAlign: 'center',
                  minWidth: 140,
                  flex: '1 1 140px'
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-700)' }}>{cat.count}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>{cat.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

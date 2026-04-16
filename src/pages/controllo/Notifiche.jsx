import { useState, useEffect } from 'react';
import { notificationStore } from '../../data/store';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return 'Adesso';
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  return `${days} giorni fa`;
}

export default function Notifiche() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread, read

  const refresh = async () => {
    try {
      const all = await notificationStore.getAll();
      setNotifications(all);
    } catch (err) {
      console.error('Errore refresh notifiche:', err);
    }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id) => {
    try {
      await notificationStore.markRead(id);
      await refresh();
    } catch (err) {
      console.error('Errore markRead:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationStore.markAllRead();
      await refresh();
    } catch (err) {
      console.error('Errore markAllRead:', err);
    }
  };

  const deleteNotif = async (id) => {
    try {
      await notificationStore.delete(id);
      await refresh();
    } catch (err) {
      console.error('Errore deleteNotif:', err);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔔 Centro Notifiche</h1>
          <p className="page-subtitle">{unreadCount} notifiche non lette su {notifications.length} totali</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}>✓ Segna tutte come lette</button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Tutte ({notifications.length})
        </button>
        <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
          Non lette ({unreadCount})
        </button>
        <button className={`tab ${filter === 'read' ? 'active' : ''}`} onClick={() => setFilter('read')}>
          Lette ({notifications.length - unreadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title">Nessuna notifica</div>
              <div className="empty-state-text">
                {filter === 'unread' ? 'Tutte le notifiche sono state lette' : 'Non ci sono notifiche da visualizzare'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {filtered.map(n => (
              <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}>
                <div className={`notification-dot ${n.currentQty === 0 ? 'danger' : 'warning'}`}></div>
                <div style={{ flex: 1 }}>
                  <div className="notification-text">{n.message}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="notification-time">{timeAgo(n.createdAt)}</span>
                    {n.currentQty === 0 && (
                      <span className="status-badge status-esaurito" style={{ fontSize: 10, padding: '2px 8px' }}>Esaurito</span>
                    )}
                    {n.currentQty > 0 && n.currentQty <= n.threshold && (
                      <span className="status-badge status-sotto_soglia" style={{ fontSize: 10, padding: '2px 8px' }}>Sotto soglia</span>
                    )}
                  </div>
                </div>
                <div className="table-actions" style={{ flexShrink: 0 }}>
                  {!n.read && (
                    <button className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)} title="Segna come letta">✓</button>
                  )}
                  <button className="btn btn-sm btn-ghost text-danger" onClick={() => deleteNotif(n.id)} title="Elimina">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

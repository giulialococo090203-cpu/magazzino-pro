import { useEffect, useMemo, useState } from 'react';
import { notificationStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import { hasPermission } from '../../data/permissions';

function timeAgo(iso) {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins <= 0) return 'Adesso';
  if (mins < 60) return `${mins} min fa`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ore fa`;

  const days = Math.floor(hours / 24);
  return `${days} giorni fa`;
}

export default function Notifiche() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteRead, setConfirmDeleteRead] = useState(false);

  const canDeleteNotifications = hasPermission(user, 'canDeleteNotifications');

  const refresh = async () => {
    try {
      setLoading(true);
      const all = await notificationStore.getAll();
      setNotifications(Array.isArray(all) ? all : []);
    } catch (err) {
      console.error('Errore refresh notifiche:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const readCount = notifications.length - unreadCount;

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'read') return n.read;
      return true;
    });
  }, [notifications, filter]);

  const markRead = async (id) => {
    try {
      setActionLoading(`read-${id}`);
      await notificationStore.markRead(id);
      await refresh();
    } catch (err) {
      console.error('Errore markRead:', err);
      alert(err.message || 'Errore durante l’aggiornamento della notifica.');
    } finally {
      setActionLoading('');
    }
  };

  const markAllRead = async () => {
    try {
      setActionLoading('mark-all-read');
      await notificationStore.markAllRead();

      await adminLogStore.create({
        action: 'Lettura notifiche',
        entity: 'notifica',
        details: `Segnate come lette ${unreadCount} notifiche`,
        userId: user?.id,
        userName: user?.fullName || user?.username,
      });

      await refresh();
    } catch (err) {
      console.error('Errore markAllRead:', err);
      alert(err.message || 'Errore durante l’aggiornamento delle notifiche.');
    } finally {
      setActionLoading('');
    }
  };

  const deleteNotif = async (id) => {
    try {
      setActionLoading(`delete-${id}`);
      await notificationStore.delete(id);

      await adminLogStore.create({
        action: 'Eliminazione notifica',
        entity: 'notifica',
        entityId: id,
        details: 'Notifica eliminata dal centro notifiche',
        userId: user?.id,
        userName: user?.fullName || user?.username,
      });

      await refresh();
    } catch (err) {
      console.error('Errore deleteNotif:', err);
      alert(err.message || 'Errore durante l’eliminazione della notifica.');
    } finally {
      setActionLoading('');
    }
  };

  const deleteReadNotifications = async () => {
    try {
      setActionLoading('delete-read');
      const result = await notificationStore.deleteRead();

      await adminLogStore.create({
        action: 'Eliminazione notifiche lette',
        entity: 'notifica',
        details: `Eliminate ${result.deleted || 0} notifiche lette`,
        userId: user?.id,
        userName: user?.fullName || user?.username,
      });

      setConfirmDeleteRead(false);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione notifiche lette:', err);
      alert(err.message || 'Errore durante l’eliminazione delle notifiche lette.');
    } finally {
      setActionLoading('');
    }
  };

  const deleteAllNotifications = async () => {
    try {
      setActionLoading('delete-all');
      const result = await notificationStore.deleteAll();

      await adminLogStore.create({
        action: 'Eliminazione totale notifiche',
        entity: 'notifica',
        details: `Eliminate tutte le notifiche dal centro notifiche. Totale eliminato: ${result.deleted || 0}`,
        userId: user?.id,
        userName: user?.fullName || user?.username,
      });

      setConfirmDeleteAll(false);
      await refresh();
    } catch (err) {
      console.error('Errore eliminazione totale notifiche:', err);
      alert(err.message || 'Errore durante l’eliminazione di tutte le notifiche.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔔 Centro Notifiche</h1>
          <p className="page-subtitle">
            {unreadCount} notifiche non lette su {notifications.length} totali
          </p>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
            🔄 Aggiorna
          </button>

          {unreadCount > 0 && (
            <button
              className="btn btn-secondary"
              onClick={markAllRead}
              disabled={actionLoading === 'mark-all-read'}
            >
              ✓ Segna tutte come lette
            </button>
          )}

          {canDeleteNotifications && readCount > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmDeleteRead(true)}
              disabled={actionLoading === 'delete-read'}
            >
              🧹 Elimina lette
            </button>
          )}

          {canDeleteNotifications && notifications.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={actionLoading === 'delete-all'}
            >
              🗑️ Elimina tutte
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tutte ({notifications.length})
        </button>

        <button
          className={`tab ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Non lette ({unreadCount})
        </button>

        <button
          className={`tab ${filter === 'read' ? 'active' : ''}`}
          onClick={() => setFilter('read')}
        >
          Lette ({readCount})
        </button>
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-title">Caricamento notifiche...</div>
              <div className="empty-state-text">Sto leggendo il centro notifiche</div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title">Nessuna notifica</div>
              <div className="empty-state-text">
                {filter === 'unread'
                  ? 'Tutte le notifiche sono state lette'
                  : 'Non ci sono notifiche da visualizzare'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {filtered.map((n) => (
              <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}>
                <div className={`notification-dot ${n.currentQty === 0 ? 'danger' : 'warning'}`} />

                <div style={{ flex: 1 }}>
                  <div className="notification-text">{n.message}</div>

                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="notification-time">{timeAgo(n.createdAt)}</span>

                    {n.currentQty === 0 && (
                      <span
                        className="status-badge status-esaurito"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Esaurito
                      </span>
                    )}

                    {n.currentQty > 0 && n.currentQty <= n.threshold && (
                      <span
                        className="status-badge status-sotto_soglia"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                      >
                        Sotto soglia
                      </span>
                    )}
                  </div>
                </div>

                <div className="table-actions" style={{ flexShrink: 0 }}>
                  {!n.read && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => markRead(n.id)}
                      disabled={actionLoading === `read-${n.id}`}
                      title="Segna come letta"
                    >
                      ✓
                    </button>
                  )}

                  {canDeleteNotifications && (
                    <button
                      className="btn btn-sm btn-ghost text-danger"
                      onClick={() => deleteNotif(n.id)}
                      disabled={actionLoading === `delete-${n.id}`}
                      title="Elimina"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDeleteRead && (
        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmDeleteRead(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Eliminare notifiche lette?</h3>
              <button className="modal-close" onClick={() => setConfirmDeleteRead(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger">🧹</div>
              <p className="confirm-message">
                Vuoi eliminare definitivamente tutte le notifiche già lette?
                <br />
                Verranno cancellate dal database e libereranno memoria.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteRead(false)}>
                Annulla
              </button>

              <button className="btn btn-danger" onClick={deleteReadNotifications}>
                Elimina lette
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAll && (
        <div className="modal-overlay confirm-dialog" onClick={() => setConfirmDeleteAll(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Eliminare tutte le notifiche?</h3>
              <button className="modal-close" onClick={() => setConfirmDeleteAll(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="confirm-icon danger">🗑️</div>
              <p className="confirm-message">
                Vuoi eliminare definitivamente tutte le notifiche?
                <br />
                Questa azione non modifica materiali, movimenti o fatture.
                <br />
                <strong>Le notifiche verranno cancellate dal database.</strong>
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteAll(false)}>
                Annulla
              </button>

              <button className="btn btn-danger" onClick={deleteAllNotifications}>
                Elimina tutto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
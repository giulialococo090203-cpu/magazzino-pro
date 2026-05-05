import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { statsStore, materialStore, categoryStore, movementStore, notificationStore, userStore } from '../data/store';
import { useAuth } from '../App';
import { supabase } from '../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isDatore(user) {
  return ['datore', 'admin'].includes(normalizeRole(user?.role));
}

function canMoveMaterials(user) {
  return ['datore', 'admin', 'segretaria', 'segreteria', 'magazziniere', 'operatore'].includes(normalizeRole(user?.role));
}

function canImportInvoices(user) {
  return ['datore', 'admin', 'segretaria', 'segreteria', 'magazziniere', 'operatore'].includes(normalizeRole(user?.role));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatMovementType(type) {
  const labels = {
    entrata: 'Entrata',
    uscita: 'Uscita',
    reintegro: 'Reintegro',
    rettifica: 'Rettifica'
  };

  return labels[type] || type || '—';
}

function safeLower(value) {
  return String(value || '').toLowerCase();
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function listBucketFilesRecursive(bucketName, path = '') {
  const output = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) throw error;

    const items = Array.isArray(data) ? data : [];

    for (const item of items) {
      const isFolder = !item.id && !item.metadata;
      const itemPath = path ? `${path}/${item.name}` : item.name;

      if (isFolder) {
        const nested = await listBucketFilesRecursive(bucketName, itemPath);
        output.push(...nested);
      } else {
        output.push({
          ...item,
          path: itemPath,
          size: Number(item.metadata?.size || 0)
        });
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return output;
}

export default function Dashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [movements, setMovements] = useState([]);
  const [users, setUsers] = useState([]);
  const [mostMoved, setMostMoved] = useState([]);
  const [entriesVsExits, setEntriesVsExits] = useState([]);
  const [storageUsage, setStorageUsage] = useState([]);
  const [storageError, setStorageError] = useState('');
  const [storageLoading, setStorageLoading] = useState(false);

  const [searchComponent, setSearchComponent] = useState('');
  const [searchOperator, setSearchOperator] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const [showComponentSuggestions, setShowComponentSuggestions] = useState(false);
  const [showOperatorSuggestions, setShowOperatorSuggestions] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const componentRef = useRef(null);
  const operatorRef = useRef(null);
  const clientRef = useRef(null);

  const datoreView = isDatore(user);
  const movementAllowed = canMoveMaterials(user);
  const importAllowed = canImportInvoices(user);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        const [
          dashboardStats,
          mats,
          cats,
          unread,
          allMovements,
          mostMovedRows,
          evs,
          usrs
        ] = await Promise.all([
          statsStore.getDashboardStats(),
          materialStore.getAll(),
          categoryStore.getAll(),
          notificationStore.getUnread(),
          datoreView ? movementStore.getAll() : Promise.resolve([]),
          datoreView ? movementStore.getMostMoved(8) : Promise.resolve([]),
          datoreView ? movementStore.getEntriesVsExits(30) : Promise.resolve([]),
          datoreView ? userStore.getAll() : Promise.resolve([])
        ]);

        if (!mounted) return;

        setStats(dashboardStats);
        setMaterials(Array.isArray(mats) ? mats : []);
        setCategories(Array.isArray(cats) ? cats : []);
        setNotifications(Array.isArray(unread) ? unread : []);
        setMovements(Array.isArray(allMovements) ? allMovements : []);
        setMostMoved(Array.isArray(mostMovedRows) ? mostMovedRows : []);
        setEntriesVsExits(Array.isArray(evs) ? evs : []);
        setUsers(Array.isArray(usrs) ? usrs : []);
      } catch (err) {
        console.error('Errore caricamento dashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [datoreView]);

  useEffect(() => {
    if (!datoreView) return;

    let mounted = true;

    async function loadStorageUsage() {
      try {
        setStorageLoading(true);
        setStorageError('');

        const { data: buckets, error } = await supabase.storage.listBuckets();

        if (error) throw error;

        const bucketRows = [];

        for (const bucket of buckets || []) {
          try {
            const files = await listBucketFilesRecursive(bucket.name);
            const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

            bucketRows.push({
              name: bucket.name,
              files: files.length,
              bytes: totalBytes
            });
          } catch (bucketErr) {
            bucketRows.push({
              name: bucket.name,
              files: 0,
              bytes: 0,
              error: bucketErr.message
            });
          }
        }

        if (mounted) setStorageUsage(bucketRows);
      } catch (err) {
        console.error('Errore lettura storage Supabase:', err);
        if (mounted) {
          setStorageError(
            'Non riesco a leggere lo storage Supabase con le policy attuali. Verifica i permessi Storage oppure usa una funzione backend dedicata.'
          );
        }
      } finally {
        if (mounted) setStorageLoading(false);
      }
    }

    loadStorageUsage();

    return () => {
      mounted = false;
    };
  }, [datoreView]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (componentRef.current && !componentRef.current.contains(e.target)) {
        setShowComponentSuggestions(false);
      }

      if (operatorRef.current && !operatorRef.current.contains(e.target)) {
        setShowOperatorSuggestions(false);
      }

      if (clientRef.current && !clientRef.current.contains(e.target)) {
        setShowClientSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const belowThreshold = useMemo(() => {
    return materials.filter((m) => Number(m.quantity || 0) <= Number(m.minThreshold || 0) && Number(m.minThreshold || 0) > 0);
  }, [materials]);

  const exhausted = useMemo(() => {
    return materials.filter((m) => Number(m.quantity || 0) <= 0);
  }, [materials]);

  const categoryChartData = useMemo(() => {
    const catDist = {};

    materials.forEach((m) => {
      const catName = categories.find((c) => c.id === m.category)?.name || 'Altro';
      catDist[catName] = (catDist[catName] || 0) + 1;
    });

    return {
      labels: Object.keys(catDist),
      datasets: [
        {
          data: Object.values(catDist),
          backgroundColor: CHART_COLORS.slice(0, Object.keys(catDist).length),
          borderWidth: 0
        }
      ]
    };
  }, [materials, categories]);

  const evChartData = useMemo(() => {
    return {
      labels: entriesVsExits.map((d) => {
        const p = String(d.date || '').split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}` : String(d.date || '');
      }),
      datasets: [
        {
          label: 'Entrate',
          data: entriesVsExits.map((d) => Number(d.entries || 0)),
          backgroundColor: 'rgba(34,197,94,0.7)',
          borderRadius: 4
        },
        {
          label: 'Uscite',
          data: entriesVsExits.map((d) => Number(d.exits || 0)),
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 4
        }
      ]
    };
  }, [entriesVsExits]);

  const mostMovedData = useMemo(() => {
    return {
      labels: mostMoved.map((m) => m.code || m.materialCode || '—'),
      datasets: [
        {
          label: 'Quantità movimentata',
          data: mostMoved.map((m) => Number(m.totalMoved || 0)),
          backgroundColor: 'rgba(59,130,246,0.7)',
          borderRadius: 4
        }
      ]
    };
  }, [mostMoved]);

  const belowData = useMemo(() => {
    const items = belowThreshold.slice(0, 10);

    return {
      labels: items.map((m) => m.code || '—'),
      datasets: [
        {
          label: 'Quantità attuale',
          data: items.map((m) => Number(m.quantity || 0)),
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 4
        },
        {
          label: 'Soglia minima',
          data: items.map((m) => Number(m.minThreshold || 0)),
          backgroundColor: 'rgba(251,191,36,0.4)',
          borderRadius: 4
        }
      ]
    };
  }, [belowThreshold]);

  const storageChartData = useMemo(() => {
    return {
      labels: storageUsage.map((bucket) => bucket.name),
      datasets: [
        {
          label: 'Spazio usato',
          data: storageUsage.map((bucket) => Number((bucket.bytes || 0) / 1024 / 1024)),
          backgroundColor: 'rgba(59,130,246,0.7)',
          borderRadius: 4
        }
      ]
    };
  }, [storageUsage]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
      }
    };
  }, []);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      cutout: '65%'
    };
  }, []);

  const componentSuggestions = useMemo(() => {
    const q = safeLower(searchComponent.trim());
    if (!q) return [];

    return materials
      .filter((m) =>
        safeLower(m.code).includes(q) ||
        safeLower(m.description).includes(q) ||
        safeLower(m.name).includes(q)
      )
      .slice(0, 8);
  }, [searchComponent, materials]);

  const operatorSuggestions = useMemo(() => {
    const q = safeLower(searchOperator.trim());
    if (!q) return [];

    return users
      .filter((u) =>
        safeLower(u.fullName).includes(q) ||
        safeLower(u.username).includes(q) ||
        safeLower(u.name).includes(q)
      )
      .slice(0, 8);
  }, [searchOperator, users]);

  const clientSuggestions = useMemo(() => {
    const allClients = [...new Set(movements.map((m) => m.clientName).filter(Boolean))];
    const q = safeLower(searchClient.trim());
    if (!q) return [];

    return allClients.filter((c) => safeLower(c).includes(q)).slice(0, 8);
  }, [searchClient, movements]);

  const monitoredRows = useMemo(() => {
    const componentQ = safeLower(searchComponent);
    const operatorQ = safeLower(searchOperator);
    const clientQ = safeLower(searchClient);

    return movements.filter((mov) => {
      const matchComponent =
        !componentQ ||
        safeLower(mov.materialCode).includes(componentQ) ||
        safeLower(mov.materialDescription).includes(componentQ);

      const matchOperator =
        !operatorQ ||
        safeLower(mov.operatorName).includes(operatorQ) ||
        safeLower(mov.userName).includes(operatorQ);

      const matchClient =
        !clientQ ||
        safeLower(mov.clientName).includes(clientQ);

      const matchDate =
        !searchDate ||
        String(mov.date || '').startsWith(searchDate);

      return matchComponent && matchOperator && matchClient && matchDate;
    });
  }, [movements, searchComponent, searchOperator, searchClient, searchDate]);

  if (loading || !stats) {
    return (
      <div className="animate-slideUp" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="text-muted">Caricamento dashboard in corso...</div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Piattaforma operativa · Benvenuto, {user?.fullName || user?.username}</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali Totali</div>
            <div className="kpi-value">{stats.totalMaterials ?? materials.length}</div>
            <div className="kpi-detail">{stats.totalCategories ?? categories.length} categorie</div>
          </div>
        </div>

        <div className={`kpi-card ${belowThreshold.length > 0 ? 'warning' : ''}`}>
          <div className="kpi-icon yellow">⚠️</div>
          <div className="kpi-content">
            <div className="kpi-label">Sotto Soglia</div>
            <div className="kpi-value">{stats.belowThresholdCount ?? belowThreshold.length}</div>
            <div className="kpi-detail">richiesta attenzione</div>
          </div>
        </div>

        <div className={`kpi-card ${exhausted.length > 0 ? 'danger' : ''}`}>
          <div className="kpi-icon red">🚫</div>
          <div className="kpi-content">
            <div className="kpi-label">Esauriti</div>
            <div className="kpi-value">{stats.exhaustedCount ?? exhausted.length}</div>
            <div className="kpi-detail">da riordinare</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">📋</div>
          <div className="kpi-content">
            <div className="kpi-label">Movimenti Oggi</div>
            <div className="kpi-value">{stats.todayMovements ?? 0}</div>
            <div className="kpi-detail">operazioni registrate</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">🔔</div>
          <div className="kpi-content">
            <div className="kpi-label">Notifiche Attive</div>
            <div className="kpi-value">{stats.unreadNotifications ?? notifications.length}</div>
            <div className="kpi-detail">da leggere</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon teal">🏷️</div>
          <div className="kpi-content">
            <div className="kpi-label">Categorie</div>
            <div className="kpi-value">{stats.totalCategories ?? categories.length}</div>
            <div className="kpi-detail">aree di materiale</div>
          </div>
        </div>
      </div>

      <h2 className="section-title"><span className="icon">⚡</span> Azioni Rapide</h2>
      <div className="quick-actions">
        <Link to="/inventario" className="quick-action-btn">
          <div className="quick-action-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>🔍</div>
          <span>Cerca Materiale</span>
        </Link>

        {movementAllowed && (
          <>
            <Link to="/movimento/entrata" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>📥</div>
              <span>Carica Materiale</span>
            </Link>
            <Link to="/movimento/uscita" className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>📤</div>
              <span>Scarica Materiale</span>
            </Link>
          </>
        )}

        {importAllowed && (
          <Link to="/importa" className="quick-action-btn">
            <div className="quick-action-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>📄</div>
            <span>Importa / Inserisci</span>
          </Link>
        )}

        {datoreView && (
          <Link to="/storico" className="quick-action-btn">
            <div className="quick-action-icon" style={{ background: '#ecfdf5', color: '#059669' }}>📊</div>
            <span>Storico Movimenti</span>
          </Link>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Ultimi Movimenti</h3>
            {datoreView && <Link to="/storico" className="btn btn-sm btn-ghost">Vedi tutti →</Link>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
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
                {(stats.recentMovements || []).length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted" style={{ padding: 24 }}>Nessun movimento recente</td></tr>
                ) : (
                  (stats.recentMovements || []).map((mov) => (
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

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">⚠️ Materiali Critici</h3>
            <Link to="/controllo/notifiche" className="btn btn-sm btn-ghost">Vedi tutti →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {belowThreshold.length === 0 && exhausted.length === 0 ? (
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
                  {[...exhausted, ...belowThreshold.filter((m) => Number(m.quantity || 0) > 0)]
                    .slice(0, 8)
                    .map((mat) => (
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
                        <td style={{ fontWeight: 700, color: Number(mat.quantity || 0) === 0 ? 'var(--danger-600)' : 'var(--warning-600)' }}>
                          {mat.quantity}
                        </td>
                        <td className="text-muted">{mat.minThreshold}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {datoreView && (
        <>
          <h2 className="section-title" style={{ marginTop: 28 }}>
            <span className="icon">🔎</span> Monitoraggio Datore
          </h2>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <div className="filters-row">
                <div className="filter-group" ref={componentRef} style={{ position: 'relative', minWidth: 240 }}>
                  <label>Componente</label>
                  <input
                    type="text"
                    value={searchComponent}
                    onChange={(e) => {
                      setSearchComponent(e.target.value);
                      setShowComponentSuggestions(true);
                    }}
                    onFocus={() => setShowComponentSuggestions(true)}
                    placeholder="Codice o descrizione..."
                  />

                  {showComponentSuggestions && componentSuggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--border-radius-md)',
                        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                        maxHeight: 240,
                        overflowY: 'auto'
                      }}
                    >
                      {componentSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSearchComponent(item.code || item.description || '');
                            setShowComponentSuggestions(false);
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: '10px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{item.code || 'Senza codice'}</div>
                          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{item.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="filter-group" ref={operatorRef} style={{ position: 'relative', minWidth: 240 }}>
                  <label>Operatore</label>
                  <input
                    type="text"
                    value={searchOperator}
                    onChange={(e) => {
                      setSearchOperator(e.target.value);
                      setShowOperatorSuggestions(true);
                    }}
                    onFocus={() => setShowOperatorSuggestions(true)}
                    placeholder="Nome, cognome o username..."
                  />

                  {showOperatorSuggestions && operatorSuggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--border-radius-md)',
                        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                        maxHeight: 240,
                        overflowY: 'auto'
                      }}
                    >
                      {operatorSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSearchOperator(item.fullName || item.username || item.name || '');
                            setShowOperatorSuggestions(false);
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: '10px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{item.fullName || item.name || item.username}</div>
                          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{item.username}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="filter-group" ref={clientRef} style={{ position: 'relative', minWidth: 220 }}>
                  <label>Cliente</label>
                  <input
                    type="text"
                    value={searchClient}
                    onChange={(e) => {
                      setSearchClient(e.target.value);
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => setShowClientSuggestions(true)}
                    placeholder="Nome cliente..."
                  />

                  {showClientSuggestions && clientSuggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--border-radius-md)',
                        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                        maxHeight: 240,
                        overflowY: 'auto'
                      }}
                    >
                      {clientSuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setSearchClient(item);
                            setShowClientSuggestions(false);
                          }}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: '10px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)'
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="filter-group">
                  <label>Data</label>
                  <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="table-container" style={{ marginBottom: 28 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data / Ora</th>
                  <th>Tipo</th>
                  <th>Motivazione</th>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Qtà</th>
                  <th>Prima</th>
                  <th>Dopo</th>
                  <th>Operatore</th>
                  <th>Cliente</th>
                  <th>Autorizzato da</th>
                </tr>
              </thead>

              <tbody>
                {monitoredRows.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ padding: 40 }}>
                      <div className="empty-state">
                        <div className="empty-state-icon">🔎</div>
                        <div className="empty-state-title">Nessun movimento trovato</div>
                        <div className="empty-state-text">Prova a cambiare i filtri del monitoraggio</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  monitoredRows.slice(0, 100).map((mov) => (
                    <tr key={mov.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatDate(mov.date)}</div>
                        <div className="text-xs text-muted">{formatTime(mov.date)}</div>
                      </td>
                      <td>{formatMovementType(mov.type)}</td>
                      <td>{mov.reason || mov.motivation || '—'}</td>
                      <td><strong>{mov.materialCode}</strong></td>
                      <td>{mov.materialDescription}</td>
                      <td>{mov.quantity}</td>
                      <td>{mov.previousQty ?? '—'}</td>
                      <td>{mov.newQty ?? '—'}</td>
                      <td>{mov.operatorName || mov.userName || '—'}</td>
                      <td>{mov.clientName || '—'}</td>
                      <td>{mov.authorizedBy || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-header"><h3 className="card-title">📊 Entrate vs Uscite (30 giorni)</h3></div>
              <div className="chart-container">
                {entriesVsExits.length > 0 ? (
                  <Bar data={evChartData} options={barOptions} />
                ) : (
                  <div className="empty-state"><div className="empty-state-text">Nessun dato disponibile</div></div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">🏷️ Distribuzione per Categoria</h3></div>
              <div className="chart-container">
                {categoryChartData.labels.length > 0 ? (
                  <Doughnut data={categoryChartData} options={doughnutOptions} />
                ) : (
                  <div className="empty-state"><div className="empty-state-text">Nessun dato disponibile</div></div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">🔥 Materiali Più Movimentati</h3></div>
              <div className="chart-container">
                {mostMoved.length > 0 ? (
                  <Bar data={mostMovedData} options={{ ...barOptions, indexAxis: 'y' }} />
                ) : (
                  <div className="empty-state"><div className="empty-state-text">Nessun dato</div></div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">⚠️ Materiali Sotto Soglia</h3></div>
              <div className="chart-container">
                {belowThreshold.length > 0 ? (
                  <Bar data={belowData} options={barOptions} />
                ) : (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-title">Tutto in ordine</div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">🧠 Memoria Supabase Storage</h3>
              </div>
              <div className="chart-container">
                {storageLoading ? (
                  <div className="empty-state"><div className="empty-state-text">Calcolo spazio storage...</div></div>
                ) : storageError ? (
                  <div className="empty-state" style={{ padding: 28 }}>
                    <div className="empty-state-icon">⚠️</div>
                    <div className="empty-state-title">Storage non leggibile</div>
                    <div className="empty-state-text">{storageError}</div>
                  </div>
                ) : storageUsage.length > 0 ? (
                  <Bar
                    data={storageChartData}
                    options={{
                      ...barOptions,
                      plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => `${ctx.parsed.y.toFixed(2)} MB`
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="empty-state"><div className="empty-state-text">Nessun bucket storage trovato</div></div>
                )}
              </div>

              {storageUsage.length > 0 && (
                <div className="card-body" style={{ paddingTop: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bucket</th>
                        <th>File</th>
                        <th>Spazio stimato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageUsage.map((bucket) => (
                        <tr key={bucket.name}>
                          <td><strong>{bucket.name}</strong></td>
                          <td>{bucket.files}</td>
                          <td>{formatBytes(bucket.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                    Nota: questo grafico legge Supabase Storage. La dimensione totale del database non va letta dal frontend con chiavi private.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  statsStore,
  materialStore,
  categoryStore,
  movementStore,
  notificationStore,
  userStore,
} from '../data/store';
import { useAuth } from '../App';
import {
  getSupabaseUsageMonitor,
  formatBytes,
  calcPercent,
} from '../utils/supabaseUsage';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import Icon from '../components/Icon';
import FaIcon from '../components/FaIcon';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const CHART_COLORS = [
  'rgba(249, 115, 22, 0.78)',
  'rgba(71, 85, 105, 0.78)',
  'rgba(16, 185, 129, 0.72)',
  'rgba(245, 158, 11, 0.72)',
  'rgba(100, 116, 139, 0.72)',
  'rgba(20, 184, 166, 0.70)',
  'rgba(244, 99, 76, 0.70)',
  'rgba(148, 163, 184, 0.70)',
];

const SUPABASE_USAGE_LIMIT_BYTES = 500 * 1024 * 1024;

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isDatore(user) {
  return ['datore', 'admin'].includes(normalizeRole(user?.role));
}

function formatDate(iso) {
  if (!iso) return '';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMovementType(type) {
  const labels = {
    entrata: 'Entrata',
    uscita: 'Uscita',
    reintegro: 'Reintegro',
    rettifica: 'Rettifica',
  };

  return labels[type] || type || '—';
}

function safeLower(value) {
  return String(value || '').toLowerCase();
}

function getUsageLimitBytes() {
  return SUPABASE_USAGE_LIMIT_BYTES;
}

function getRemainingBytes(usedBytes = 0) {
  return Math.max(0, getUsageLimitBytes() - Number(usedBytes || 0));
}

function getUsageColor(percent) {
  if (percent >= 85) return 'var(--danger-500)';
  if (percent >= 65) return 'var(--warning-500)';
  return 'var(--success-500)';
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

  const [supabaseUsage, setSupabaseUsage] = useState(null);
  const [supabaseUsageError, setSupabaseUsageError] = useState('');
  const [supabaseUsageLoading, setSupabaseUsageLoading] = useState(false);
  const [supabaseUsageUpdatedAt, setSupabaseUsageUpdatedAt] = useState(null);

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

  const loadSupabaseUsage = useCallback(async () => {
    if (!datoreView) return;

    try {
      setSupabaseUsageLoading(true);
      setSupabaseUsageError('');

      const usage = await getSupabaseUsageMonitor();

      setSupabaseUsage(usage);
      setSupabaseUsageUpdatedAt(new Date());
    } catch (err) {
      console.error('Errore memoria Supabase:', err);

      setSupabaseUsageError(
        err.message ||
          'Non riesco a leggere la memoria Supabase. Verifica i permessi Storage o la funzione SQL.'
      );
    } finally {
      setSupabaseUsageLoading(false);
    }
  }, [datoreView]);

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
          usrs,
        ] = await Promise.all([
          statsStore.getDashboardStats(),
          materialStore.getAll(),
          categoryStore.getAll(),
          notificationStore.getUnread(),
          datoreView ? movementStore.getAll() : Promise.resolve([]),
          datoreView ? movementStore.getMostMoved(8) : Promise.resolve([]),
          datoreView ? movementStore.getEntriesVsExits(30) : Promise.resolve([]),
          datoreView ? userStore.getAll() : Promise.resolve([]),
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
    if (!datoreView) return undefined;

    loadSupabaseUsage();

    const interval = setInterval(loadSupabaseUsage, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [datoreView, loadSupabaseUsage]);

  useEffect(() => {
    if (!datoreView) return undefined;

    const refreshUsage = () => {
      loadSupabaseUsage();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadSupabaseUsage();
      }
    };

    window.addEventListener('wm_supabase_usage_refresh', refreshUsage);
    window.addEventListener('storage', refreshUsage);
    window.addEventListener('focus', refreshUsage);
    window.addEventListener('pageshow', refreshUsage);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      window.removeEventListener('wm_supabase_usage_refresh', refreshUsage);
      window.removeEventListener('storage', refreshUsage);
      window.removeEventListener('focus', refreshUsage);
      window.removeEventListener('pageshow', refreshUsage);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [datoreView, loadSupabaseUsage]);

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

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const belowThreshold = useMemo(() => {
    return materials.filter(
      (m) =>
        Number(m.quantity || 0) <= Number(m.minThreshold || 0) &&
        Number(m.minThreshold || 0) > 0
    );
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
          borderWidth: 0,
        },
      ],
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
          backgroundColor: 'rgba(16, 185, 129, 0.78)',
          borderRadius: 4,
        },
        {
          label: 'Uscite',
          data: entriesVsExits.map((d) => Number(d.exits || 0)),
          backgroundColor: 'rgba(244, 99, 76, 0.78)',
          borderRadius: 4,
        },
      ],
    };
  }, [entriesVsExits]);

  const mostMovedData = useMemo(() => {
    return {
      labels: mostMoved.map((m) => m.code || m.materialCode || '—'),
      datasets: [
        {
          label: 'Quantità movimentata',
          data: mostMoved.map((m) => Number(m.totalMoved || 0)),
          backgroundColor: 'rgba(71, 85, 105, 0.78)',
          borderRadius: 4,
        },
      ],
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
          backgroundColor: 'rgba(244, 99, 76, 0.78)',
          borderRadius: 4,
        },
        {
          label: 'Soglia minima',
          data: items.map((m) => Number(m.minThreshold || 0)),
          backgroundColor: 'rgba(249, 115, 22, 0.22)',
          borderRadius: 4,
        },
      ],
    };
  }, [belowThreshold]);

  const supabaseUsageChartData = useMemo(() => {
    if (!supabaseUsage) {
      return {
        labels: [],
        datasets: [],
      };
    }

    return {
      labels: ['Database', 'File Storage'],
      datasets: [
        {
          data: [
            Number(supabaseUsage.databaseBytes || 0) / 1024 / 1024,
            Number(supabaseUsage.storageBytes || 0) / 1024 / 1024,
          ],
          backgroundColor: ['rgba(71, 85, 105, 0.78)', 'rgba(249, 115, 22, 0.72)'],
          borderWidth: 0,
        },
      ],
    };
  }, [supabaseUsage]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          grid: {
            color: '#f1f5f9',
          },
          beginAtZero: true,
        },
      },
    };
  }, []);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(2)} MB`,
          },
        },
      },
      cutout: '65%',
    };
  }, []);

  const simpleDoughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
      cutout: '65%',
    };
  }, []);

  const componentSuggestions = useMemo(() => {
    const q = safeLower(searchComponent.trim());

    if (!q) return [];

    return materials
      .filter(
        (m) =>
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
      .filter(
        (u) =>
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

      const matchClient = !clientQ || safeLower(mov.clientName).includes(clientQ);
      const matchDate = !searchDate || String(mov.date || '').startsWith(searchDate);

      return matchComponent && matchOperator && matchClient && matchDate;
    });
  }, [movements, searchComponent, searchOperator, searchClient, searchDate]);

  const usagePercent = supabaseUsage
    ? calcPercent(supabaseUsage.totalBytes, getUsageLimitBytes())
    : 0;

  const remainingBytes = supabaseUsage
    ? getRemainingBytes(supabaseUsage.totalBytes)
    : getUsageLimitBytes();

  if (!datoreView) {
    return <Navigate to="/inventario" replace />;
  }

  if (loading || !stats) {
    return (
      <div
        className="animate-slideUp"
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 80,
        }}
      >
        <div className="text-muted">Caricamento dashboard in corso...</div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Piattaforma operativa · Benvenuto, {user?.fullName || user?.username}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali Totali</div>
            <div className="kpi-value">{stats.totalMaterials ?? materials.length}</div>
            <div className="kpi-detail">
              {stats.totalCategories ?? categories.length} categorie
            </div>
          </div>
        </div>

        <div className={`kpi-card ${belowThreshold.length > 0 ? 'warning' : ''}`}>
          <div className="kpi-icon yellow"><Icon name="warning" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Sotto Soglia</div>
            <div className="kpi-value">
              {stats.belowThresholdCount ?? belowThreshold.length}
            </div>
            <div className="kpi-detail">richiesta attenzione</div>
          </div>
        </div>

        <div className={`kpi-card ${exhausted.length > 0 ? 'danger' : ''}`}>
          <div className="kpi-icon red"><Icon name="block" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Esauriti</div>
            <div className="kpi-value">{stats.exhaustedCount ?? exhausted.length}</div>
            <div className="kpi-detail">da riordinare</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><Icon name="assignment" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Movimenti Oggi</div>
            <div className="kpi-value">{stats.todayMovements ?? 0}</div>
            <div className="kpi-detail">operazioni registrate</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple"><Icon name="notifications" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Notifiche Attive</div>
            <div className="kpi-value">
              {stats.unreadNotifications ?? notifications.length}
            </div>
            <div className="kpi-detail">da leggere</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon teal"><Icon name="sell" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Categorie</div>
            <div className="kpi-value">{stats.totalCategories ?? categories.length}</div>
            <div className="kpi-detail">aree di materiale</div>
          </div>
        </div>
      </div>

      <h2 className="section-title">
        <Icon name="bolt" className="ui-section-icon" aria-hidden="true" />Azioni Rapide
      </h2>

      <div className="quick-actions">
        <Link to="/inventario" className="quick-action-btn">
          <div
            className="quick-action-icon"
            style={{ background: '#f3e8ff', color: '#7c3aed' }}
          >
            <Icon name="search" className="ui-inline-icon" aria-hidden="true" />
          </div>
          <span>Cerca Materiale</span>
        </Link>

        <Link to="/movimento/entrata" className="quick-action-btn">
          <div
            className="quick-action-icon"
            style={{ background: '#dcfce7', color: '#16a34a' }}
          >
            <Icon name="move_to_inbox" className="ui-inline-icon" aria-hidden="true" />
          </div>
          <span>Carica Materiale</span>
        </Link>

        <Link to="/movimento/uscita" className="quick-action-btn">
          <div
            className="quick-action-icon"
            style={{ background: '#fee2e2', color: '#dc2626' }}
          >
            <Icon name="outbox" className="ui-inline-icon" aria-hidden="true" />
          </div>
          <span>Scarica Materiale</span>
        </Link>

        <Link to="/importa" className="quick-action-btn">
          <div
            className="quick-action-icon"
            style={{ background: '#dbeafe', color: '#2563eb' }}
          >
            <Icon name="upload_file" className="ui-inline-icon" aria-hidden="true" />
          </div>
          <span>Importa / Inserisci</span>
        </Link>

        <Link to="/storico" className="quick-action-btn">
          <div
            className="quick-action-icon"
            style={{ background: '#ecfdf5', color: '#059669' }}
          >
            <Icon name="analytics" className="ui-inline-icon" aria-hidden="true" />
          </div>
          <span>Storico Movimenti</span>
        </Link>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Icon name="assignment" className="ui-section-icon" aria-hidden="true" />Ultimi Movimenti</h3>
            <Link to="/storico" className="btn btn-sm btn-ghost">
              Vedi tutti →
            </Link>
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
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center text-muted"
                      style={{ padding: 24 }}
                    >
                      Nessun movimento recente
                    </td>
                  </tr>
                ) : (
                  (stats.recentMovements || []).map((mov) => (
                    <tr key={mov.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatDate(mov.date)}</div>
                        <div className="text-xs text-muted">{formatTime(mov.date)}</div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{mov.materialCode}</div>
                        <div
                          className="text-xs text-muted"
                          style={{
                            maxWidth: 160,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {mov.materialDescription}
                        </div>
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
            <h3 className="card-title"><Icon name="warning" className="ui-section-icon" aria-hidden="true" />Materiali Critici</h3>
            <Link to="/controllo/notifiche" className="btn btn-sm btn-ghost">
              Vedi tutti →
            </Link>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {belowThreshold.length === 0 && exhausted.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon"><Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /></div>
                <div className="empty-state-title">Tutto in ordine</div>
                <div className="empty-state-text">
                  Nessun materiale in stato critico
                </div>
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
                          <div
                            className="text-xs"
                            style={{
                              maxWidth: 140,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {mat.description}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${mat.status}`}>
                            {mat.status === 'esaurito' ? 'Esaurito' : 'Sotto soglia'}
                          </span>
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            color:
                              Number(mat.quantity || 0) === 0
                                ? 'var(--danger-600)'
                                : 'var(--warning-600)',
                          }}
                        >
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

      <h2 className="section-title" style={{ marginTop: 28 }}>
        <span className="icon">🔎</span> Monitoraggio Datore
      </h2>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="filters-row">
            <div
              className="filter-group"
              ref={componentRef}
              style={{ position: 'relative', minWidth: 240 }}
            >
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
                    overflowY: 'auto',
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
                        borderBottom: '1px solid var(--gray-100)',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {item.code || 'Senza codice'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                        {item.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="filter-group"
              ref={operatorRef}
              style={{ position: 'relative', minWidth: 240 }}
            >
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
                    overflowY: 'auto',
                  }}
                >
                  {operatorSuggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSearchOperator(
                          item.fullName || item.username || item.name || ''
                        );
                        setShowOperatorSuggestions(false);
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--gray-100)',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {item.fullName || item.name || item.username}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                        {item.username}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="filter-group"
              ref={clientRef}
              style={{ position: 'relative', minWidth: 220 }}
            >
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
                    overflowY: 'auto',
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
                        borderBottom: '1px solid var(--gray-100)',
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
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
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
                    <div className="empty-state-text">
                      Prova a cambiare i filtri del monitoraggio
                    </div>
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
                  <td>
                    <strong>{mov.materialCode}</strong>
                  </td>
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
          <div className="card-header">
            <h3 className="card-title"><Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /> Entrate vs Uscite (30 giorni)</h3>
          </div>
          <div className="chart-container">
            {entriesVsExits.length > 0 ? (
              <Bar data={evChartData} options={barOptions} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">Nessun dato disponibile</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Icon name="sell" className="ui-inline-icon" aria-hidden="true" /> Distribuzione per Categoria</h3>
          </div>
          <div className="chart-container">
            {categoryChartData.labels.length > 0 ? (
              <Doughnut data={categoryChartData} options={simpleDoughnutOptions} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">Nessun dato disponibile</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Icon name="local_fire_department" className="ui-section-icon" aria-hidden="true" />Materiali Più Movimentati</h3>
          </div>
          <div className="chart-container">
            {mostMoved.length > 0 ? (
              <Bar data={mostMovedData} options={{ ...barOptions, indexAxis: 'y' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">Nessun dato</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Icon name="warning" className="ui-inline-icon" aria-hidden="true" /> Materiali Sotto Soglia</h3>
          </div>
          <div className="chart-container">
            {belowThreshold.length > 0 ? (
              <Bar data={belowData} options={barOptions} />
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon"><Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /></div>
                <div className="empty-state-title">Tutto in ordine</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Icon name="database" className="ui-section-icon" aria-hidden="true" />Memoria Supabase</h3>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={loadSupabaseUsage}
              disabled={supabaseUsageLoading}
            >
              {supabaseUsageLoading ? 'Aggiornamento...' : (<><Icon name="sync" className="ui-inline-icon" aria-hidden="true" /> Aggiorna spazio usato</>)}
            </button>
          </div>

          {supabaseUsageUpdatedAt && (
            <div
              className="text-xs text-muted"
              style={{
                padding: '0 20px 12px',
                marginTop: -4,
                fontWeight: 700,
              }}
            >
              Ultimo aggiornamento:{' '}
              {supabaseUsageUpdatedAt.toLocaleString('it-IT')}
            </div>
          )}

          <div className="chart-container" style={{ position: 'relative' }}>
            {supabaseUsage ? (
              <>
                <Doughnut data={supabaseUsageChartData} options={doughnutOptions} />

                {supabaseUsageLoading && (
                  <div
                    className="text-xs text-muted"
                    style={{
                      position: 'absolute',
                      right: 16,
                      bottom: 12,
                      background: 'rgba(255,255,255,0.92)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontWeight: 800,
                      boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
                    }}
                  >
                    Aggiornamento...
                  </div>
                )}
              </>
            ) : supabaseUsageLoading ? (
              <div className="empty-state">
                <div className="empty-state-text">Calcolo memoria Supabase...</div>
              </div>
            ) : supabaseUsageError ? (
              <div className="empty-state" style={{ padding: 28 }}>
                <div className="empty-state-icon"><Icon name="warning" className="ui-inline-icon" aria-hidden="true" /></div>
                <div className="empty-state-title">Memoria non leggibile</div>
                <div className="empty-state-text">{supabaseUsageError}</div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-text">Nessun dato memoria disponibile</div>
              </div>
            )}
          </div>

          {supabaseUsage && (
            <div className="card-body" style={{ paddingTop: 0 }}>
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-card">
                  <div className="kpi-icon blue">🗄️</div>
                  <div className="kpi-content">
                    <div className="kpi-label">Database</div>
                    <div className="kpi-value">
                      {formatBytes(supabaseUsage.databaseBytes)}
                    </div>
                    <div className="kpi-detail">Materiali, movimenti, log, utenti</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon purple">📁</div>
                  <div className="kpi-content">
                    <div className="kpi-label">File Storage</div>
                    <div className="kpi-value">
                      {formatBytes(supabaseUsage.storageBytes)}
                    </div>
                    <div className="kpi-detail">PDF, allegati e bucket</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon green"><Icon name="analytics" className="ui-inline-icon" aria-hidden="true" /></div>
                  <div className="kpi-content">
                    <div className="kpi-label">Totale Usato</div>
                    <div className="kpi-value">
                      {formatBytes(supabaseUsage.totalBytes)}
                    </div>
                    <div className="kpi-detail">
                      Usati {usagePercent}% di {formatBytes(getUsageLimitBytes())}
                    </div>
                    <div
                      className="kpi-detail"
                      style={{
                        color:
                          usagePercent >= 85
                            ? 'var(--danger-700)'
                            : usagePercent >= 65
                              ? 'var(--warning-700)'
                              : 'var(--success-700)',
                        fontWeight: 800,
                      }}
                    >
                      Restano {formatBytes(remainingBytes)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--gray-600)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>Usato: {formatBytes(supabaseUsage.totalBytes)}</span>
                  <span>Disponibile: {formatBytes(remainingBytes)}</span>
                  <span>Limite stimato: {formatBytes(getUsageLimitBytes())}</span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 12,
                    background: 'var(--gray-100)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(1, usagePercent)}%`,
                      height: '100%',
                      background: getUsageColor(usagePercent),
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tabella Database</th>
                        <th>Spazio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supabaseUsage.tables.length === 0 ? (
                        <tr>
                          <td
                            colSpan="2"
                            className="text-center text-muted"
                            style={{ padding: 24 }}
                          >
                            Nessuna tabella trovata
                          </td>
                        </tr>
                      ) : (
                        supabaseUsage.tables.slice(0, 8).map((table) => (
                          <tr key={table.tableName}>
                            <td>
                              <strong>{table.tableName}</strong>
                            </td>
                            <td>{formatBytes(table.bytes)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bucket Storage</th>
                        <th>File</th>
                        <th>Spazio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supabaseUsage.buckets.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-center text-muted"
                            style={{ padding: 24 }}
                          >
                            Nessun bucket storage trovato
                          </td>
                        </tr>
                      ) : (
                        supabaseUsage.buckets.map((bucket) => (
                          <tr key={bucket.bucketId}>
                            <td>
                              <strong>{bucket.bucketId}</strong>
                            </td>
                            <td>{bucket.files}</td>
                            <td>{formatBytes(bucket.bytes)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {supabaseUsage.updatedAt && (
                <div className="text-xs text-muted" style={{ marginTop: 10 }}>
                  Ultimo aggiornamento:{' '}
                  {new Date(supabaseUsage.updatedAt).toLocaleString('it-IT')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

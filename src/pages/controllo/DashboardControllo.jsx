import { useState, useEffect, useMemo, useRef } from 'react';
import { materialStore, categoryStore, movementStore, notificationStore, userStore } from '../../data/store';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

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

function safeLower(value) {
  return String(value || '').toLowerCase();
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function DashboardControllo() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [movementsData, setMovementsData] = useState({ mostMoved: [], entriesVsExits: [] });
  const [notifications, setNotifications] = useState([]);
  const [movements, setMovements] = useState([]);

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [mats, cats, unread, mostMoved, evs, allMovements, usrs] = await Promise.all([
          materialStore.getAll(),
          categoryStore.getAll(),
          notificationStore.getUnread(),
          movementStore.getMostMoved(8),
          movementStore.getEntriesVsExits(30),
          movementStore.getAll(),
          userStore.getAll()
        ]);

        setMaterials(Array.isArray(mats) ? mats : []);
        setCategories(Array.isArray(cats) ? cats : []);
        setNotifications(Array.isArray(unread) ? unread : []);
        setMovementsData({
          mostMoved: Array.isArray(mostMoved) ? mostMoved : [],
          entriesVsExits: Array.isArray(evs) ? evs : []
        });
        setMovements(Array.isArray(allMovements) ? allMovements : []);
        setUsers(Array.isArray(usrs) ? usrs : []);
      } catch (err) {
        console.error('Errore caricamento dati controllo:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

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

  const { mostMoved, entriesVsExits } = movementsData;

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
          backgroundColor: 'rgba(16, 185, 129, 0.78)',
          borderRadius: 4
        },
        {
          label: 'Uscite',
          data: entriesVsExits.map((d) => Number(d.exits || 0)),
          backgroundColor: 'rgba(244, 99, 76, 0.78)',
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
          label: 'Quantità totale movimentata',
          data: mostMoved.map((m) => Number(m.totalMoved || 0)),
          backgroundColor: 'rgba(71, 85, 105, 0.78)',
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
          backgroundColor: 'rgba(244, 99, 76, 0.78)',
          borderRadius: 4
        },
        {
          label: 'Soglia minima',
          data: items.map((m) => Number(m.minThreshold || 0)),
          backgroundColor: 'rgba(249, 115, 22, 0.22)',
          borderRadius: 4
        }
      ]
    };
  }, [belowThreshold]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 12, family: 'Inter' }
          }
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
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 12,
            font: { size: 12, family: 'Inter' }
          }
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

  if (loading) {
    return (
      <div className="animate-slideUp" style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <div className="text-muted">Analisi dati magazzino in corso...</div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><span className="ui-inline-icon material-symbols-rounded">trending_up</span> Dashboard Controllo</h1>
          <p className="page-subtitle">Monitoraggio avanzato e analisi del magazzino</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="ui-inline-icon material-symbols-rounded">inventory_2</span></div>
          <div className="kpi-content">
            <div className="kpi-label">Totale Materiali</div>
            <div className="kpi-value">{materials.length}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon yellow"><span className="ui-inline-icon material-symbols-rounded">warning</span></div>
          <div className="kpi-content">
            <div className="kpi-label">Sotto Soglia</div>
            <div className="kpi-value">{belowThreshold.length}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red"><span className="ui-inline-icon material-symbols-rounded">block</span></div>
          <div className="kpi-content">
            <div className="kpi-label">Esauriti</div>
            <div className="kpi-value">{exhausted.length}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="ui-inline-icon material-symbols-rounded">notifications</span></div>
          <div className="kpi-content">
            <div className="kpi-label">Notifiche Attive</div>
            <div className="kpi-value">{notifications.length}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">🔎 Monitoraggio Datore</h3>
        </div>

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
                <td colSpan="10" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🔎</div>
                    <div className="empty-state-title">Nessun movimento trovato</div>
                    <div className="empty-state-text">Prova a cambiare i filtri del monitoraggio</div>
                  </div>
                </td>
              </tr>
            ) : (
              monitoredRows.slice(0, 100).map((mov) => {
                const date = safeDate(mov.date);

                return (
                  <tr key={mov.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {date
                          ? date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </div>
                      <div className="text-xs text-muted">
                        {date
                          ? date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </div>
                    </td>
                    <td>{mov.type}</td>
                    <td><strong>{mov.materialCode}</strong></td>
                    <td>{mov.materialDescription}</td>
                    <td>{mov.quantity}</td>
                    <td>{mov.previousQty ?? '—'}</td>
                    <td>{mov.newQty ?? '—'}</td>
                    <td>{mov.operatorName || mov.userName || '—'}</td>
                    <td>{mov.clientName || '—'}</td>
                    <td>{mov.authorizedBy || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title"><span className="ui-inline-icon material-symbols-rounded">analytics</span> Entrate vs Uscite (30 giorni)</h3></div>
          <div className="chart-container">
            {entriesVsExits.length > 0 ? (
              <Bar data={evChartData} options={barOptions} />
            ) : (
              <div className="empty-state"><div className="empty-state-text">Nessun dato disponibile</div></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title"><span className="ui-inline-icon material-symbols-rounded">sell</span> Distribuzione per Categoria</h3></div>
          <div className="chart-container">
            {categoryChartData.labels.length > 0 ? (
              <Doughnut data={categoryChartData} options={doughnutOptions} />
            ) : (
              <div className="empty-state"><div className="empty-state-text">Nessun dato disponibile</div></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title"><span className="ui-section-icon material-symbols-rounded">local_fire_department</span>Materiali Più Movimentati</h3></div>
          <div className="chart-container">
            {mostMoved.length > 0 ? (
              <Bar data={mostMovedData} options={{ ...barOptions, indexAxis: 'y' }} />
            ) : (
              <div className="empty-state"><div className="empty-state-text">Nessun dato</div></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title"><span className="ui-inline-icon material-symbols-rounded">warning</span> Materiali Sotto Soglia</h3></div>
          <div className="chart-container">
            {belowThreshold.length > 0 ? (
              <Bar data={belowData} options={barOptions} />
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon"><span className="ui-inline-icon material-symbols-rounded">check_circle</span></div>
                <div className="empty-state-title">Tutto in ordine</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { materialStore, categoryStore, movementStore, notificationStore } from '../../data/store';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];

export default function DashboardControllo() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movementsData, setMovementsData] = useState({ mostMoved: [], entriesVsExits: [] });
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [mats, cats, movs, unread, mostMoved, evs] = await Promise.all([
          materialStore.getAll(),
          categoryStore.getAll(),
          movementStore.getAll(),
          notificationStore.getUnread(),
          movementStore.getMostMoved(8),
          movementStore.getEntriesVsExits(30)
        ]);
        setMaterials(mats);
        setCategories(cats);
        setNotifications(unread);
        setMovementsData({ mostMoved, entriesVsExits: evs });
      } catch (err) {
        console.error('Errore caricamento dati controllo:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="animate-slideUp" style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
       <div className="text-muted">Analisi dati magazzino in corso...</div>
    </div>
  );

  const { mostMoved, entriesVsExits } = movementsData;
  const belowThreshold = materials.filter(m => m.quantity <= m.minThreshold && m.minThreshold > 0);
  const exhausted = materials.filter(m => m.quantity <= 0);

  // Category distribution data
  const catDist = {};
  materials.forEach(m => {
    const catName = categories.find(c => c.id === m.category)?.name || 'Altro';
    catDist[catName] = (catDist[catName] || 0) + 1;
  });
  const categoryChartData = {
    labels: Object.keys(catDist),
    datasets: [{
      data: Object.values(catDist),
      backgroundColor: CHART_COLORS.slice(0, Object.keys(catDist).length),
      borderWidth: 0,
    }]
  };

  // Entries vs exits last 30 days
  const evChartData = {
    labels: entriesVsExits.map(d => { const p = d.date.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: [
      { label: 'Entrate', data: entriesVsExits.map(d => d.entries), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
      { label: 'Uscite', data: entriesVsExits.map(d => d.exits), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
    ]
  };

  // Most moved materials
  const mostMovedData = {
    labels: mostMoved.map(m => m.code),
    datasets: [{
      label: 'Quantità totale movimentata',
      data: mostMoved.map(m => m.totalMoved),
      backgroundColor: 'rgba(59,130,246,0.7)',
      borderRadius: 4,
    }]
  };

  // Below threshold chart
  const belowData = {
    labels: belowThreshold.slice(0, 10).map(m => m.code),
    datasets: [
      { label: 'Quantità attuale', data: belowThreshold.slice(0, 10).map(m => m.quantity), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
      { label: 'Soglia minima', data: belowThreshold.slice(0, 10).map(m => m.minThreshold), backgroundColor: 'rgba(251,191,36,0.4)', borderRadius: 4 },
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12, family: 'Inter' } } } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true } }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 12, family: 'Inter' } } } },
    cutout: '65%',
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Dashboard Controllo</h1>
          <p className="page-subtitle">Monitoraggio avanzato e analisi del magazzino</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue">📦</div>
          <div className="kpi-content">
            <div className="kpi-label">Totale Materiali</div>
            <div className="kpi-value">{materials.length}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon yellow">⚠️</div>
          <div className="kpi-content">
            <div className="kpi-label">Sotto Soglia</div>
            <div className="kpi-value">{belowThreshold.length}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red">🚫</div>
          <div className="kpi-content">
            <div className="kpi-label">Esauriti</div>
            <div className="kpi-value">{exhausted.length}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple">🔔</div>
          <div className="kpi-content">
            <div className="kpi-label">Notifiche Attive</div>
            <div className="kpi-value">{notifications.length}</div>
          </div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="charts-grid">
        {/* Entries vs Exits */}
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

        {/* Category Distribution */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🏷️ Distribuzione per Categoria</h3></div>
          <div className="chart-container">
            <Doughnut data={categoryChartData} options={doughnutOptions} />
          </div>
        </div>

        {/* Most Moved */}
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

        {/* Below Threshold */}
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
      </div>
    </div>
  );
}

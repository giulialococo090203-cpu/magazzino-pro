import { useState, useEffect } from 'react';
import { movementStore, categoryStore, materialStore, userStore } from '../../data/store';
import { MOVEMENT_TYPES, MOVEMENT_REASONS } from '../../data/initialData';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function formatMovType(t) {
  return MOVEMENT_TYPES.find(mt => mt.value === t)?.label || t;
}
function formatReason(r) {
  return MOVEMENT_REASONS.find(mr => mr.value === r)?.label || r || '—';
}

export default function StoricoMovimenti() {
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [users, setUsers] = useState([]);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterType, setFilterType] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    async function loadStatic() {
      try {
        const [cats, mats, usrs] = await Promise.all([
          categoryStore.getAll(),
          materialStore.getAll(),
          userStore.getAll()
        ]);
        setCategories(cats);
        setMaterials(mats);
        setUsers(usrs);
      } catch (err) {
        console.error('Errore caricamento dati statici:', err);
      }
    }
    loadStatic();
  }, []);

  useEffect(() => {
    async function loadFiltered() {
      try {
        const filtered = await movementStore.getFiltered({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          userId: filterUser || undefined,
          categoryId: filterCategory || undefined,
          materialId: filterMaterial || undefined,
          type: filterType || undefined,
        });
        setMovements(filtered);
        setPage(1);
      } catch (err) {
        console.error('Errore caricamento movimenti:', err);
      }
    }
    loadFiltered();
  }, [dateFrom, dateTo, filterUser, filterCategory, filterMaterial, filterType]);

  const totalPages = Math.ceil(movements.length / perPage);
  const paginated = movements.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterUser('');
    setFilterCategory('');
    setFilterMaterial('');
    setFilterType('');
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Storico Movimenti</h1>
          <p className="page-subtitle">{movements.length} movimenti trovati</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">🔍 Filtri di Ricerca</h3>
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>Azzera filtri</button>
        </div>
        <div className="card-body">
          <div className="filters-row">
            <div className="filter-group">
              <label>Dal:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Al:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Tipo:</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">Tutti</option>
                {MOVEMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Categoria:</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Materiale:</label>
              <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
                <option value="">Tutti</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.code} - {m.description}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Utente:</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">Tutti</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data / Ora</th>
              <th>Tipo</th>
              <th>Codice</th>
              <th>Materiale</th>
              <th style={{ textAlign: 'center' }}>Qtà</th>
              <th style={{ textAlign: 'center' }}>Prima</th>
              <th style={{ textAlign: 'center' }}>Dopo</th>
              <th>Motivo</th>
              <th>Utente</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Nessun movimento trovato</div>
                    <div className="empty-state-text">Prova a modificare i filtri di ricerca</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(mov => (
                <tr key={mov.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{formatDate(mov.date)}</div>
                    <div className="text-xs text-muted">{formatTime(mov.date)}</div>
                  </td>
                  <td>
                    <span className={`movement-badge movement-${mov.type}`}>
                      {formatMovType(mov.type)}
                    </span>
                  </td>
                  <td><strong>{mov.materialCode}</strong></td>
                  <td>
                    <div className="text-sm" title={mov.materialDescription} style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mov.materialDescription}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{mov.quantity}</td>
                  <td style={{ textAlign: 'center' }} className="text-muted">{mov.previousQty}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{mov.newQty}</td>
                  <td className="text-sm">{formatReason(mov.reason)}</td>
                  <td className="text-sm">{mov.userName || '—'}</td>
                  <td className="text-sm text-muted">{mov.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Pagina {page} di {totalPages} — {movements.length} risultati
          </div>
          <div className="pagination-buttons">
            <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ←
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) pageNum = i + 1;
              else if (page <= 4) pageNum = i + 1;
              else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = page - 3 + i;
              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button className="pagination-btn" onClick={() => setPage(p => Math.min(Math.max(1, totalPages), p + 1))} disabled={page >= totalPages}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

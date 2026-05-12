import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { materialStore, categoryStore, movementStore } from '../../data/store';
import { MOVEMENT_TYPES } from '../../data/initialData';
import { useAuth } from '../../App';
import { hasPermission } from '../../data/permissions';
import {
  DEFAULT_PRICE_SETTINGS,
  calcInstallerPrice,
  calcListPrice,
  getPriceSettings,
} from '../../utils/priceSettings';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PDF_COLORS = {
  graphite: [17, 23, 34],
  graphite2: [31, 41, 55],
  orange: [255, 106, 24],
  orangeDark: [217, 67, 8],
  cream: [255, 249, 243],
  cream2: [245, 238, 231],
  border: [214, 220, 229],
  text: [17, 24, 39],
  muted: [102, 112, 133],
  white: [255, 255, 255],
};


import Icon from '../../components/Icon';

function formatStatus(status) {
  const labels = {
    disponibile: 'Disponibile',
    sotto_soglia: 'Sotto soglia',
    esaurito: 'Esaurito',
  };

  return labels[status] || status;
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canSeeListPrice(role) {
  return [
    'operaio',
    'operatore',
    'segretaria',
    'segreteria',
    'magazziniere',
    'datore',
    'admin',
  ].includes(normalizeRole(role));
}

function canSeeInstallerPrice(role) {
  return ['segretaria', 'segreteria', 'magazziniere', 'datore', 'admin'].includes(
    normalizeRole(role)
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function getExportFileName(extension) {
  return `Inventario_Magazzino_${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function downloadTextFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const safeValue = String(value ?? '');
  const escaped = safeValue.replace(/"/g, '""');

  return `"${escaped}"`;
}

export default function Inventario() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceSettings, setPriceSettings] = useState({ ...DEFAULT_PRICE_SETTINGS });
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailMaterial, setDetailMaterial] = useState(null);
  const [materialMovements, setMaterialMovements] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const searchWrapRef = useRef(null);

  const showListPrice = canSeeListPrice(user?.role);
  const showInstallerPrice = canSeeInstallerPrice(user?.role);
  const canExportInventory = hasPermission(user, 'canExportInventory');

  const installerPriceLabel = priceSettings.installerPriceLabel || 'Prezzo installatore';

  const loadMaterialsPage = async () => {
    try {
      setLoadingMaterials(true);

      const allRows = await materialStore.getAll();

      const cleanSearch = String(search || '').trim().toLowerCase();

      const filteredRows = allRows.filter((material) => {
        const matchesSearch =
          !cleanSearch ||
          [
            material.code,
            material.description,
            material.brand,
            material.supplier,
            material.location,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(cleanSearch));

        const matchesCategory = !filterCategory || material.category === filterCategory;
        const matchesStatus = !filterStatus || material.status === filterStatus;

        return matchesSearch && matchesCategory && matchesStatus;
      });

      setTotalMaterials(filteredRows.length);
      setMaterials(filteredRows);
    } catch (err) {
      console.error('Errore caricamento materiali:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const refresh = async () => {
    try {
      const cats = await categoryStore.getAll();
      setCategories(Array.isArray(cats) ? cats : []);
      await loadMaterialsPage({ reset: true });
    } catch (err) {
      console.error('Errore durante il refresh:', err);
    }
  };

  const loadPriceSettings = async () => {
    try {
      const settings = await getPriceSettings();
      setPriceSettings(settings);
    } catch (err) {
      console.error('Errore caricamento impostazioni prezzi:', err);
      setPriceSettings({ ...DEFAULT_PRICE_SETTINGS });
    }
  };

  useEffect(() => {
    refresh();
    loadPriceSettings();
  }, []);

  useEffect(() => {
    const onPriceSettingsChanged = (event) => {
      if (event?.detail) {
        setPriceSettings(event.detail);
      } else {
        loadPriceSettings();
      }
    };

    window.addEventListener('wm_price_settings_changed', onPriceSettingsChanged);

    return () => {
      window.removeEventListener('wm_price_settings_changed', onPriceSettingsChanged);
    };
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMaterialsPage({ reset: true });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, filterCategory, filterStatus]);



  useEffect(() => {
    async function loadMovements() {
      if (detailMaterial) {
        try {
          const movs = await movementStore.getByMaterial(detailMaterial.id);
          setMaterialMovements(Array.isArray(movs) ? movs.slice(0, 20) : []);
        } catch (err) {
          console.error('Errore caricamento movimenti:', err);
        }
      } else {
        setMaterialMovements([]);
      }
    }

    loadMovements();
  }, [detailMaterial]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const getCategoryName = (id) => categoryNameById.get(id) || id;

  const filtered = useMemo(() => {
    return materials;
  }, [materials]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return [];

    return materials
      .filter(
        (m) =>
          m.code?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.brand?.toLowerCase().includes(q) ||
          getCategoryName(m.category)?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, materials, categoryNameById]);

  const buildExportRows = () => {
    return filtered.map((m) => {
      const row = {
        Codice: m.code || '',
        Descrizione: m.description || '',
        Marca: m.brand || '',
        Categoria: getCategoryName(m.category) || '',
        Quantità: m.quantity ?? 0,
        Unità: m.unit || '',
        'Soglia minima': m.minThreshold ?? 0,
        Stato: formatStatus(m.status),
        Posizione: m.location || '',
        Fornitore: m.supplier || '',
        Note: m.notes || '',
      };

      if (showListPrice) {
        row['Prezzo di listino'] = Number(calcListPrice(m.netPrice, priceSettings).toFixed(2));
      }

      if (showInstallerPrice) {
        row[installerPriceLabel] = Number(calcInstallerPrice(m.netPrice, priceSettings).toFixed(2));
      }

      return row;
    });
  };

  const exportExcel = () => {
    const data = buildExportRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, getExportFileName('xlsx'));
  };

  const exportCSV = () => {
    const data = buildExportRows();

    if (data.length === 0) {
      downloadTextFile('', getExportFileName('csv'), 'text/csv;charset=utf-8;');
      return;
    }

    const headers = Object.keys(data[0]);

    const rows = [
      headers.map(escapeCsvValue).join(';'),
      ...data.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(';')),
    ];

    const csvContent = `\uFEFF${rows.join('\n')}`;

    downloadTextFile(csvContent, getExportFileName('csv'), 'text/csv;charset=utf-8;');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Inventario Magazzino', 14, 20);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(
      `Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
      14,
      28
    );
    doc.text(`Totale materiali esportati: ${filtered.length}`, 14, 34);

    const head = ['Codice', 'Descrizione', 'Marca', 'Categoria', 'Qtà', 'UM'];

    if (showListPrice) head.push('Prezzo listino');
    if (showInstallerPrice) head.push(installerPriceLabel);

    head.push('Stato', 'Posizione', 'Fornitore');

    const tableData = filtered.map((m) => {
      const row = [
        m.code || '',
        m.description || '',
        m.brand || '',
        getCategoryName(m.category) || '',
        m.quantity ?? 0,
        m.unit || '',
      ];

      if (showListPrice) row.push(formatCurrency(calcListPrice(m.netPrice, priceSettings)));
      if (showInstallerPrice) row.push(formatCurrency(calcInstallerPrice(m.netPrice, priceSettings)));

      row.push(formatStatus(m.status), m.location || '', m.supplier || '');

      return row;
    });

    autoTable(doc, {
      startY: 40,
      head: [head],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: PDF_COLORS.graphite,
        textColor: PDF_COLORS.white,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    doc.save(getExportFileName('pdf'));
  };

  const handleExport = () => {
    if (!canExportInventory) return;

    if (exportFormat === 'excel') {
      exportExcel();
      return;
    }

    if (exportFormat === 'csv') {
      exportCSV();
      return;
    }

    if (exportFormat === 'pdf') {
      exportPDF();
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Icon name="inventory_2" className="ui-title-icon" aria-hidden="true" />Inventario Magazzino</h1>
          <p className="page-subtitle">
            {totalMaterials || filtered.length} materiali trovati · {materials.length} caricati
          </p>
        </div>

        {canExportInventory && (
          <div className="btn-group" style={{ alignItems: 'center' }}>
            <select
              className="form-control"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              style={{ width: 170 }}
              title="Scegli formato esportazione"
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>

            <button onClick={handleExport} className="btn btn-secondary">
              ⬇️ Esporta inventario
            </button>
          </div>
        )}
      </div>

      <div className="filters-row">
        <div
          className="search-bar"
          style={{ flex: 1, maxWidth: 450, position: 'relative' }}
          ref={searchWrapRef}
        >
          <span className="search-bar-icon"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /></span>
          <input
            type="text"
            className="form-control"
            placeholder="Cerca per codice, descrizione, marca o categoria..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            style={{ paddingLeft: 40 }}
          />

          {showSuggestions && suggestions.length > 0 && (
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
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearch(item.code || item.description || '');
                    setShowSuggestions(false);
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--gray-100)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.code}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {item.brand} · {getCategoryName(item.category)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-group">
          <label>Categoria:</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Tutte</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Stato:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tutti</option>
            <option value="disponibile">Disponibile</option>
            <option value="sotto_soglia">Sotto soglia</option>
            <option value="esaurito">Esaurito</option>
          </select>
        </div>
      </div>

      {loadingMaterials && (
        <div className="card" style={{ marginBottom: 12, padding: '12px 16px', fontWeight: 700 }}>
          Caricamento materiali...
        </div>
      )}

      <div className="table-container inventario-scroll-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Descrizione</th>
              <th>Marca</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'center' }}>Quantità</th>
              <th>UM</th>
              {showListPrice && <th>Prezzo di listino</th>}
              {showInstallerPrice && <th>{installerPriceLabel}</th>}
              <th>Stato</th>
              <th>Posizione</th>
              <th>Fornitore</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={10 + (showListPrice ? 1 : 0) + (showInstallerPrice ? 1 : 0)}
                  className="text-center"
                  style={{ padding: 40 }}
                >
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="inventory_2" className="ui-inline-icon" aria-hidden="true" /></div>
                    <div className="empty-state-title">Nessun materiale trovato</div>
                    <div className="empty-state-text">Prova a modificare i filtri di ricerca</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.code}</strong>
                  </td>
                  <td>{m.description}</td>
                  <td>{m.brand}</td>
                  <td>{getCategoryName(m.category)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <strong
                      style={{
                        fontSize: 15,
                        color:
                          Number(m.quantity || 0) === 0
                            ? 'var(--danger-600)'
                            : Number(m.quantity || 0) <= Number(m.minThreshold || 0)
                              ? 'var(--warning-600)'
                              : 'var(--gray-800)',
                      }}
                    >
                      {m.quantity}
                    </strong>
                  </td>
                  <td className="text-muted">{m.unit}</td>

                  {showListPrice && (
                    <td>{formatCurrency(calcListPrice(m.netPrice, priceSettings))}</td>
                  )}

                  {showInstallerPrice && (
                    <td>{formatCurrency(calcInstallerPrice(m.netPrice, priceSettings))}</td>
                  )}

                  <td>
                    <span className={`status-badge status-${m.status}`}>
                      {formatStatus(m.status)}
                    </span>
                  </td>

                  <td>{m.location}</td>
                  <td className="text-sm">{m.supplier}</td>

                  <td>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setDetailMaterial(m)}
                      title="Dettagli"
                    >
                      👁️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailMaterial && (
        <div className="modal-overlay" onClick={() => setDetailMaterial(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {detailMaterial.code} — {detailMaterial.description}
                </h3>
                <div className="text-sm text-muted">
                  {detailMaterial.brand} · {getCategoryName(detailMaterial.category)}
                </div>
              </div>
              <button className="modal-close" onClick={() => setDetailMaterial(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 20 }}>
                <div>
                  <div className="text-sm text-muted fw-semibold">Quantità Disponibile</div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color:
                        Number(detailMaterial.quantity || 0) === 0
                          ? 'var(--danger-600)'
                          : 'var(--primary-700)',
                    }}
                  >
                    {detailMaterial.quantity}{' '}
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{detailMaterial.unit}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Soglia Minima</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gray-400)' }}>
                    {detailMaterial.minThreshold}{' '}
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{detailMaterial.unit}</span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted fw-semibold">Stato</div>
                  <div style={{ marginTop: 8 }}>
                    <span
                      className={`status-badge status-${detailMaterial.status}`}
                      style={{ fontSize: 14, padding: '6px 16px' }}
                    >
                      {formatStatus(detailMaterial.status)}
                    </span>
                  </div>
                </div>
              </div>

              {(showListPrice || showInstallerPrice) && (
                <div className="form-row" style={{ marginBottom: 20 }}>
                  {showListPrice && (
                    <div>
                      <span className="text-sm text-muted fw-semibold">Prezzo di listino:</span>{' '}
                      <strong>{formatCurrency(calcListPrice(detailMaterial.netPrice, priceSettings))}</strong>
                    </div>
                  )}

                  {showInstallerPrice && (
                    <div>
                      <span className="text-sm text-muted fw-semibold">{installerPriceLabel}:</span>{' '}
                      <strong>
                        {formatCurrency(calcInstallerPrice(detailMaterial.netPrice, priceSettings))}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className="form-row" style={{ marginBottom: 20 }}>
                <div>
                  <span className="text-sm text-muted fw-semibold">Posizione:</span>{' '}
                  <strong>{detailMaterial.location || '—'}</strong>
                </div>
                <div>
                  <span className="text-sm text-muted fw-semibold">Fornitore:</span>{' '}
                  <strong>{detailMaterial.supplier || '—'}</strong>
                </div>
              </div>

              {detailMaterial.notes && (
                <div style={{ marginBottom: 20 }}>
                  <span className="text-sm text-muted fw-semibold">Note:</span>
                  <p style={{ marginTop: 4, color: 'var(--gray-600)' }}>
                    {detailMaterial.notes}
                  </p>
                </div>
              )}

              <h4 className="section-title" style={{ marginTop: 16 }}>
                <Icon name="assignment" className="ui-section-icon" aria-hidden="true" />Ultimi Movimenti
              </h4>

              {materialMovements.length === 0 ? (
                <p className="text-muted">Nessun movimento registrato</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Qtà</th>
                        <th>Operatore</th>
                        <th>Cliente</th>
                        <th>Autorizzato da</th>
                        <th>Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {materialMovements.map((mov) => {
                        const date = new Date(mov.date);

                        return (
                          <tr key={mov.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                {Number.isNaN(date.getTime())
                                  ? '—'
                                  : date.toLocaleDateString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })}
                              </div>
                              <div className="text-xs text-muted">
                                {Number.isNaN(date.getTime())
                                  ? ''
                                  : date.toLocaleTimeString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                              </div>
                            </td>

                            <td>
                              <span className={`movement-badge movement-${mov.type}`}>
                                {MOVEMENT_TYPES.find((mt) => mt.value === mov.type)?.label ||
                                  mov.type}
                              </span>
                            </td>

                            <td style={{ fontWeight: 700 }}>{mov.quantity}</td>
                            <td>{mov.operatorName || mov.userName || '—'}</td>
                            <td>{mov.clientName || '—'}</td>
                            <td>{mov.authorizedBy || '—'}</td>
                            <td className="text-muted">{mov.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailMaterial(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

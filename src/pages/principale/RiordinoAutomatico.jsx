import { useEffect, useMemo, useState } from 'react';
import { materialStore, categoryStore, adminLogStore, reorderProposalStore } from '../../data/store';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


import Icon from '../../components/Icon';
import { PDF_COLORS } from '../../utils/pdfTheme';
import ComposizioneOrdine from './ComposizioneOrdine';

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function formatDateTime() {
  return new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTodayFileName() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getSuggestedQuantity(material, multiplier = 2) {
  const currentQty = Number(material.quantity || 0);
  const minThreshold = Number(material.minThreshold || 0);

  if (minThreshold <= 0) return 0;

  const targetQty = Math.max(minThreshold * Number(multiplier || 1), minThreshold);
  return Math.max(0, Math.ceil(targetQty - currentQty));
}

function getRowTotal(material, suggestedQty) {
  return Number(material.netPrice || 0) * Number(suggestedQty || 0);
}

export default function RiordinoAutomatico({ incorporato = false, onConteggio }) {
  const { user } = useAuth();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [multiplier, setMultiplier] = useState(2);
  const [selectedIds, setSelectedIds] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [ordineAperto, setOrdineAperto] = useState(false);
  const [righeOrdine, setRigheOrdine] = useState([]);
  const [fornitoreOrdine, setFornitoreOrdine] = useState('');
  const [menuEsportaAperto, setMenuEsportaAperto] = useState(false);

  const refresh = async () => {
    try {
      setError('');

      const [mats, cats] = await Promise.all([
        materialStore.getAll(),
        categoryStore.getAll(),
      ]);

      setMaterials(Array.isArray(mats) ? mats : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error('Errore caricamento riordino:', err);
      setError('Errore durante il caricamento dei materiali sotto soglia.');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const getCategoryName = (id) => {
    return categories.find((cat) => String(cat.id) === String(id))?.name || id || '—';
  };

  const reorderRows = useMemo(() => {
    return materials
      .filter((m) => {
        const qty = Number(m.quantity || 0);
        const threshold = Number(m.minThreshold || 0);
        return threshold > 0 && qty <= threshold;
      })
      .map((m) => {
        const suggestedQty = getSuggestedQuantity(m, multiplier);

        return {
          ...m,
          suggestedQty,
          estimatedTotal: getRowTotal(m, suggestedQty),
        };
      })
      .filter((m) => Number(m.suggestedQty || 0) > 0);
  }, [materials, multiplier]);

  useEffect(() => {
    if (typeof onConteggio === 'function') onConteggio(reorderRows.length);
  }, [reorderRows.length, onConteggio]);

  const suppliers = useMemo(() => {
    return [
      ...new Set(
        reorderRows
          .map((m) => String(m.supplier || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [reorderRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reorderRows.filter((m) => {
      const matchSearch =
        !q ||
        String(m.code || '').toLowerCase().includes(q) ||
        String(m.description || '').toLowerCase().includes(q) ||
        String(m.brand || '').toLowerCase().includes(q) ||
        String(m.supplier || '').toLowerCase().includes(q);

      const matchSupplier = !filterSupplier || String(m.supplier || '') === filterSupplier;
      const matchCategory = !filterCategory || String(m.category || '') === String(filterCategory);

      return matchSearch && matchSupplier && matchCategory;
    });
  }, [reorderRows, search, filterSupplier, filterCategory]);

  const selectedRows = useMemo(() => {
    return filteredRows.filter((row) => selectedIds.includes(row.id));
  }, [filteredRows, selectedIds]);

  const rowsToExport = selectedRows.length > 0 ? selectedRows : filteredRows;

  const groupedBySupplier = useMemo(() => {
    return rowsToExport.reduce((groups, item) => {
      const supplier = String(item.supplier || '').trim() || 'Senza fornitore';

      if (!groups[supplier]) groups[supplier] = [];
      groups[supplier].push(item);

      return groups;
    }, {});
  }, [rowsToExport]);

  /*
   * Un ordine si manda a un fornitore solo: se nella selezione ce n'e' piu'
   * d'uno, il pulsante principale non prepara un unico ordine da 800 righe
   * ma rimanda alle schede dei fornitori.
   */
  const fornitoriCoinvolti = useMemo(
    () => new Set(rowsToExport.map((riga) => String(riga.supplier || '').trim() || 'Senza fornitore')),
    [rowsToExport]
  );

  const totalEstimated = useMemo(() => {
    return rowsToExport.reduce((sum, row) => sum + Number(row.estimatedTotal || 0), 0);
  }, [rowsToExport]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredRows.map((row) => row.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const buildExportRows = () => {
    return rowsToExport.map((m) => ({
      Fornitore: m.supplier || 'Senza fornitore',
      Codice: m.code || '',
      Descrizione: m.description || '',
      Marca: m.brand || '',
      Categoria: getCategoryName(m.category),
      'Quantità attuale': Number(m.quantity || 0),
      'Soglia minima': Number(m.minThreshold || 0),
      'Quantità proposta': Number(m.suggestedQty || 0),
      UM: m.unit || '',
      'Prezzo netto': Number(m.netPrice || 0),
      'Totale stimato': Number(m.estimatedTotal || 0),
      Posizione: m.location || '',
      Note: m.notes || '',
    }));
  };

  const exportExcel = async () => {
    if (rowsToExport.length === 0) {
      alert('Non ci sono materiali da riordinare.');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const rows = buildExportRows();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 38 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 34 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proposte Riordino');
    XLSX.writeFile(workbook, `Proposte_Riordino_${getTodayFileName()}.xlsx`);

    await logExport('Excel');
  };

  const exportCSV = async () => {
    if (rowsToExport.length === 0) {
      alert('Non ci sono materiali da riordinare.');
      return;
    }

    const rows = buildExportRows();
    const headers = Object.keys(rows[0]);

    const lines = [
      headers.map(csvEscape).join(';'),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
    ];

    downloadTextFile(
      `Proposte_Riordino_${getTodayFileName()}.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    );

    await logExport('CSV');
  };

  const exportPDF = async () => {
    if (rowsToExport.length === 0) {
      alert('Non ci sono materiali da riordinare.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Proposte di Riordino Automatico', 14, 18);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Generato il ${formatDateTime()}`, 14, 25);
    doc.text(`Materiali inclusi: ${rowsToExport.length}`, 14, 30);
    doc.text(`Totale stimato: ${formatCurrency(totalEstimated)}`, 14, 35);

    let startY = 42;

    Object.entries(groupedBySupplier)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([supplier, items], groupIndex) => {
        if (groupIndex > 0) {
          startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : startY + 10;
        }

        if (startY > 175) {
          doc.addPage();
          startY = 18;
        }

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Fornitore: ${supplier}`, 14, startY);

        autoTable(doc, {
          startY: startY + 4,
          head: [[
            'Codice',
            'Descrizione',
            'Marca',
            'Categoria',
            'Qtà att.',
            'Soglia',
            'Da ordinare',
            'UM',
            'Prezzo netto',
            'Totale',
            'Posizione',
          ]],
          body: items.map((m) => [
            m.code || '',
            m.description || '',
            m.brand || '',
            getCategoryName(m.category),
            Number(m.quantity || 0),
            Number(m.minThreshold || 0),
            Number(m.suggestedQty || 0),
            m.unit || '',
            formatCurrency(m.netPrice),
            formatCurrency(m.estimatedTotal),
            m.location || '',
          ]),
          styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: PDF_COLORS.graphite,
            textColor: PDF_COLORS.white,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: PDF_COLORS.cream,
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 52 },
            2: { cellWidth: 24 },
            3: { cellWidth: 28 },
            4: { cellWidth: 14, halign: 'center' },
            5: { cellWidth: 14, halign: 'center' },
            6: { cellWidth: 18, halign: 'center' },
            7: { cellWidth: 10, halign: 'center' },
            8: { cellWidth: 20, halign: 'right' },
            9: { cellWidth: 20, halign: 'right' },
            10: { cellWidth: 24 },
          },
        });
      });

    doc.save(`Proposte_Riordino_${getTodayFileName()}.pdf`);

    await logExport('PDF');
  };

  const logExport = async (format) => {
    try {
      await adminLogStore.create({
        action: `Esportazione proposte riordino ${format}`,
        entity: 'riordino',
        details:
          `Create proposte di riordino in formato ${format}. ` +
          `Materiali inclusi: ${rowsToExport.length}. ` +
          `Totale stimato: ${formatCurrency(totalEstimated)}.`,
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
      });

      setSuccess(`Proposta di riordino esportata in formato ${format}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.warn('Log esportazione riordino non salvato:', err);
    }
  };

  const saveProposal = async () => {
    if (rowsToExport.length === 0) {
      alert('Non ci sono materiali da inserire in proposta.');
      return;
    }

    const confirmed = window.confirm(
      `Vuoi salvare ${rowsToExport.length} righe come proposta ordine?\n\n` +
        'Le proposte verranno divise automaticamente per fornitore.'
    );

    if (!confirmed) return;

    try {
      setError('');

      const created = await reorderProposalStore.createFromMaterials({
        materials: rowsToExport,
        user,
        notes: `Proposta generata da Riordino Automatico - ${new Date().toLocaleString('it-IT')}`,
        multiplier,
      });

      setSuccess(`Salvate ${created.length} proposte ordine.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Errore salvataggio proposta ordine:', err);
      setError(err?.message || 'Errore durante il salvataggio della proposta ordine.');
    }
  };

  /** Apre il modulo d'ordine con le righe scelte. */
  const apriOrdine = (righe, fornitore = '') => {
    if (!righe || righe.length === 0) return;

    const fornitoriRighe = new Set(
      righe.map((riga) => String(riga.supplier || '').trim() || 'Senza fornitore')
    );

    if (fornitoriRighe.size > 1) {
      setError(
        `Nella selezione ci sono ${fornitoriRighe.size} fornitori diversi. ` +
          'Un ordine si manda a un fornitore solo: scegline uno dalle schede qui sotto, ' +
          'oppure filtra l’elenco per fornitore.'
      );

      document.querySelector('.riordino-fornitori')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setError(''), 8000);
      return;
    }

    setRigheOrdine(righe);
    setFornitoreOrdine(fornitore === 'Senza fornitore' ? '' : fornitore);
    setOrdineAperto(true);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterSupplier('');
    setFilterCategory('');
  };

  return (
    <div className={incorporato ? '' : 'animate-slideUp'}>
      <div className={`page-header ${incorporato ? 'page-header-solo-azioni' : ''}`}>
        {!incorporato && (
          <div>
            <h1 className="page-title">
              <Icon name="shopping_cart" className="ui-title-icon" aria-hidden="true" />
              Riordino Automatico
            </h1>
            <p className="page-subtitle">
              I materiali scesi sotto la soglia minima, raccolti per fornitore e pronti da ordinare
            </p>
          </div>
        )}

        <div className="riordino-azioni">
          <button className="btn btn-ghost btn-sm" onClick={refresh} title="Ricarica i materiali">
            ↻ Aggiorna
          </button>

          <div className="riordino-menu-esporta">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMenuEsportaAperto((aperto) => !aperto)}
              disabled={rowsToExport.length === 0}
            >
              Esporta elenco ▾
            </button>

            {menuEsportaAperto && (
              <div className="riordino-menu-voci">
                <button type="button" onClick={() => { setMenuEsportaAperto(false); exportExcel(); }}>
                  Excel
                </button>
                <button type="button" onClick={() => { setMenuEsportaAperto(false); exportCSV(); }}>
                  CSV
                </button>
                <button type="button" onClick={() => { setMenuEsportaAperto(false); exportPDF(); }}>
                  PDF dell’elenco
                </button>
                <button type="button" onClick={() => { setMenuEsportaAperto(false); saveProposal(); }}>
                  Salva senza compilare l’ordine
                </button>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => apriOrdine(rowsToExport, filterSupplier)}
            disabled={rowsToExport.length === 0}
          >
            <Icon name="request_quote" className="ui-inline-icon" aria-hidden="true" />{' '}
            {fornitoriCoinvolti.size > 1
              ? 'Prepara ordine…'
              : `Prepara ordine (${rowsToExport.length})`}
          </button>
        </div>
      </div>

      {success && (
        <div
          style={{
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            color: 'var(--success-700)',
            padding: '12px 18px',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 16,
            fontWeight: 800,
          }}
        >
          <Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /> {success}
        </div>
      )}

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-icon yellow"><Icon name="warning" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Materiali da riordinare</div>
            <div className="kpi-value">{filteredRows.length}</div>
            <div className="kpi-detail">sotto soglia o esauriti</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue"><Icon name="factory" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Fornitori coinvolti</div>
            <div className="kpi-value">{Object.keys(groupedBySupplier).length}</div>
            <div className="kpi-detail">raggruppamento automatico</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><Icon name="euro" className="ui-inline-icon" aria-hidden="true" /></div>
          <div className="kpi-content">
            <div className="kpi-label">Totale stimato</div>
            <div className="kpi-value">{formatCurrency(totalEstimated)}</div>
            <div className="kpi-detail">
              {selectedRows.length > 0 ? 'solo selezionati' : 'righe filtrate'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /> Restringi l’elenco</h3>
          <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
            Azzera filtri
          </button>
        </div>

        <div className="card-body">
          <div className="filters-row">
            <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
              <span className="search-bar-icon"><Icon name="search" className="ui-inline-icon" aria-hidden="true" /></span>
              <input
                type="text"
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca codice, descrizione, marca o fornitore..."
                style={{ paddingLeft: 40 }}
              />
            </div>

            <div className="filter-group">
              <label>Fornitore:</label>
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}>
                <option value="">Tutti</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Categoria:</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Tutte</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="text-xs text-muted" style={{ marginTop: 12 }}>
            I filtri restringono l’elenco qui sotto. Le quantità si scelgono più avanti, e comunque
            si possono cambiare una per una nel modulo d’ordine.
          </div>
        </div>
      </div>

      {Object.keys(groupedBySupplier).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3 className="card-title">
              <Icon name="factory" className="ui-inline-icon" aria-hidden="true" /> Ordini da
              preparare, fornitore per fornitore
            </h3>
            <span className="text-sm text-muted">
              Un ordine per fornitore: scegli da chi vuoi partire
            </span>
          </div>

          <div className="card-body">
            <div className="riordino-fornitori">
              {Object.entries(groupedBySupplier)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([supplier, items]) => {
                  const total = items.reduce(
                    (sum, row) => sum + Number(row.estimatedTotal || 0),
                    0
                  );
                  const pezzi = items.reduce(
                    (sum, row) => sum + Number(row.suggestedQty || 0),
                    0
                  );

                  return (
                    <article className="riordino-fornitore" key={supplier}>
                      <header>
                        <h4>{supplier}</h4>
                        <span>{formatCurrency(total)}</span>
                      </header>

                      <p className="riordino-fornitore-dati">
                        {items.length} {items.length === 1 ? 'materiale' : 'materiali'} ·{' '}
                        {pezzi} pezzi da ordinare
                      </p>

                      <div className="riordino-fornitore-azioni">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => apriOrdine(items, supplier)}
                        >
                          Prepara ordine
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setFilterSupplier(supplier === 'Senza fornitore' ? '' : supplier)
                          }
                        >
                          Vedi solo questi
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <div className="riordino-barra-tabella">
        <div className="riordino-selezione">
          <button type="button" className="btn btn-sm btn-secondary" onClick={toggleAllVisible}>
            {filteredRows.length > 0 &&
            filteredRows.every((row) => selectedIds.includes(row.id))
              ? 'Togli la selezione'
              : 'Seleziona tutti'}
          </button>

          <span className="text-sm">
            {selectedRows.length > 0 ? (
              <>
                <strong>{selectedRows.length}</strong> materiali selezionati: l’ordine conterrà
                solo questi
              </>
            ) : (
              <>
                Nessuna selezione: l’ordine conterrà tutti i{' '}
                <strong>{filteredRows.length}</strong> materiali dell’elenco
              </>
            )}
          </span>
        </div>

        <label className="riordino-copertura">
          <span>Quantità da ordinare</span>
          <select value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))}>
            <option value={1}>fino alla soglia minima</option>
            <option value={1.5}>soglia × 1,5</option>
            <option value={2}>soglia × 2</option>
            <option value={3}>soglia × 3</option>
            <option value={4}>soglia × 4</option>
          </select>
        </label>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 42 }}>
                <input
                  type="checkbox"
                  checked={
                    filteredRows.length > 0 &&
                    filteredRows.every((row) => selectedIds.includes(row.id))
                  }
                  onChange={toggleAllVisible}
                  title="Seleziona tutti i visibili"
                />
              </th>
              <th>Fornitore</th>
              <th>Codice</th>
              <th>Descrizione</th>
              <th>Marca</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'center' }}>Qtà attuale</th>
              <th style={{ textAlign: 'center' }}>Soglia</th>
              <th style={{ textAlign: 'center' }}>Da ordinare</th>
              <th>UM</th>
              <th>Prezzo netto</th>
              <th>Totale stimato</th>
              <th>Posizione</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: 40 }}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="check_circle" className="ui-inline-icon" aria-hidden="true" /></div>
                    <div className="empty-state-title">Nessun riordino necessario</div>
                    <div className="empty-state-text">
                      Non ci sono materiali sotto soglia con i filtri selezionati.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleSelected(m.id)}
                    />
                  </td>
                  <td className="text-sm">{m.supplier || 'Senza fornitore'}</td>
                  <td>
                    <strong>{m.code}</strong>
                  </td>
                  <td className="text-sm">{m.description}</td>
                  <td className="text-sm">{m.brand}</td>
                  <td className="text-sm">{getCategoryName(m.category)}</td>
                  <td
                    style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      color:
                        Number(m.quantity || 0) <= 0
                          ? 'var(--danger-600)'
                          : 'var(--warning-600)',
                    }}
                  >
                    {m.quantity}
                  </td>
                  <td style={{ textAlign: 'center' }}>{m.minThreshold}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900 }}>
                    {m.suggestedQty}
                  </td>
                  <td>{m.unit}</td>
                  <td>{formatCurrency(m.netPrice)}</td>
                  <td style={{ fontWeight: 800 }}>{formatCurrency(m.estimatedTotal)}</td>
                  <td className="text-sm">{m.location || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedRows.length > 0 && (
        <div className="text-sm text-muted" style={{ marginTop: 12, fontWeight: 700 }}>
          Righe selezionate: {selectedRows.length}. Le esportazioni useranno solo queste righe.
        </div>
      )}
      {ordineAperto && (
        <ComposizioneOrdine
          righeIniziali={righeOrdine}
          materiali={materials}
          fornitorePredefinito={fornitoreOrdine}
          user={user}
          onChiudi={() => setOrdineAperto(false)}
          onSalvato={() => {
            setSuccess('Ordine salvato tra le proposte.');
            setTimeout(() => setSuccess(''), 4000);
          }}
        />
      )}

    </div>
  );
}

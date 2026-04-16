import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { materialStore, categoryStore, movementStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';

export default function ImportaFatture() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=mapping, 4=confirm, 5=done
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [results, setResults] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await categoryStore.getAll();
        setCategories(cats);
      } catch (err) {
        console.error('Errore caricamento categorie:', err);
      }
    }
    loadCats();
  }, []);

  // Real parsing of invoice/excel file
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStep(2); // Inizia elaborazione

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target.result;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        
        let allProcessed = [];
        let sheetFound = false;

        // BRUTE FORCE: Prova ogni foglio finché non trova qualcosa
        for (const wsname of wb.SheetNames) {
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (data.length < 1) continue;

          // Normalizzazione per confronto robusto
          const normalize = (str) => 
            String(str || '').toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]/g, '')
              .trim();

          const codeSyns = ['codice', 'code', 'sku', 'articolo', 'identificativo', 'idmateriale'];
          const qtySyns = ['quantita', 'qta', 'quantity', 'qty', 'pezzi', 'numero'];

          // 1. TENTA DI TROVARE LE INTESTAZIONI
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
            const normalizedRow = (data[i] || []).map(h => normalize(h));
            const hasCode = normalizedRow.some(h => codeSyns.some(s => h.includes(s) || s.includes(h)));
            const hasQty = normalizedRow.some(h => qtySyns.some(s => h.includes(s) || s.includes(h)));
            if (hasCode && hasQty) {
              headerRowIndex = i;
              break;
            }
          }

          let idxCode, idxQty, idxDesc, idxUnit, idxBrand, idxCat, idxThresh, idxLoc, idxSupp, idxNote;
          let headers = [];

          if (headerRowIndex !== -1) {
            headers = data[headerRowIndex].map(h => normalize(h));
            const findCol = (synonyms) => headers.findIndex(h => synonyms.some(s => h.includes(normalize(s)) || normalize(s).includes(h)));
            idxCode = findCol(codeSyns);
            idxQty = findCol(qtySyns);
            idxDesc = findCol(['descrizione', 'prodotto', 'nome', 'description', 'name', 'articolo']);
            idxUnit = findCol(['unita', 'um', 'unit', 'misura', 'formato']);
            idxBrand = findCol(['marca', 'brand', 'produttore', 'manuf']);
            idxCat = findCol(['categoria', 'category', 'settore', 'gruppo']);
            idxThresh = findCol(['soglia', 'scorta', 'minimo', 'min']);
            idxLoc = findCol(['posizione', 'scaffale', 'ubicazione', 'location', 'posto']);
            idxSupp = findCol(['fornitore', 'supplier', 'vendor']);
            idxNote = findCol(['note', 'notes', 'osservazioni', 'commento']);
          } else {
            // FALLBACK FORZA BRUTA: Indovina le colonne se non ci sono intestazioni
            console.log('Modalità Forza Bruta: Inferenziazione colonne per foglio', wsname);
            const firstRow = data[0] || [];
            // Assume Colonna 1 (indice 1) come codice e Colonna 5 (indice 5) come quantità se i nomi falliscono
            // secondo lo schema standard dell'utente
            idxCode = headers.length > 1 ? 1 : 0; 
            idxQty = headers.length > 5 ? 5 : headers.length - 1;
            idxDesc = 2;
          }

          const rows = headerRowIndex !== -1 ? data.slice(headerRowIndex + 1) : data;
          
          for (const row of rows) {
            const rawCode = row[idxCode];
            if (rawCode === undefined || rawCode === null) continue;
            const code = String(rawCode).trim();
            if (!code || code === 'codice' || code === 'id_materiale') continue;

            const qtyStr = String(row[idxQty] || '0').replace(',', '.');
            const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, '')) || 0;
            
            const desc = String(row[idxDesc] || 'Materiale senza descrizione').trim();
            const unit = String(row[idxUnit] || 'pz').trim();
            const brand = String(row[idxBrand] || '').trim();
            const catName = String(row[idxCat] || '').trim();
            const threshold = Number(row[idxThresh]) || 10;
            const location = String(row[idxLoc] || '').trim();
            const supplier = String(row[idxSupp] || '').trim();
            const notes = String(row[idxNote] || '').trim();

            const existing = await materialStore.getByCode(code);
            let catId = existing?.category || '';
            if (!catId && catName && categories.length > 0) {
              const match = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
              if (match) catId = match.id;
            }

            allProcessed.push({
              code,
              description: existing ? existing.description : desc,
              quantity: qty,
              unit: existing ? existing.unit : unit,
              isNew: !existing,
              selected: qty > 0,
              category: catId,
              brand: brand || existing?.brand || 'Da assegnare',
              minThreshold: threshold,
              location: location || existing?.location || 'Da assegnare',
              supplier: supplier || existing?.supplier || 'Da fattura',
              notes: notes ? `${notes} (Extra)` : (existing?.notes || `Import: ${fileName}`),
              existingMaterial: existing,
            });
          }

          if (allProcessed.length > 0) {
            sheetFound = true;
            break; 
          }
        }

        if (!sheetFound) throw new Error('Impossibile trovare materiali validi in nessun foglio del file.');
        setParsedItems(allProcessed);
      } catch (err) {
        console.error('Errore Brute Force:', err);
        alert(`Errore critico: ${err.message}`);
        setStep(1);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateItem = (index, field, value) => {
    setParsedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleConfirmImport = async () => {
    let loaded = 0;
    let created = 0;
    let errors = [];

    const selectedItems = parsedItems.filter(item => item.selected);
    for (const item of selectedItems) {
      try {
        if (item.isNew && !item.existingMaterial) {
          // Create new material
          if (!item.category) {
            errors.push(`${item.code}: categoria mancante`);
            continue;
          }
          await materialStore.create({
            code: item.code,
            description: item.description,
            brand: item.brand,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            minThreshold: item.minThreshold,
            location: item.location,
            supplier: item.supplier,
            notes: item.notes,
          });
          created++;
        } else if (item.existingMaterial) {
          // Add quantity to existing material
          await movementStore.create({
            materialId: item.existingMaterial.id,
            type: 'entrata',
            quantity: item.quantity,
            reason: 'uso_interno',
            notes: `Importazione da fattura: ${fileName}`,
            userId: user.id,
            userName: user.fullName,
          });
          loaded++;
        }
      } catch (err) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    setResults({ loaded, created, errors });
    
    // Log final effort in administrative logs
    if (created > 0 || loaded > 0) {
      await adminLogStore.create({
        userId: user.id,
        entity: 'materiali',
        action: 'importazione',
        details: `Importazione completata: ${created} creati, ${loaded} aggiornati dal file ${fileName}.`
      });
    }
    
    setStep(5);
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Importa da Fatture</h1>
          <p className="page-subtitle">Carica materiali partendo da documenti di ordine o fatture</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24, background: 'white',
        borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--gray-200)',
        overflow: 'hidden'
      }}>
        {['Caricamento', 'Anteprima', 'Conferma', 'Completato'].map((label, i) => (
          <div key={i} style={{
            flex: 1, padding: '14px 16px', textAlign: 'center',
            background: step > i + 1 ? 'var(--success-50)' : step === i + 1 ? 'var(--primary-50)' : 'white',
            borderRight: i < 3 ? '1px solid var(--gray-200)' : 'none',
            color: step > i + 1 ? 'var(--success-700)' : step === i + 1 ? 'var(--primary-700)' : 'var(--gray-400)',
            fontWeight: step === i + 1 ? 700 : 500, fontSize: 13
          }}>
            <span style={{ marginRight: 6 }}>{step > i + 1 ? '✓' : i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card">
          <div className="card-body" style={{ padding: 40 }}>
            <div
              className="import-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="import-dropzone-icon">📄</div>
              <div className="import-dropzone-text">
                Clicca per selezionare un file o trascinalo qui
              </div>
              <div className="import-dropzone-hint">
                Formati supportati: PDF, Excel, CSV, XML — Qualsiasi formato fattura
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.xml,.doc,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
            <p className="text-center text-muted mt-4" style={{ fontSize: 13 }}>
              Il sistema analizzerà il documento e individuerà automaticamente i materiali contenuti.
              Potrai verificare e confermare tutto prima del caricamento.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Materiali rilevati da: {fileName}</h3>
            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" onClick={() => { setStep(1); setParsedItems([]); }}>← Indietro</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>✓</th>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Marca</th>
                  <th>Qtà</th>
                  <th>UM</th>
                  <th>Posizione</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, idx) => (
                  <tr key={idx} style={{ background: item.isNew ? 'var(--warning-50)' : 'transparent' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={e => updateItem(idx, 'selected', e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                    </td>
                    <td><strong>{item.code}</strong></td>
                    <td>{item.description}</td>
                    <td><span className="text-muted">{item.brand}</span></td>
                    <td style={{ fontWeight: 700 }}>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td><span className="text-muted">{item.location}</span></td>
                    <td>
                      {item.isNew ? (
                        <select
                          className="form-control"
                          value={item.category}
                          onChange={e => updateItem(idx, 'category', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          <option value="">Seleziona...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm">{categories.find(c => c.id === item.category)?.name || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="text-sm">
              {parsedItems.filter(i => i.selected).length} materiali selezionati ·
              <span style={{ color: parsedItems.some(i => i.isNew && i.selected && !i.category) ? 'var(--danger-600)' : 'inherit' }}>
                {parsedItems.filter(i => i.isNew && i.selected && !i.category).length} da completare
              </span>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                const missing = parsedItems.some(i => i.isNew && i.selected && !i.category);
                if (missing) {
                  alert('Seleziona una categoria per tutti i nuovi materiali prima di procedere.');
                  return;
                }
                setStep(4);
              }}
            >
              Procedi alla conferma →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Final Confirm */}
      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">✅ Riepilogo Importazione</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 15, color: 'var(--gray-700)' }}>
                Stai per importare <strong>{parsedItems.filter(i => i.selected).length}</strong> materiali
                dal file <strong>{fileName}</strong>:
              </p>
              <ul style={{ marginTop: 12, paddingLeft: 20, color: 'var(--gray-600)' }}>
                <li><strong>{parsedItems.filter(i => i.selected && !i.isNew).length}</strong> materiali esistenti — verrà aggiunta la quantità</li>
                <li><strong>{parsedItems.filter(i => i.selected && i.isNew).length}</strong> nuovi materiali — verranno creati in anagrafica</li>
              </ul>
            </div>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Modifica</button>
              <button className="btn btn-success btn-lg" onClick={handleConfirmImport}>
                ✓ Conferma Importazione
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === 5 && results && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Importazione Completata</h2>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ background: 'var(--success-50)', borderRadius: 'var(--border-radius-md)', padding: '16px 24px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success-600)' }}>{results.loaded}</div>
                <div className="text-sm text-muted">Caricati</div>
              </div>
              <div style={{ background: 'var(--primary-50)', borderRadius: 'var(--border-radius-md)', padding: '16px 24px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-600)' }}>{results.created}</div>
                <div className="text-sm text-muted">Creati</div>
              </div>
              {results.errors.length > 0 && (
                <div style={{ background: 'var(--danger-50)', borderRadius: 'var(--border-radius-md)', padding: '16px 24px' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger-600)' }}>{results.errors.length}</div>
                  <div className="text-sm text-muted">Errori</div>
                </div>
              )}
            </div>
            {results.errors.length > 0 && (
              <div style={{ textAlign: 'left', background: 'var(--danger-50)', borderRadius: 'var(--border-radius-md)', padding: 16, marginBottom: 20 }}>
                <div className="fw-semibold text-danger mb-2">Errori riscontrati:</div>
                {results.errors.map((err, i) => (
                  <div key={i} className="text-sm" style={{ color: 'var(--danger-700)', marginBottom: 4 }}>• {err}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={() => { setStep(1); setParsedItems([]); setResults(null); setFileName(''); }}>
                Importa un altro documento
              </button>
              <Link to="/inventario" className="btn btn-secondary btn-lg">
                📦 Vai all'Inventario
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { materialStore, categoryStore, movementStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import * as XLSX from 'xlsx';
import { classify, normalize } from '../../utils/classificationEngine';

export default function ImportaFatture() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=mapping, 4=confirm, 5=done
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [results, setResults] = useState(null);
  const [categories, setCategories] = useState([]);
  const [rawWorkbookData, setRawWorkbookData] = useState(null);
  const [manualMapping, setManualMapping] = useState({
    code: -1, description: -1, quantity: -1, unit: -1, brand: -1, category: -1, location: -1
  });

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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 1) throw new Error('File vuoto');
        setRawWorkbookData(data);

        // TENTA AUTO-RILEVAMENTO
        const codeSyns = ['codice', 'code', 'sku', 'articolo', 'idmateriale'];
        const qtySyns = ['quantita', 'qta', 'quantity', 'qty', 'pezzi'];

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = (data[i] || []).map(h => normalize(h));
          const hasCode = row.some(h => codeSyns.some(s => h.includes(normalize(s))));
          const hasQty = row.some(h => qtySyns.some(s => h.includes(normalize(s))));
          if (hasCode && hasQty) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex !== -1) {
          // AUTO-DETECTED
          const headers = data[headerRowIndex].map(h => normalize(h));
          const findCol = (syns) => headers.findIndex(h => syns.some(s => h.includes(normalize(s))));
          
          const mapping = {
            code: findCol(codeSyns),
            quantity: findCol(qtySyns),
            description: findCol(['descrizione', 'prodotto', 'nome', 'articolo']),
            unit: findCol(['unita', 'um', 'unit']),
            brand: findCol(['marca', 'brand']),
            category: findCol(['categoria', 'settore']),
            location: findCol(['posizione', 'scaffale'])
          };
          processItems(data.slice(headerRowIndex + 1), mapping);
        } else {
          // FAIL -> MANAUL MAPPING
          setStep(3); 
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert(`Errore: ${err.message}`);
        setStep(1);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processItems = async (rows, mapping) => {
    const processed = [];
    for (const row of rows) {
      const code = String(row[mapping.code] || '').trim();
      if (!code || code.toLowerCase() === 'codice') continue;

      const qtyStr = String(row[mapping.quantity] || '0').replace(',', '.');
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, '')) || 0;
      const desc = String(row[mapping.description] || '').trim();
      const unit = String(row[mapping.unit] || 'pz').trim();
      const brand = String(row[mapping.brand] || '').trim();
      const explicitCat = String(row[mapping.category] || '').trim();

      const existing = await materialStore.getByCode(code);
      
      // IBRIDO: Classificazione intelligente
      let suggestions = [];
      let catId = existing?.category || '';
      
      if (!catId) {
        // Se c'è una categoria nel file, prova il match esatto
        if (explicitCat) {
          const match = categories.find(c => normalize(c.name) === normalize(explicitCat));
          if (match) catId = match.id;
        }
        
        // Se ancora nulla, usa il motore di classificazione
        const classification = classify(desc || code, categories);
        suggestions = classification.slice(0, 3);
        if (suggestions[0]?.score > 70) catId = suggestions[0].id; // Auto-assegna solo se molta confidenza
      }

      processed.push({
        code,
        description: existing ? existing.description : (desc || code),
        quantity: qty,
        unit: existing ? existing.unit : unit,
        isNew: !existing,
        selected: true,
        category: catId,
        suggestions: suggestions,
        brand: brand || existing?.brand || 'Da assegnare',
        minThreshold: 10,
        location: String(row[mapping.location] || existing?.location || 'A1-01'),
        supplier: 'Importato',
        notes: `Import: ${fileName}`,
        existingMaterial: existing,
      });
    }
    setParsedItems(processed);
    setStep(2);
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
        {['Caricamento', 'Mappatura Manuale', 'Anteprima', 'Conferma', 'Completato'].map((label, i) => (
          <div key={i} style={{
            flex: 1, padding: '14px 16px', textAlign: 'center',
            background: step > i + 1 ? 'var(--success-50)' : step === i + 1 ? 'var(--primary-50)' : 'white',
            borderRight: i < 4 ? '1px solid var(--gray-200)' : 'none',
            color: step > i + 1 ? 'var(--success-700)' : step === i + 1 ? 'var(--primary-700)' : 'var(--gray-400)',
            fontWeight: (step === i + 1 || (step === 2 && i === 1)) ? 700 : 500, fontSize: 13
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

      {/* Step 3: Manual Mapping (Brute Force Mode) */}
      {step === 3 && rawWorkbookData && (
        <div className="card animate-fadeIn">
          <div className="card-header" style={{ background: 'var(--warning-50)' }}>
            <h3 className="card-title">🛡️ Mappatura Manuale (Forza Bruta)</h3>
            <p className="text-sm mt-1">L'auto-rilevamento è fallito. Indica quali colonne contengono i dati cliccando sui pulsanti:</p>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {rawWorkbookData[0].map((_, colIdx) => (
                    <th key={colIdx} style={{ minWidth: 120, textAlign: 'center' }}>
                      <select 
                        className="form-control mb-2" 
                        value={Object.keys(manualMapping).find(k => manualMapping[k] === colIdx) || ''}
                        onChange={(e) => {
                          const field = e.target.value;
                          if (field) setManualMapping(prev => ({ ...prev, [field]: colIdx }));
                        }}
                        style={{ fontSize: 11, padding: 4 }}
                      >
                        <option value="">Ignora</option>
                        <option value="code">Codice</option>
                        <option value="description">Descrizione</option>
                        <option value="quantity">Quantità</option>
                        <option value="unit">U.M.</option>
                        <option value="brand">Marca</option>
                        <option value="category">Categoria</option>
                        <option value="location">Posizione</option>
                      </select>
                      <div style={{ color: 'var(--gray-400)', fontSize: 10 }}>Col {colIdx + 1}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawWorkbookData.slice(0, 10).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ 
                        background: Object.values(manualMapping).includes(cIdx) ? 'var(--primary-50)' : 'transparent',
                        whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {String(cell || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            <button 
              className="btn btn-primary btn-lg w-100" 
              disabled={manualMapping.code === -1 || manualMapping.quantity === -1}
              onClick={() => processItems(rawWorkbookData, manualMapping)}
            >
              {manualMapping.code === -1 || manualMapping.quantity === -1 
                ? 'Seleziona almeno Codice e Quantità' 
                : 'Analizza con Mappatura Manuale →'}
            </button>
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
                        <div className="suggestion-container">
                          <select
                            className="form-control"
                            value={item.category}
                            onChange={e => updateItem(idx, 'category', e.target.value)}
                            style={{ padding: '6px 10px', fontSize: 12, border: item.category ? '1px solid var(--success-300)' : '1px solid var(--warning-300)' }}
                          >
                            <option value="">Seleziona...</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {item.category === '' && item.suggestions?.length > 0 && (
                            <div className="suggestions-list mt-1">
                              {item.suggestions.map(sug => (
                                <button 
                                  key={sug.id}
                                  className="btn-suggestion"
                                  onClick={() => updateItem(idx, 'category', sug.id)}
                                  title={`Confidenza: ${Math.round(sug.score)}%`}
                                >
                                  {sug.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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

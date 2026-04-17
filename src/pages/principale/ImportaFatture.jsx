import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { materialStore, categoryStore, movementStore, adminLogStore } from '../../data/store';
import { useAuth } from '../../App';
import { normalize, aggressiveMatch } from '../../utils/classificationEngine';
// import { predictCategory } from '../../utils/mlEngine';

import { parseFile } from '../../utils/importer/OmniParser';
import { findBestMapping } from '../../utils/importer/HeuristicAnalysis';

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

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStep(2); // Preview/Processing

    try {
      // 1. OMNI-PARSING (Acquisizione universale)
      const data = await parseFile(file);
      setRawWorkbookData(data);

      // 2. HEURISTIC ANALYSIS (Rilevamento intelligente)
      const analysis = findBestMapping(data);
      
      if (analysis && analysis.confidence > 0.6) {
        processItems(data.slice(analysis.headerRowIndex + 1), analysis.mapping);
      } else {
        // Se l'analisi è incerta, vai in Mappatura Manuale
        setStep(3);
      }
    } catch (err) {
      console.error('OmniParser Error:', err);
      alert(`Errore critico durante la lettura: ${err.message}`);
      setStep(1);
    }
  };

  const updateItem = (index, field, value) => {
    setParsedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value, isAutoAssigned: false } : item));
  };

  const applyAllSuggestions = () => {
    setParsedItems(prev => prev.map(item => {
      if (item.isNew && !item.category && item.suggestions?.length > 0) {
        return { ...item, category: item.suggestions[0].id, isAutoAssigned: true };
      }
      return item;
    }));
  };

  const processItems = async (rows, mapping) => {
    const processed = [];
    const trainingData = await materialStore.getAll();

    for (const row of rows) {
      if (!row || row.length === 0) continue;
      
      const code = String(row[mapping.code] || '').trim();
      // Salta righe vuote o estetiche
      if (!code || code === '0' || code.length < 2 || code.toLowerCase() === 'codice') continue;

      const qtyStr = String(row[mapping.quantity] || '0').replace(',', '.');
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, '')) || 0;
      const desc = String(row[mapping.description] || '').trim();
      const unit = String(row[mapping.unit] || 'pz').trim();
      const brand = String(row[mapping.brand] || '').trim();
      const explicitCat = String(row[mapping.category] || '').trim();

      // BRUTE FORCE ENGINE: Identificazione passando sia descrizione che codice
      const recognition = aggressiveMatch({ code, description: desc }, { materials: trainingData, categories: categories });
      
      let existing = recognition.bestMatch?.type === 'material' ? recognition.bestMatch.original : null;

      // Fallback esteso: se il motore non ha dato un match certo per materiale, forza ricerca su trainingData per codice
      if ((!existing || recognition.confidence !== 'certi') && code) {
        const strictMatch = trainingData.find(m => m.code.toLowerCase() === code.toLowerCase());
        if (strictMatch) {
          existing = strictMatch;
        }
      }

      let catId = existing?.category || (recognition.bestMatch?.type === 'category' ? recognition.bestMatch.id : '');
      let isAutoAssigned = recognition.confidence === 'certi' || recognition.confidence === 'probabili';
      let suggestions = recognition.allCandidates.slice(0, 5);

      processed.push({
        code: existing?.code || code,
        description: existing ? existing.description : (desc || code),
        quantity: qty,
        unit: existing ? existing.unit : unit,
        isNew: !existing,
        selected: true,
        category: catId,
        isAutoAssigned,
        confidence: recognition.confidence,
        suggestions: suggestions,
        brand: brand || existing?.brand || recognition.bestMatch?.original?.brand || 'Da assegnare',
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

  const handleConfirmImport = async () => {
    setLoading(true);
    let loaded = 0;
    let created = 0;
    let errors = [];

    const selectedItems = parsedItems.filter(item => item.selected);
    
    // GESTIONE DUPLICATI INTERNI: Raggruppa per codice
    const groupedItems = {};
    selectedItems.forEach(item => {
      const key = item.code.toLowerCase();
      if (!groupedItems[key]) {
        groupedItems[key] = { ...item };
      } else {
        groupedItems[key].quantity += item.quantity;
        // Se uno dei due era esistente, manteniamo il riferimento
        if (!groupedItems[key].existingMaterial) {
          groupedItems[key].existingMaterial = item.existingMaterial;
        }
      }
    });

    const itemsToProcess = Object.values(groupedItems);
    setLoadingProgress({ current: 0, total: itemsToProcess.length });

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      setLoadingProgress({ current: i + 1, total: itemsToProcess.length });
      
      try {
        if (item.isNew && !item.existingMaterial) {
          // Double check nel DB prima di creare (per sicurezza extra)
          const dbCheck = await materialStore.getByCode(item.code);
          if (dbCheck) {
            item.isNew = false;
            item.existingMaterial = dbCheck;
          }
        }

        if (item.isNew && !item.existingMaterial) {
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
    
    if (created > 0 || loaded > 0) {
      await adminLogStore.create({
        userId: user.id,
        entity: 'materiali',
        action: 'importazione',
        details: `Importazione completata: ${created} creati, ${loaded} aggiornati dal file ${fileName}.`
      });
    }
    
    setLoading(false);
    setStep(5);
  };


  return (
    <div className="animate-slideUp" style={{ position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <h3 style={{ marginTop: 24, fontWeight: 800 }}>Salvataggio in corso...</h3>
          <p className="text-muted">Sto elaborando i materiali nel database</p>
          <div style={{ width: 300, background: 'var(--gray-200)', height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ 
              width: `${(loadingProgress.current / loadingProgress.total) * 100}%`, 
              height: '100%', background: 'var(--primary-600)', transition: 'width 0.3s' 
            }}></div>
          </div>
          <div className="mt-2 text-sm fw-bold">
            {loadingProgress.current} di {loadingProgress.total}
          </div>
        </div>
      )}

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
              onClick={() => {
                // SALVA IN MEMORIA PER IL PROSSIMO FILE SIMILE
                const memory = JSON.parse(localStorage.getItem('import_mapping_memory') || '{}');
                const fingerprint = rawWorkbookData[0].join('|'); // Fingerprint della struttura
                memory[fingerprint] = manualMapping;
                localStorage.setItem('import_mapping_memory', JSON.stringify(memory));
                
                processItems(rawWorkbookData, manualMapping);
              }}
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
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">📋 Materiali rilevati da: {fileName}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-sm btn-outline-primary" onClick={applyAllSuggestions}>
                🪄 Applica Suggerimenti Auto
              </button>
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
                  <tr key={idx} style={{ 
                    background: item.confidence === 'certi' ? 'var(--success-25)' : 
                               item.confidence === 'probabili' ? 'var(--primary-25)' : 
                               item.isNew ? 'var(--warning-25)' : 'transparent',
                    borderLeft: item.confidence === 'certi' ? '4px solid var(--success-500)' : 
                               item.confidence === 'probabili' ? '4px solid var(--primary-500)' : 
                               item.isNew ? '4px solid var(--warning-500)' : 'none'
                  }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={e => updateItem(idx, 'selected', e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <strong>{item.code}</strong>
                        {item.confidence && (
                          <span style={{ 
                            fontSize: 9, 
                            fontWeight: 800, 
                            textTransform: 'uppercase', 
                            color: item.confidence === 'certi' ? 'var(--success-700)' : 
                                   item.confidence === 'probabili' ? 'var(--primary-700)' : 'var(--warning-700)'
                          }}>
                            {item.confidence.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{item.description}</td>
                    <td><span className="text-muted">{item.brand}</span></td>
                    <td style={{ fontWeight: 700 }}>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td><span className="text-muted">{item.location}</span></td>
                    <td>
                      <div className="suggestion-container">
                        <select
                          className="form-control"
                          value={item.category}
                          onChange={e => updateItem(idx, 'category', e.target.value)}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: 12, 
                            border: item.confidence === 'certi' ? '2px solid var(--success-400)' : 
                                   item.confidence === 'probabili' ? '2px solid var(--primary-400)' : 
                                   item.category ? '1px solid var(--gray-300)' : '2px solid var(--warning-400)',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Seleziona...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {(item.confidence !== 'certi') && item.suggestions?.filter(s => s.type === 'category').length > 0 && (
                          <div className="suggestions-list mt-1">
                            {item.suggestions.filter(s => s.type === 'category').slice(0, 3).map(sug => (
                              <button 
                                key={sug.id}
                                className="btn-suggestion"
                                onClick={() => updateItem(idx, 'category', sug.id)}
                                title={`Confidenza: ${Math.round(sug.score)}%`}
                                style={{ 
                                  opacity: sug.score / 100 + 0.3,
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  margin: '2px'
                                }}
                              >
                                {sug.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
              disabled={parsedItems.filter(i => i.selected).length === 0}
              onClick={() => {
                const missing = parsedItems.some(i => i.isNew && i.selected && !i.category);
                if (missing) {
                  alert('Seleziona una categoria per tutti i nuovi materiali prima di procedere.');
                  return;
                }
                setStep(4);
              }}
            >
              {parsedItems.filter(i => i.selected).length === 0 ? 'Nessun materiale selezionato' : 'Procedi alla conferma →'}
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

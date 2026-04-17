import { normalize } from '../classificationEngine';
import { analyzeColumnType } from '../mlEngine';

/**
 * HEURISTIC ANALYSIS
 * Identifica la mappatura ottimale delle colonne analizzando dati e intestazioni.
 */
export const findBestMapping = (data) => {
  if (!data || data.length < 1) return null;

  const numCols = Math.max(...data.slice(0, 20).map(r => (r ? r.length : 0)));
  const result = {
    mapping: {
      code: -1,
      quantity: -1,
      description: -1,
      unit: -1,
      brand: -1,
      category: -1,
      location: -1
    },
    headerRowIndex: -1,
    confidence: 0
  };

  const codeSyns = ['codice', 'code', 'sku', 'articolo', 'idmateriale', 'id_art', 'ref', 'p/n'];
  const qtySyns = ['quantita', 'qta', 'quantity', 'qty', 'pezzi', 'n.um', 'mov', 'carico', 'ammontare'];

  // 1. CERCA RIGA INTESTAZIONI (Scoring)
  let bestHeaderScore = 0;
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = (data[i] || []).map(h => normalize(String(h || '')));
    let score = 0;
    if (row.some(h => codeSyns.some(s => h.includes(normalize(s))))) score += 50;
    if (row.some(h => qtySyns.some(s => h.includes(normalize(s))))) score += 50;
    
    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      result.headerRowIndex = i;
    }
  }

  // 2. MAPPA TRAMITE INTESTAZIONI (Se trovate)
  if (result.headerRowIndex !== -1) {
    const headers = data[result.headerRowIndex].map(h => normalize(String(h || '')));
    const find = (syns) => headers.findIndex(h => syns.some(s => h.includes(normalize(s))));
    
    result.mapping.code = find(codeSyns);
    result.mapping.quantity = find(qtySyns);
    result.mapping.description = find(['descrizione', 'prodotto', 'nome', 'articolo', 'detail', 'denominazione', 'voce']);
    result.mapping.unit = find(['unita', 'um', 'unit', 'u.m.', 'misura']);
    result.mapping.brand = find(['marca', 'brand', 'produttore', 'manuf']);
    result.mapping.category = find(['categoria', 'settore', 'gruppo', 'cat']);
    result.mapping.location = find(['posizione', 'scaffale', 'ubicazione', 'posto']);
  }

  // 3. AI DATA SAMPLING (Fallback/Reinforcement)
  // Analizza il contenuto di ogni colonna
  for (let c = 0; c < numCols; c++) {
    const sample = data.slice(result.headerRowIndex + 1, result.headerRowIndex + 21).map(r => r[c]);
    const scores = analyzeColumnType(sample);
    
    // Se la colonna non è stata mappata tramite intestazione, usa i punteggi dei dati
    if (result.mapping.code === -1 && scores.code > 0.4) result.mapping.code = c;
    if (result.mapping.quantity === -1 && scores.quantity > 0.6) result.mapping.quantity = c;
    if (result.mapping.description === -1 && scores.description > 0.5) result.mapping.description = c;
  }

  // 4. LAST RESORT: Se ancora manca il Codice o Quantità, prendi le colonne più probabili
  if (result.mapping.code === -1 && numCols >= 1) result.mapping.code = 0;
  if (result.mapping.quantity === -1 && numCols >= 2) result.mapping.quantity = numCols - 1;

  // Calcolo confidenza finale
  if (result.mapping.code !== -1 && result.mapping.quantity !== -1) result.confidence = 0.8;
  if (result.headerRowIndex !== -1) result.confidence += 0.2;

  return result;
};

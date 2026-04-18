import { normalize } from '../classificationEngine';
import { analyzeColumnType } from '../mlEngine';

/**
 * HEURISTIC ANALYSIS
 * Identifica la mappatura ottimale delle colonne analizzando dati e intestazioni.
 */
export const findBestMapping = (data) => {
  if (!data || data.length < 1) return null;

  const numCols = Math.max(...data.slice(0, 20).map((r) => (r ? r.length : 0)));
  const result = {
    mapping: {
      code: -1,
      quantity: -1,
      description: -1,
      unit: -1,
      brand: -1,
      category: -1,
      location: -1,
    },
    headerRowIndex: -1,
    confidence: 0,
  };

  const codeSyns = [
    'codice',
    'code',
    'sku',
    'articolo',
    'idmateriale',
    'id_art',
    'ref',
    'p/n',
    'cod.valore',
    'cod fornitore',
    'cod_fornitore',
  ];

  const qtySyns = [
    'quantita',
    'qta',
    'quantity',
    'qty',
    'pezzi',
    'n.um',
    'mov',
    'carico',
    'ammontare',
  ];

  const descSyns = [
    'descrizione',
    'prodotto',
    'nome',
    'articolo',
    'detail',
    'denominazione',
    'voce',
  ];

  const unitSyns = ['unita', 'um', 'unit', 'u.m.', 'misura', 'st'];

  // 1. CERCA RIGA INTESTAZIONI
  let bestHeaderScore = 0;

  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = (data[i] || []).map((h) => normalize(String(h || '')));
    let score = 0;

    if (row.some((h) => codeSyns.some((s) => h.includes(normalize(s))))) score += 40;
    if (row.some((h) => qtySyns.some((s) => h.includes(normalize(s))))) score += 40;
    if (row.some((h) => descSyns.some((s) => h.includes(normalize(s))))) score += 40;
    if (row.some((h) => unitSyns.some((s) => h.includes(normalize(s))))) score += 20;

    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      result.headerRowIndex = i;
    }
  }

  // 2. MAPPA TRAMITE INTESTAZIONI
  if (result.headerRowIndex !== -1) {
    const headers = data[result.headerRowIndex].map((h) => normalize(String(h || '')));
    const find = (syns) => headers.findIndex((h) => syns.some((s) => h.includes(normalize(s))));

    result.mapping.code = find(codeSyns);
    result.mapping.quantity = find(qtySyns);
    result.mapping.description = find(descSyns);
    result.mapping.unit = find(unitSyns);
    result.mapping.brand = find(['marca', 'brand', 'produttore', 'manuf']);
    result.mapping.category = find(['categoria', 'settore', 'gruppo', 'cat']);
    result.mapping.location = find(['posizione', 'scaffale', 'ubicazione', 'posto']);
  }

  // 3. AI DATA SAMPLING
  const startRow = result.headerRowIndex >= 0 ? result.headerRowIndex + 1 : 0;

  for (let c = 0; c < numCols; c++) {
    const sample = data
      .slice(startRow, startRow + 20)
      .map((r) => r?.[c])
      .filter((v) => v !== undefined);

    const scores = analyzeColumnType(sample);

    if (result.mapping.code === -1 && scores.code > 0.4) result.mapping.code = c;
    if (result.mapping.quantity === -1 && scores.quantity > 0.6) result.mapping.quantity = c;
    if (result.mapping.description === -1 && scores.description > 0.5) result.mapping.description = c;
  }

  // 4. FALLBACK
  if (result.mapping.code === -1 && numCols >= 1) result.mapping.code = 0;
  if (result.mapping.description === -1 && numCols >= 2) result.mapping.description = 1;
  if (result.mapping.quantity === -1 && numCols >= 3) result.mapping.quantity = 2;
  if (result.mapping.unit === -1 && numCols >= 4) result.mapping.unit = 3;

  // 5. CONFIDENZA
  if (result.mapping.code !== -1) result.confidence += 0.3;
  if (result.mapping.description !== -1) result.confidence += 0.25;
  if (result.mapping.quantity !== -1) result.confidence += 0.25;
  if (result.mapping.unit !== -1) result.confidence += 0.1;
  if (result.headerRowIndex !== -1) result.confidence += 0.1;

  result.confidence = Math.min(result.confidence, 1);

  return result;
};
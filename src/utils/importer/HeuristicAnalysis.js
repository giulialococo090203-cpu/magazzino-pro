import { normalize } from '../classificationEngine';
import { analyzeColumnType } from '../mlEngine';

/**
 * HEURISTIC ANALYSIS
 * Identifica la mappatura ottimale delle colonne analizzando dati e intestazioni.
 * Versione potenziata per:
 * - Excel / CSV generici
 * - esportazioni gestionali
 * - fattura elettronica XML convertita in matrice
 * - righe con colonne articolo/prezzo/quantità non standard
 */

const DEFAULT_MAPPING = {
  code: -1,
  quantity: -1,
  description: -1,
  unit: -1,
  price: -1,
  brand: -1,
  category: -1,
  location: -1,
  supplier: -1,
  total: -1,
  vat: -1,
};

function safeString(value) {
  return String(value ?? '').trim();
}

function normalizeHeader(value) {
  return normalize(safeString(value))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompact(value) {
  return normalizeHeader(value).replace(/\s+/g, '');
}

function isEmptyRow(row = []) {
  return !Array.isArray(row) || row.every((cell) => safeString(cell) === '');
}

function parseNumberLike(value) {
  const text = safeString(value)
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikeCode(value) {
  const raw = safeString(value);
  if (!raw) return false;

  if (raw.length < 2 || raw.length > 45) return false;

  const compact = raw.replace(/\s+/g, '');

  if (/^\d{1,3}$/.test(compact)) return false;
  if (/^\d+[.,]\d+$/.test(compact)) return false;

  const hasLetter = /[a-zA-Z]/.test(compact);
  const hasDigit = /\d/.test(compact);
  const hasSeparator = /[-_./]/.test(compact);

  if (hasLetter && hasDigit) return true;
  if (hasDigit && hasSeparator && compact.length >= 5) return true;
  if (/^\d(?:-\d+){2,}/.test(compact)) return true;
  if (/^[A-Z]{2,}[\dA-Z./_-]{2,}$/i.test(compact)) return true;

  return false;
}

function looksLikeQuantity(value) {
  const num = parseNumberLike(value);
  if (num === null) return false;
  if (num < 0) return false;
  if (num > 100000) return false;

  const raw = safeString(value);
  if (/%/.test(raw)) return false;
  if (/€/.test(raw)) return false;

  return true;
}

function looksLikePrice(value) {
  const raw = safeString(value);
  if (!raw) return false;

  const num = parseNumberLike(raw);
  if (num === null) return false;
  if (num < 0) return false;

  if (/€|eur|euro/i.test(raw)) return true;
  if (/[,.]\d{2,}/.test(raw) && num > 0) return true;
  if (num > 0 && num < 100000) return true;

  return false;
}

function looksLikeDescription(value) {
  const raw = safeString(value);
  if (!raw) return false;
  if (looksLikeCode(raw)) return false;
  if (looksLikeQuantity(raw)) return false;

  const words = raw.split(/\s+/).filter(Boolean);

  return raw.length >= 8 && words.length >= 2;
}

function getSynonymGroups() {
  return {
    code: [
      'codice',
      'codice articolo',
      'cod articolo',
      'codice prodotto',
      'cod prodotto',
      'codice materiale',
      'cod materiale',
      'codice fornitore',
      'cod fornitore',
      'cod_fornitore',
      'codice interno',
      'codice ricambio',
      'cod ricambio',
      'codice ean',
      'ean',
      'barcode',
      'sku',
      'articolo',
      'id articolo',
      'idmateriale',
      'id_art',
      'ref',
      'reference',
      'riferimento',
      'part number',
      'p/n',
      'pn',
      'sap material number',
      'cod valore',
      'cod.valore',
      'codvalore',
      'material',
      'item code',
      'product code',
    ],
    quantity: [
      'quantita',
      'quantità',
      'qta',
      'qtà',
      'qty',
      'quantity',
      'pezzi',
      'pz',
      'numero',
      'n',
      'n um',
      'n.um',
      'carico',
      'mov',
      'colli',
      'pezzi ordinati',
      'quantita fatturata',
      'quantità fatturata',
    ],
    description: [
      'descrizione',
      'descrizione articolo',
      'descrizione prodotto',
      'descrizione materiale',
      'prodotto',
      'nome',
      'nome prodotto',
      'articolo descrizione',
      'denominazione',
      'voce',
      'dettaglio',
      'detail',
      'description',
      'product description',
      'beni servizi',
      'beni e servizi',
      'materiale',
    ],
    unit: [
      'unita',
      'unità',
      'um',
      'u m',
      'u.m.',
      'unita misura',
      'unità misura',
      'misura',
      'unit',
      'unit of measure',
      'st',
      'pz',
      'pce',
      'nr',
    ],
    price: [
      'prezzo',
      'price',
      'costo',
      'prezzo netto',
      'prezzo unitario',
      'prezzo_u',
      'prezzo u',
      'importo unitario',
      'valore unitario',
      'unit price',
      'net price',
      'prezzo vendita',
      'prezzo acquisto',
      'prezzo in eur',
    ],
    total: [
      'totale',
      'importo',
      'importo totale',
      'valore totale',
      'totale riga',
      'line total',
      'total',
    ],
    brand: [
      'marca',
      'brand',
      'produttore',
      'manufacturer',
      'manuf',
      'fornitore marca',
      'marchio',
    ],
    category: [
      'categoria',
      'settore',
      'gruppo',
      'cat',
      'famiglia',
      'reparto',
      'classe',
      'tipologia',
    ],
    location: [
      'posizione',
      'scaffale',
      'ubicazione',
      'posto',
      'location',
      'magazzino',
      'corsia',
      'ripiano',
      'shelf',
    ],
    supplier: [
      'fornitore',
      'supplier',
      'vendor',
      'azienda',
      'ragione sociale',
    ],
    vat: [
      'iva',
      'aliquota',
      'vat',
      'imposta',
    ],
  };
}

function headerMatches(header, synonyms) {
  const h = normalizeHeader(header);
  const compact = normalizeCompact(header);

  return synonyms.some((syn) => {
    const s = normalizeHeader(syn);
    const sCompact = normalizeCompact(syn);

    return (
      h === s ||
      h.includes(s) ||
      s.includes(h) ||
      compact === sCompact ||
      compact.includes(sCompact) ||
      sCompact.includes(compact)
    );
  });
}

function findHeaderRow(data) {
  const synonyms = getSynonymGroups();
  let best = {
    index: -1,
    score: 0,
  };

  const maxRows = Math.min(data.length, 35);

  for (let i = 0; i < maxRows; i++) {
    const row = Array.isArray(data[i]) ? data[i] : [];
    if (isEmptyRow(row)) continue;

    let score = 0;
    const normalizedRow = row.map(normalizeHeader);

    Object.entries(synonyms).forEach(([field, syns]) => {
      const found = normalizedRow.some((cell) => headerMatches(cell, syns));
      if (!found) return;

      if (field === 'code') score += 35;
      else if (field === 'description') score += 35;
      else if (field === 'quantity') score += 35;
      else if (field === 'price') score += 25;
      else if (field === 'unit') score += 15;
      else score += 10;
    });

    const filledCells = row.filter((cell) => safeString(cell)).length;
    if (filledCells >= 3) score += 5;

    if (score > best.score) {
      best = {
        index: i,
        score,
      };
    }
  }

  return best.score >= 40 ? best : { index: -1, score: 0 };
}

function assignFromHeaders(row, mapping) {
  const synonyms = getSynonymGroups();
  const headers = (row || []).map(normalizeHeader);

  Object.entries(synonyms).forEach(([field, syns]) => {
    if (!(field in mapping)) return;

    const index = headers.findIndex((header) => headerMatches(header, syns));

    if (index !== -1 && mapping[field] === -1) {
      mapping[field] = index;
    }
  });
}

function columnProfile(data, colIndex, startRow) {
  const sample = data
    .slice(startRow, startRow + 40)
    .map((row) => row?.[colIndex])
    .filter((value) => safeString(value) !== '');

  if (!sample.length) {
    return {
      count: 0,
      codeRatio: 0,
      quantityRatio: 0,
      priceRatio: 0,
      descriptionRatio: 0,
      avgLength: 0,
    };
  }

  const codeCount = sample.filter(looksLikeCode).length;
  const quantityCount = sample.filter(looksLikeQuantity).length;
  const priceCount = sample.filter(looksLikePrice).length;
  const descriptionCount = sample.filter(looksLikeDescription).length;
  const avgLength =
    sample.reduce((sum, value) => sum + safeString(value).length, 0) / sample.length;

  return {
    count: sample.length,
    codeRatio: codeCount / sample.length,
    quantityRatio: quantityCount / sample.length,
    priceRatio: priceCount / sample.length,
    descriptionRatio: descriptionCount / sample.length,
    avgLength,
    sample,
  };
}

function pickBestColumn(profiles, field, usedColumns = new Set()) {
  let bestIndex = -1;
  let bestScore = 0;

  profiles.forEach((profile, index) => {
    if (usedColumns.has(index)) return;
    if (!profile.count) return;

    let score = 0;

    if (field === 'code') {
      score = profile.codeRatio * 100;
      if (profile.avgLength >= 4 && profile.avgLength <= 25) score += 10;
    }

    if (field === 'quantity') {
      score = profile.quantityRatio * 100;
      if (profile.avgLength <= 8) score += 10;
      if (profile.priceRatio > 0.8 && profile.avgLength > 6) score -= 25;
    }

    if (field === 'description') {
      score = profile.descriptionRatio * 100;
      if (profile.avgLength >= 12) score += 20;
    }

    if (field === 'price') {
      score = profile.priceRatio * 100;
      if (profile.avgLength >= 3) score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const thresholds = {
    code: 35,
    quantity: 45,
    description: 35,
    price: 45,
  };

  return bestScore >= (thresholds[field] || 40) ? bestIndex : -1;
}

function calculateConfidence(mapping, headerRowIndex, headerScore) {
  let confidence = 0;

  if (mapping.code !== -1) confidence += 0.22;
  if (mapping.description !== -1) confidence += 0.22;
  if (mapping.quantity !== -1) confidence += 0.22;
  if (mapping.unit !== -1) confidence += 0.08;
  if (mapping.price !== -1) confidence += 0.14;
  if (mapping.brand !== -1) confidence += 0.04;
  if (mapping.category !== -1) confidence += 0.04;
  if (mapping.location !== -1) confidence += 0.02;
  if (headerRowIndex !== -1) confidence += Math.min(0.12, headerScore / 1000);

  return Math.min(1, Number(confidence.toFixed(2)));
}

export const findBestMapping = (data) => {
  if (!Array.isArray(data) || data.length < 1) return null;

  const cleanData = data.filter((row) => Array.isArray(row) && !isEmptyRow(row));

  if (!cleanData.length) return null;

  const numCols = Math.max(...cleanData.slice(0, 40).map((row) => row.length || 0));

  const result = {
    mapping: { ...DEFAULT_MAPPING },
    headerRowIndex: -1,
    confidence: 0,
    details: {
      headerScore: 0,
      usedFallback: false,
    },
  };

  const header = findHeaderRow(cleanData);

  result.headerRowIndex = header.index;
  result.details.headerScore = header.score;

  if (header.index !== -1) {
    assignFromHeaders(cleanData[header.index], result.mapping);
  }

  const startRow = result.headerRowIndex >= 0 ? result.headerRowIndex + 1 : 0;

  const profiles = Array.from({ length: numCols }, (_, colIndex) =>
    columnProfile(cleanData, colIndex, startRow)
  );

  const usedColumns = new Set(
    Object.values(result.mapping).filter((index) => Number.isInteger(index) && index >= 0)
  );

  const aiScoresByColumn = Array.from({ length: numCols }, (_, colIndex) => {
    const sample = cleanData
      .slice(startRow, startRow + 30)
      .map((row) => row?.[colIndex])
      .filter((value) => value !== undefined && value !== null && safeString(value) !== '');

    return analyzeColumnType(sample);
  });

  if (result.mapping.code === -1) {
    const aiCodeIndex = aiScoresByColumn.findIndex((score) => score.code > 0.45);
    result.mapping.code =
      aiCodeIndex !== -1 ? aiCodeIndex : pickBestColumn(profiles, 'code', usedColumns);
    if (result.mapping.code !== -1) usedColumns.add(result.mapping.code);
  }

  if (result.mapping.description === -1) {
    const aiDescIndex = aiScoresByColumn.findIndex(
      (score, index) => score.description > 0.45 && !usedColumns.has(index)
    );
    result.mapping.description =
      aiDescIndex !== -1 ? aiDescIndex : pickBestColumn(profiles, 'description', usedColumns);
    if (result.mapping.description !== -1) usedColumns.add(result.mapping.description);
  }

  if (result.mapping.quantity === -1) {
    const aiQtyIndex = aiScoresByColumn.findIndex(
      (score, index) => score.quantity > 0.55 && !usedColumns.has(index)
    );
    result.mapping.quantity =
      aiQtyIndex !== -1 ? aiQtyIndex : pickBestColumn(profiles, 'quantity', usedColumns);
    if (result.mapping.quantity !== -1) usedColumns.add(result.mapping.quantity);
  }

  if (result.mapping.price === -1) {
    result.mapping.price = pickBestColumn(profiles, 'price', usedColumns);
    if (result.mapping.price !== -1) usedColumns.add(result.mapping.price);
  }

  if (result.mapping.unit === -1) {
    const unitIndex = profiles.findIndex((profile, index) => {
      if (usedColumns.has(index)) return false;

      const values = profile.sample || [];
      if (!values.length) return false;

      const unitHits = values.filter((value) =>
        /^(pz|pce|st|nr|mt|m|kg|lt|l|conf|scat|rot|sac|plt)$/i.test(safeString(value))
      ).length;

      return unitHits / values.length >= 0.45;
    });

    if (unitIndex !== -1) {
      result.mapping.unit = unitIndex;
      usedColumns.add(unitIndex);
    }
  }

  if (result.mapping.brand === -1) {
    const brandIndex = profiles.findIndex((profile, index) => {
      if (usedColumns.has(index)) return false;

      const values = profile.sample || [];
      if (!values.length) return false;

      const avgLen = profile.avgLength || 0;
      const textRatio =
        values.filter((value) => /^[a-zA-ZÀ-ÿ0-9 .'-]{2,40}$/.test(safeString(value))).length /
        values.length;

      return textRatio >= 0.6 && avgLen >= 3 && avgLen <= 24;
    });

    if (brandIndex !== -1 && result.mapping.description !== brandIndex) {
      result.mapping.brand = brandIndex;
    }
  }

  if (
    result.mapping.code === -1 &&
    result.mapping.description === -1 &&
    result.mapping.quantity === -1
  ) {
    result.details.usedFallback = true;

    if (numCols >= 1) result.mapping.code = 0;
    if (numCols >= 2) result.mapping.description = 1;
    if (numCols >= 3) result.mapping.quantity = 2;
    if (numCols >= 4) result.mapping.unit = 3;
    if (numCols >= 5) result.mapping.price = 4;
    if (numCols >= 6) result.mapping.brand = 5;
    if (numCols >= 7) result.mapping.category = 6;
    if (numCols >= 8) result.mapping.location = 7;
  }

  if (result.mapping.description === -1 && result.mapping.code !== -1) {
    const descCandidate = profiles.findIndex(
      (profile, index) =>
        index !== result.mapping.code &&
        index !== result.mapping.quantity &&
        profile.descriptionRatio >= 0.35
    );

    if (descCandidate !== -1) result.mapping.description = descCandidate;
  }

  if (result.mapping.quantity === -1) {
    const qtyCandidate = profiles.findIndex(
      (profile, index) =>
        index !== result.mapping.code &&
        index !== result.mapping.description &&
        profile.quantityRatio >= 0.5
    );

    if (qtyCandidate !== -1) result.mapping.quantity = qtyCandidate;
  }

  result.confidence = calculateConfidence(
    result.mapping,
    result.headerRowIndex,
    result.details.headerScore
  );

  return result;
};

export default {
  findBestMapping,
};
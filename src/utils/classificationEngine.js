/**
 * BRUTE FORCE RECOGNITION ENGINE
 * Un motore di identificazione materiali e categorie ad alta resilienza.
 */

/**
 * DIZIONARIO SINONIMI E ABBREVIAZIONI
 * Gestisce le varianti comuni nel settore edile/ferramenta.
 */
const SYNONYMS_DICTIONARY = {
  'vt': 'vite',
  'viti': 'vite',
  'bl': 'bullone',
  'bulloni': 'bullone',
  'pz': 'pezzi',
  'mt': 'metri',
  'idr': 'idraulica',
  'ele': 'elettrico',
  'ferr': 'ferramenta',
  'zinc': 'zincato',
  'inox': 'inossidabile',
  'diam': 'diametro',
  'spess': 'spessore',
  'pann': 'pannello',
  'racc': 'raccordo',
  'interr': 'interruttore',
  'diff': 'differenziale',
  'magn': 'magnetotermico'
};

const KEYWORDS_DICTIONARY = {
  'Ferramenta': ['vite', 'bullone', 'dado', 'rondella', 'chiodo', 'rivetto', 'tassello', 'zincato', 'inox', 'm8', 'm10', 'm12', 'm6', 'staffa', 'cerniera', 'serratura'],
  'Elettrico': ['cavo', 'interruttore', 'differenziale', 'presa', 'spina', 'morsetto', 'quadro', 'magnetotermico', 'corrugato', 'led', 'lampada', 'scatola', 'canalina', 'frutto', 'placchetta'],
  'Idraulica': ['tubo', 'raccordo', 'valvola', 'guarnizione', 'rubinetto', 'sifone', 'multistrato', 'rame', 'pvc', 'geberit', 'pompa', 'flussostato', 'collettore', 'caldaia'],
  'Edilizia': ['cemento', 'calce', 'malta', 'mattone', 'colla', 'intonaco', 'cartongesso', 'sabbia', 'premiscelato', 'mapei', 'tegola', 'guaina', 'isolante', 'pannello'],
  'Sicurezza': ['guanti', 'casco', 'scarpe', 'occhiali', 'dpi', 'visiera', 'maschera', 'imbracatura', 'antinfortunistica', 'estintore', 'cartellistica'],
  'Utensileria': ['trapano', 'avvitatore', 'cacciavite', 'pinza', 'martello', 'mola', 'seghetto', 'chiave', 'fresa', 'disco', 'punte', 'makita', 'bosch', 'dewalt', 'beta', 'hilti'],
  'Colori e Vernici': ['pittura', 'vernice', 'smalto', 'pennello', 'rullo', 'diluente', 'colore', 'tintometro', 'stucco', 'primer', 'fissativo', 'idropittura'],
  'Legname': ['tavola', 'listello', 'pannello', 'compensato', 'abete', 'pino', 'osb', 'mdf', 'multistrato', 'truciolare', 'travatura', 'perlinato']
};

/**
 * NORMALIZZAZIONE ESTREMA
 */
export const normalize = (text) => {
  if (!text) return '';
  const stopWords = ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno'];
  
  let clean = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Rimuove accenti
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")     // Rimuove punteggiatura
    .replace(/\s+/g, " ")                             // Rimuove doppi spazi
    .trim();

  // Sostituzione sinonimi/abbreviazioni
  const words = clean.split(' ').map(w => SYNONYMS_DICTIONARY[w] || w);
  
  return words
    .filter(word => word.length > 1 && !stopWords.includes(word))
    .join(' ');
};

/**
 * DISTANZA DI LEVENSHTEIN (FUZZY MATCHING)
 */
export const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
};

export const calculateSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - levenshtein(longer, shorter)) / longerLength;
};

/**
 * ANALISI N-GRAMMI PER SIMILARITÀ SEMANTICA
 */
export const getNGrams = (text, n = 3) => {
  const grams = [];
  const clean = text.replace(/\s+/g, '');
  for (let i = 0; i <= clean.length - n; i++) {
    grams.push(clean.substring(i, i + n));
  }
  return grams;
};

export const calculateSemanticSimilarity = (s1, s2) => {
  const g1 = getNGrams(s1);
  const g2 = getNGrams(s2);
  if (g1.length === 0 || g2.length === 0) return calculateSimilarity(s1, s2);
  
  const intersection = g1.filter(g => g2.includes(g)).length;
  const union = new Set([...g1, ...g2]).size;
  return intersection / union;
};

/**
 * MOTORE AGGRESSIVO DI IDENTIFICAZIONE (BRUTE FORCE)
 */
export const aggressiveMatch = (input, { materials = [], categories = [] }) => {
  const rawInput = String(input || '').trim();
  if (!rawInput) return { match: null, alternatives: [], confidence: 'none' };

  const normInput = normalize(rawInput);
  const inputTokens = normInput.split(' ');
  
  const candidates = [];

  // --- 1. BRUTE FORCE MATCH AGAINST MATERIALS ---
  materials.forEach(mat => {
    let score = 0;
    const normCode = String(mat.code || '').toLowerCase();
    const normDesc = normalize(mat.description);
    const normBrand = normalize(mat.brand || '');

    // A. Exact Code Match (Massima priorità)
    if (rawInput.toLowerCase() === normCode) score += 100;
    else if (normInput.includes(normCode) && normCode.length > 3) score += 80;

    // B. Exact Description Match
    if (normInput === normDesc) score += 95;
    else if (normDesc.includes(normInput) || normInput.includes(normDesc)) score += 60;

    // C. Keyword Matching
    let keywordHits = 0;
    inputTokens.forEach(t => {
      if (normDesc.includes(t) || normCode.includes(t) || normBrand.includes(t)) keywordHits++;
    });
    score += (keywordHits / inputTokens.length) * 50;

    // D. Fuzzy Matching
    const fuzzySim = calculateSimilarity(normInput, normDesc);
    if (fuzzySim > 0.8) score += fuzzySim * 40;

    // E. Semantic Fallback
    const semanticSim = calculateSemanticSimilarity(normInput, normDesc);
    score += semanticSim * 30;

    if (score > 15) {
      candidates.push({ type: 'material', id: mat.id, name: mat.description, code: mat.code, score: Math.min(100, score), original: mat });
    }
  });

  // --- 2. BRUTE FORCE MATCH AGAINST CATEGORIES ---
  categories.forEach(cat => {
    let score = 0;
    const normName = normalize(cat.name);
    const keywords = KEYWORDS_DICTIONARY[cat.name] || [];

    // A. Exact Name Match
    if (normInput === normName) score += 90;
    else if (normInput.includes(normName)) score += 70;

    // B. Keyword dictionary match
    let hitCount = 0;
    inputTokens.forEach(token => {
      if (keywords.includes(token)) hitCount += 40;
      else if (keywords.some(kw => token.includes(kw) || kw.includes(token))) hitCount += 15;
    });
    score += Math.min(80, hitCount);

    // C. Fuzzy/Semantic
    const fuzzySim = calculateSimilarity(normInput, normName);
    score += fuzzySim * 30;

    if (score > 20) {
      candidates.push({ type: 'category', id: cat.id, name: cat.name, score: Math.min(100, score), original: cat });
    }
  });

  // RAGGRUPPAMENTO E RANKING
  const sorted = candidates.sort((a, b) => b.score - a.score);
  
  // Rimuovi duplicati (stesso ID e tipo)
  const unique = [];
  const seen = new Set();
  sorted.forEach(c => {
    const key = `${c.type}-${c.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  });

  const bestMatch = unique[0] || null;
  const confidence = !bestMatch ? 'none' : 
                     bestMatch.score > 85 ? 'certi' : 
                     bestMatch.score > 50 ? 'probabili' : 
                     'da_confermare';

  return {
    bestMatch,
    alternatives: unique.slice(1, 4),
    confidence,
    allCandidates: unique
  };
};

/**
 * BACKWARD COMPATIBILITY: CLASSIFY
 */
export const classify = (description, categories) => {
  const result = aggressiveMatch(description, { categories });
  return result.allCandidates
    .filter(c => c.type === 'category')
    .map(c => ({
      id: c.id,
      name: c.name,
      score: c.score,
      confidence: c.score > 75 ? 'high' : c.score > 40 ? 'medium' : 'low'
    }));
};

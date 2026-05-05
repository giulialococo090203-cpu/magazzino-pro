/**
 * CLASSIFICATION ENGINE
 * Motore di riconoscimento materiali/categorie ad alta resilienza.
 * Migliorato per import fatture, ricambi, codici Bosch/Ariston e descrizioni tecniche.
 */

const SYNONYMS_DICTIONARY = {
  vt: 'vite',
  viti: 'vite',
  vite: 'vite',
  bl: 'bullone',
  bulloni: 'bullone',
  bullone: 'bullone',
  pz: 'pezzi',
  pce: 'pezzi',
  nr: 'pezzi',
  st: 'pezzi',
  mt: 'metri',
  mtl: 'metri',
  ml: 'metri',
  kg: 'chilogrammi',
  lt: 'litri',
  l: 'litri',
  conf: 'confezione',
  scat: 'scatola',
  idr: 'idraulica',
  ele: 'elettrico',
  ferr: 'ferramenta',
  zinc: 'zincato',
  inox: 'inossidabile',
  diam: 'diametro',
  dia: 'diametro',
  spess: 'spessore',
  pann: 'pannello',
  racc: 'raccordo',
  raccordi: 'raccordo',
  interr: 'interruttore',
  diff: 'differenziale',
  magn: 'magnetotermico',
  magnotermico: 'magnetotermico',
  valv: 'valvola',
  valvole: 'valvola',
  guarn: 'guarnizione',
  ricambi: 'ricambio',
  bruc: 'bruciatore',
  circ: 'circolatore',
  ventil: 'ventilatore',
  vaso: 'vaso',
  espans: 'espansione',
  scheda: 'scheda',
  termost: 'termostato',
};

const KEYWORDS_DICTIONARY = {
  Ferramenta: [
    'vite',
    'bullone',
    'dado',
    'rondella',
    'chiodo',
    'rivetto',
    'tassello',
    'zincato',
    'inox',
    'm8',
    'm10',
    'm12',
    'm6',
    'staffa',
    'cerniera',
    'serratura',
    'barra',
    'filettata',
    'fischer',
  ],
  Elettrico: [
    'cavo',
    'interruttore',
    'differenziale',
    'presa',
    'spina',
    'morsetto',
    'quadro',
    'magnetotermico',
    'corrugato',
    'led',
    'lampada',
    'scatola',
    'canalina',
    'frutto',
    'placchetta',
    'wago',
    'gewiss',
    'abb',
    'elettrico',
    'scheda',
    'centralina',
    'sonda',
    'sensore',
  ],
  Idraulica: [
    'tubo',
    'raccordo',
    'valvola',
    'guarnizione',
    'rubinetto',
    'sifone',
    'multistrato',
    'rame',
    'pvc',
    'geberit',
    'pompa',
    'flussostato',
    'collettore',
    'caldaia',
    'bruciatore',
    'vaso',
    'espansione',
    'circolatore',
    'scambiatore',
    'termostato',
    'pressostato',
    'ventilatore',
    'manometro',
    'caldaie',
    'bosch',
    'ariston',
    'caleffi',
    'giacomini',
  ],
  Edilizia: [
    'cemento',
    'calce',
    'malta',
    'mattone',
    'colla',
    'intonaco',
    'cartongesso',
    'sabbia',
    'premiscelato',
    'mapei',
    'tegola',
    'guaina',
    'isolante',
    'pannello',
    'laterizio',
    'rasante',
  ],
  Sicurezza: [
    'guanti',
    'casco',
    'scarpe',
    'occhiali',
    'dpi',
    'visiera',
    'maschera',
    'imbracatura',
    'antinfortunistica',
    'estintore',
    'cartellistica',
    'protezione',
  ],
  Utensileria: [
    'trapano',
    'avvitatore',
    'cacciavite',
    'pinza',
    'martello',
    'mola',
    'seghetto',
    'chiave',
    'fresa',
    'disco',
    'punte',
    'makita',
    'bosch',
    'dewalt',
    'beta',
    'hilti',
    'utensile',
  ],
  'Colori e Vernici': [
    'pittura',
    'vernice',
    'smalto',
    'pennello',
    'rullo',
    'diluente',
    'colore',
    'tintometro',
    'stucco',
    'primer',
    'fissativo',
    'idropittura',
    'boero',
    'saratoga',
  ],
  Legname: [
    'tavola',
    'listello',
    'pannello',
    'compensato',
    'abete',
    'pino',
    'osb',
    'mdf',
    'multistrato',
    'truciolare',
    'travatura',
    'perlinato',
    'legno',
  ],
};

const STOP_WORDS = new Set([
  'di',
  'a',
  'da',
  'in',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'un',
  'una',
  'uno',
  'del',
  'della',
  'dello',
  'dei',
  'degli',
  'delle',
  'al',
  'allo',
  'alla',
  'ai',
  'agli',
  'alle',
  'e',
  'o',
  'ed',
  'cod',
  'codice',
  'art',
  'articolo',
  'ricambio',
  'ricambi',
  'prodotto',
  'pezzi',
]);

function safeString(value) {
  return String(value ?? '').trim();
}

function normalizeCode(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w./-]/g, '');
}

export const normalize = (text) => {
  if (!text) return '';

  const clean = safeString(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=_`~()[\]"'<>?+|\\]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').map((word) => SYNONYMS_DICTIONARY[word] || word);

  return words
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .join(' ');
};

export const tokenize = (text) => {
  return normalize(text).split(/\s+/).filter(Boolean);
};

export const levenshtein = (a, b) => {
  const s1 = safeString(a);
  const s2 = safeString(b);

  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = [];

  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
};

export const calculateSimilarity = (s1, s2) => {
  const a = safeString(s1);
  const b = safeString(s2);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (!longer.length) return 1;

  return (longer.length - levenshtein(longer, shorter)) / longer.length;
};

export const getNGrams = (text, n = 3) => {
  const grams = [];
  const clean = safeString(text).replace(/\s+/g, '');

  if (clean.length < n) return clean ? [clean] : [];

  for (let i = 0; i <= clean.length - n; i++) {
    grams.push(clean.substring(i, i + n));
  }

  return grams;
};

export const calculateSemanticSimilarity = (s1, s2) => {
  const g1 = getNGrams(s1);
  const g2 = getNGrams(s2);

  if (g1.length === 0 || g2.length === 0) return calculateSimilarity(s1, s2);

  const set1 = new Set(g1);
  const set2 = new Set(g2);

  let intersection = 0;

  set1.forEach((gram) => {
    if (set2.has(gram)) intersection++;
  });

  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : intersection / union;
};

function tokenOverlapScore(inputTokens, targetText) {
  const target = normalize(targetText);
  if (!inputTokens.length || !target) return 0;

  let hits = 0;

  inputTokens.forEach((token) => {
    if (target.includes(token)) hits++;
  });

  return hits / inputTokens.length;
}

function detectCategoryByKeywords(inputTokens, categoryName) {
  const keywords = KEYWORDS_DICTIONARY[categoryName] || [];

  if (!keywords.length || !inputTokens.length) return 0;

  let score = 0;

  inputTokens.forEach((token) => {
    if (keywords.includes(token)) score += 42;
    else if (keywords.some((kw) => token.includes(kw) || kw.includes(token))) score += 18;
  });

  return Math.min(95, score);
}

function getConfidenceFromScore(bestMatch) {
  if (!bestMatch) return 'none';

  if (bestMatch.type === 'material' && bestMatch.score >= 145) return 'certi';
  if (bestMatch.score >= 90) return 'certi';
  if (bestMatch.score >= 55) return 'probabili';
  if (bestMatch.score >= 25) return 'da_confermare';

  return 'none';
}

export const aggressiveMatch = (inputData, { materials = [], categories = [] } = {}) => {
  const { code: inputCode = '', description: inputDesc = '', brand: inputBrand = '' } =
    typeof inputData === 'string' ? { description: inputData } : inputData || {};

  const rawCode = safeString(inputCode);
  const rawDesc = safeString(inputDesc);
  const rawBrand = safeString(inputBrand);

  if (!rawCode && !rawDesc && !rawBrand) {
    return {
      bestMatch: null,
      match: null,
      alternatives: [],
      confidence: 'none',
      allCandidates: [],
    };
  }

  const normInputCode = normalizeCode(rawCode);
  const normInputDesc = normalize(rawDesc);
  const normInputBrand = normalize(rawBrand);
  const inputTokens = tokenize(`${rawDesc} ${rawBrand}`);

  const candidates = [];

  materials.forEach((mat) => {
    let score = 0;

    const matCode = safeString(mat.code);
    const normMatCode = normalizeCode(matCode);
    const normMatDesc = normalize(mat.description);
    const normMatBrand = normalize(mat.brand || '');

    if (normInputCode && normMatCode) {
      if (normInputCode === normMatCode) {
        score += 170;
      } else if (
        normInputCode.length >= 5 &&
        (normMatCode.includes(normInputCode) || normInputCode.includes(normMatCode))
      ) {
        score += 95;
      } else {
        const codeSimilarity = calculateSimilarity(normInputCode, normMatCode);
        if (codeSimilarity >= 0.86) score += codeSimilarity * 80;
      }
    }

    if (normInputDesc && normMatDesc) {
      if (normInputDesc === normMatDesc) {
        score += 100;
      } else if (normMatDesc.includes(normInputDesc) || normInputDesc.includes(normMatDesc)) {
        score += 68;
      }

      const fuzzySim = calculateSimilarity(normInputDesc, normMatDesc);
      if (fuzzySim > 0.74) score += fuzzySim * 46;

      const semanticSim = calculateSemanticSimilarity(normInputDesc, normMatDesc);
      score += semanticSim * 36;

      const overlap = tokenOverlapScore(inputTokens, `${mat.description || ''} ${mat.brand || ''}`);
      score += overlap * 58;
    }

    if (normInputBrand && normMatBrand) {
      if (normInputBrand === normMatBrand) score += 25;
      else if (normMatBrand.includes(normInputBrand) || normInputBrand.includes(normMatBrand)) {
        score += 16;
      }
    }

    if (score > 18) {
      candidates.push({
        type: 'material',
        id: mat.id,
        name: mat.description,
        code: mat.code,
        score: Math.min(220, score),
        original: mat,
      });
    }
  });

  categories.forEach((cat) => {
    let score = 0;

    const catName = safeString(cat.name);
    const normName = normalize(catName);

    if (normInputDesc && normName) {
      if (normInputDesc === normName) score += 90;
      else if (normInputDesc.includes(normName) || normName.includes(normInputDesc)) score += 58;
    }

    score += detectCategoryByKeywords(inputTokens, catName);

    if (rawCode) {
      const codePrefix = rawCode.split(/[-_/.\s]/)[0]?.toLowerCase();

      if (codePrefix) {
        const categoryPrefix = normalize(catName).slice(0, 4);
        if (categoryPrefix && codePrefix.includes(categoryPrefix.slice(0, 3))) {
          score += 14;
        }
      }
    }

    if (score > 18) {
      candidates.push({
        type: 'category',
        id: cat.id,
        name: cat.name,
        score: Math.min(110, score),
        original: cat,
      });
    }
  });

  const sorted = candidates.sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();

  sorted.forEach((candidate) => {
    const key = `${candidate.type}-${candidate.id}`;
    if (seen.has(key)) return;

    seen.add(key);
    unique.push(candidate);
  });

  const bestMatch = unique[0] || null;
  const confidence = getConfidenceFromScore(bestMatch);

  return {
    bestMatch,
    match: bestMatch,
    alternatives: unique.slice(1, 5),
    confidence,
    allCandidates: unique,
  };
};

export const classify = (description, categories) => {
  const result = aggressiveMatch(description, { categories });

  return result.allCandidates
    .filter((candidate) => candidate.type === 'category')
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      score: candidate.score,
      confidence:
        candidate.score > 75 ? 'high' : candidate.score > 40 ? 'medium' : 'low',
    }));
};

export default {
  normalize,
  tokenize,
  levenshtein,
  calculateSimilarity,
  calculateSemanticSimilarity,
  aggressiveMatch,
  classify,
};
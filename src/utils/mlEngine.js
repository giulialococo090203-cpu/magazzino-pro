import { normalize } from './classificationEngine';

/**
 * ML ENGINE
 * Classificatore leggero per categorie e rilevamento colonne.
 * Non usa servizi esterni: lavora con euristiche + similarità.
 */

const TECHNICAL_WEIGHTS = {
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
    'filettata',
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
    'magnotermico',
    'led',
    'lampada',
    'fili',
    'corrugato',
    'scheda',
    'centralina',
    'sensore',
    'sonda',
  ],
  Idraulica: [
    'tubo',
    'raccordo',
    'valvola',
    'rubinetto',
    'multistrato',
    'rame',
    'pvc',
    'geberit',
    'pompa',
    'guarnizione',
    'caldaia',
    'bruciatore',
    'vaso',
    'espansione',
    'circolatore',
    'ventilatore',
    'manometro',
    'scambiatore',
    'pressostato',
    'flussostato',
  ],
  Edilizia: [
    'cemento',
    'malta',
    'mattone',
    'colla',
    'intonaco',
    'cartongesso',
    'mapei',
    'sabbia',
    'premiscelato',
    'rasante',
    'guaina',
    'isolante',
  ],
  Sicurezza: [
    'guanti',
    'casco',
    'scarpe',
    'dpi',
    'sicurezza',
    'visiera',
    'maschera',
    'antinfortunistica',
    'protezione',
  ],
  Utensileria: [
    'trapano',
    'avvitatore',
    'cacciavite',
    'pinza',
    'martello',
    'mola',
    'utensile',
    'makita',
    'bosch',
    'beta',
    'dewalt',
    'hilti',
    'punte',
    'disco',
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
    'primer',
    'fissativo',
  ],
  Legname: [
    'tavola',
    'listello',
    'pannello',
    'compensato',
    'legno',
    'abete',
    'osb',
    'mdf',
    'multistrato',
    'truciolare',
  ],
};

function safeString(value) {
  return String(value ?? '').trim();
}

function parseNumberLike(value) {
  const raw = safeString(value);
  if (!raw) return null;

  const normalized = raw
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const getNGrams = (text, n = 3) => {
  const grams = [];
  const clean = safeString(text).replace(/\s+/g, '');

  if (!clean) return [];
  if (clean.length < n) return [clean];

  for (let i = 0; i <= clean.length - n; i++) {
    grams.push(clean.substring(i, i + n));
  }

  return grams;
};

const calculateVectorSimilarity = (vecA, vecB) => {
  const intersection = Object.keys(vecA).filter((key) => vecB[key]);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  intersection.forEach((key) => {
    dotProduct += vecA[key] * vecB[key];
  });

  Object.values(vecA).forEach((val) => {
    magA += val * val;
  });

  Object.values(vecB).forEach((val) => {
    magB += val * val;
  });

  const mag = Math.sqrt(magA) * Math.sqrt(magB);

  return mag === 0 ? 0 : dotProduct / mag;
};

function vectorize(words = []) {
  return words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
}

export const predictCategory = (description, categories = [], trainedData = []) => {
  const cleanDesc = normalize(description);
  const descGrams = getNGrams(cleanDesc);
  const words = cleanDesc.split(' ').filter(Boolean);
  const inputVector = vectorize(words);

  const results = categories.map((cat) => {
    let score = 0;

    const catName = safeString(cat.name);
    const catWeights = TECHNICAL_WEIGHTS[catName] || [];
    const catVector = vectorize(catWeights);

    words.forEach((word) => {
      catWeights.forEach((kw) => {
        if (word === kw) score += 50;
        else if (word.includes(kw) || kw.includes(word)) score += 22;
      });
    });

    const vectorSimilarity = calculateVectorSimilarity(inputVector, catVector);
    score += vectorSimilarity * 55;

    const catMaterials = trainedData.filter((material) => String(material.category) === String(cat.id));

    let nGramScore = 0;

    catMaterials.forEach((material) => {
      const matGrams = getNGrams(normalize(material.description));
      const shared = descGrams.filter((gram) => matGrams.includes(gram)).length;
      const total = [...new Set([...descGrams, ...matGrams])].length || 1;

      nGramScore = Math.max(nGramScore, (shared / total) * 100);
    });

    score += nGramScore * 0.75;

    if (cleanDesc.includes(normalize(catName))) score += 45;

    return {
      id: cat.id,
      name: cat.name,
      score: Math.min(100, Number(score.toFixed(2))),
    };
  });

  return results
    .sort((a, b) => b.score - a.score)
    .map((result) => ({
      ...result,
      confidence:
        result.score > 75 ? 'ALTA' : result.score > 40 ? 'MEDIA' : 'BASSA',
    }));
};

export const analyzeColumnType = (dataSample = []) => {
  const scores = {
    code: 0,
    quantity: 0,
    description: 0,
    category: 0,
    price: 0,
    unit: 0,
    brand: 0,
  };

  const items = dataSample
    .filter((value) => value !== undefined && value !== null && safeString(value) !== '')
    .slice(0, 80);

  if (items.length === 0) return scores;

  items.forEach((value) => {
    const raw = safeString(value);
    const normalized = normalize(raw);
    const compact = raw.replace(/\s+/g, '');

    const number = parseNumberLike(raw);

    if (number !== null) {
      if (!/%/.test(raw) && !/€|eur|euro/i.test(raw)) {
        scores.quantity += 8;

        if (number >= 0 && number < 1000) scores.quantity += 6;
        if (/^\d+$/.test(compact)) scores.quantity += 2;
      }

      if (/€|eur|euro/i.test(raw) || /[,.]\d{2,}/.test(raw)) {
        scores.price += 12;
      }

      if (number > 0 && number < 100000 && /[,.]\d{2,}/.test(raw)) {
        scores.price += 8;
      }
    }

    if (
      /^[A-Z0-9.\-/_]{3,45}$/i.test(compact) &&
      !/^\d{1,3}$/.test(compact) &&
      !/^\d+[.,]\d+$/.test(compact)
    ) {
      if (/[A-Z]/i.test(compact) && /\d/.test(compact)) scores.code += 16;
      if (/[-./_]/.test(compact) && /\d/.test(compact)) scores.code += 13;
      if (/^\d(?:-\d+){2,}/.test(compact)) scores.code += 18;
    }

    if (raw.includes(' ') && raw.length > 12) {
      scores.description += 14;
    }

    if (raw.length > 20) {
      scores.description += 8;
    }

    if (/^(pz|pce|st|nr|mt|m|kg|lt|l|conf|scat|rot|sac|plt)$/i.test(raw)) {
      scores.unit += 20;
    }

    Object.keys(TECHNICAL_WEIGHTS).forEach((cat) => {
      if (normalized.includes(normalize(cat))) {
        scores.category += 10;
      }

      const words = normalized.split(/\s+/).filter(Boolean);
      const hits = words.filter((word) =>
        TECHNICAL_WEIGHTS[cat].some((kw) => word === kw || word.includes(kw) || kw.includes(word))
      ).length;

      if (hits > 0) {
        scores.category += Math.min(12, hits * 4);
        scores.description += Math.min(8, hits * 2);
      }
    });

    if (/^[a-zA-ZÀ-ÿ0-9 .'-]{2,35}$/.test(raw) && !raw.includes(' ') && number === null) {
      scores.brand += 5;
    }
  });

  Object.keys(scores).forEach((key) => {
    scores[key] = scores[key] / items.length;
  });

  return scores;
};

export default {
  predictCategory,
  analyzeColumnType,
};
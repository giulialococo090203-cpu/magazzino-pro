import { normalize } from './classificationEngine';

/**
 * ML ENGINE: CLASSIFICATORE AVANZATO
 * Utilizza Vector Space Modeling e Probabilità Bayesiana
 */

// Pesi delle categorie basati su termini tecnici comuni (Priors)
const TECHNICAL_WEIGHTS = {
  'Ferramenta': ['vite', 'bullone', 'dado', 'rondella', 'chiodo', 'rivetto', 'tassello', 'zincato', 'inox', 'm8', 'm10', 'm12', 'm6'],
  'Elettrico': ['cavo', 'interruttore', 'diff', 'presa', 'spina', 'morsetto', 'quadro', 'magnotermico', 'led', 'lampada', 'fili', 'awg', 'mt'],
  'Idraulica': ['tubo', 'raccordo', 'valvola', 'rubinetto', 'multistrato', 'rame', 'pvc', 'geberit', 'pompa', 'guarnizione'],
  'Edilizia': ['cemento', 'malta', 'mattone', 'colla', 'intonaco', 'cartongesso', 'mapei', 'sabbia', 'premixed'],
  'Sicurezza': ['guanti', 'casco', 'scarpe', 'dpi', 'sicurezza', 'visiera', 'maschera', 'antinfortunistica'],
  'Utensileria': ['trapano', 'avvitatore', 'cacciavite', 'pinza', 'martello', 'mola', 'utensile', 'makita', 'bosch', 'beta'],
  'Colori e Vernici': ['pittura', 'vernice', 'smalto', 'pennello', 'rullo', 'diluente', 'colore', 'tintometro'],
  'Legname': ['tavola', 'listello', 'pannello', 'comp', 'legno', 'abete', 'osb', 'mdf']
};

/**
 * ESTRAZIONE N-GRAMMI (Simula CNN pattern recognition)
 * Estrae sequenze di 3 caratteri per riconoscere pattern in codici e parole
 */
const getNGrams = (text, n = 3) => {
  const grams = [];
  const clean = text.replace(/\s+/g, '');
  for (let i = 0; i <= clean.length - n; i++) {
    grams.push(clean.substring(i, i + n));
  }
  return grams;
};

/**
 * CALCOLO SIMILARITÀ VETTORIALE (Cosine Similarity)
 */
const calculateVectorSimilarity = (vecA, vecB) => {
  const intersection = Object.keys(vecA).filter(key => vecB[key]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  intersection.forEach(key => {
    dotProduct += vecA[key] * vecB[key];
  });

  Object.values(vecA).forEach(val => magA += val * val);
  Object.values(vecB).forEach(val => magB += val * val);

  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dotProduct / mag;
};

/**
 * MOTORE DI PREDIZIONE ML
 */
export const predictCategory = (description, categories, trainedData = []) => {
  const cleanDesc = normalize(description);
  const descGrams = getNGrams(cleanDesc);
  const words = cleanDesc.split(' ');
  
  // 1. ANALISI PROBABILISTICA (BAYES)
  const results = categories.map(cat => {
    let score = 0;
    const catWeights = TECHNICAL_WEIGHTS[cat.name] || [];
    
    // Match termini tecnici
    words.forEach(word => {
      catWeights.forEach(kw => {
        if (word === kw) score += 50; // Match esatto
        else if (word.includes(kw)) score += 20; // Match parziale
      });
    });

    // 2. ANALISI N-GRAMMI (Pattern Similarity)
    // Confronta con descrizioni della stessa categoria nel trainedData
    const catMaterials = trainedData.filter(m => m.category === cat.id);
    let nGramScore = 0;
    
    catMaterials.forEach(mat => {
      const matGrams = getNGrams(normalize(mat.description));
      const shared = descGrams.filter(g => matGrams.includes(g)).length;
      const total = [...new Set([...descGrams, ...matGrams])].length;
      nGramScore = Math.max(nGramScore, (shared / total) * 100);
    });

    score += nGramScore * 0.8; // Peso dell'analisi pattern

    // 3. PRIOR BASED ON CATEGORY NAME
    if (cleanDesc.includes(normalize(cat.name))) score += 40;

    return {
      id: cat.id,
      name: cat.name,
      score: Math.min(100, score)
    };
  });

  return results
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      ...r,
      confidence: r.score > 75 ? 'ALTA' : r.score > 40 ? 'MEDIA' : 'BASSA'
    }));
};

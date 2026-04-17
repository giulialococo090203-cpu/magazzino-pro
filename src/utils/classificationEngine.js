/**
 * MAPPING DI PAROLE CHIAVE PER CATEGORIE
 * Questo dizionario può essere espanso per aumentare la precisione.
 */
const KEYWORDS_DICTIONARY = {
  'Ferramenta': ['viti', 'bulloni', 'dadi', 'rondelle', 'chiodi', 'rivetti', 'tasselli', 'ferramenta', 'zincato', 'inox'],
  'Elettrico': ['cavo', 'interruttore', 'differenziale', 'presa', 'spina', 'morsetto', 'quadro', 'magnetotermico', 'corrugato', 'elettrico', 'fili', 'canale', 'scatola'],
  'Idraulica': ['tubo', 'raccordo', 'valvola', 'guarnizione', 'rubinetto', 'sifone', 'multistrato', 'rame', 'pvc', 'geberit', 'idraulico', 'pompa'],
  'Edilizia': ['cemento', 'calce', 'malta', 'mattone', 'colla', 'intonaco', 'cartongesso', 'sabbia', 'premiscelato', 'mapei', 'edilizia'],
  'Sicurezza': ['guanti', 'casco', 'scarpe', 'occhiali', 'dpi', 'sicurezza', 'visiera', 'maschera', 'imbracatura', 'antinfortunistica', 'ufficio'],
  'Utensileria': ['trapano', 'avvitatore', 'cacciavite', 'pinza', 'martello', 'mola', 'utensile', 'seghetto', 'chiave', 'makita', 'bosch', 'dewalt', 'beta'],
  'Colori e Vernici': ['pittura', 'vernice', 'smalto', 'pennello', 'rullo', 'diluente', 'colore', 'tintometro', 'stucco'],
  'Legname': ['tavola', 'listello', 'pannello', 'compensato', 'abete', 'pino', 'legno', 'osb', 'mdf', 'multistrato', 'truciolare']
};

/**
 * NORMALIZZAZIONE DEL TESTO
 * Rimuove accenti, punteggiatura, stop-words e spazi extra.
 */
export const normalize = (text) => {
  if (!text) return '';
  const stopWords = ['di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno'];
  
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Rimuove accenti
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")     // Rimuove punteggiatura
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .join(' ');
};

/**
 * DISTANZA DI LEVENSHTEIN (FUZZY MATCHING)
 */
export const levenshtein = (a, b) => {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

/**
 * SIMILARITÀ TRA DUE STRINGHE (0-1)
 */
export const calculateSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - levenshtein(longer, shorter)) / longerLength;
};

/**
 * MOTORE DI CLASSIFICAZIONE IBRIDO
 */
export const classify = (description, categories) => {
  const cleanDesc = normalize(description);
  const words = cleanDesc.split(' ');
  
  const results = categories.map(cat => {
    let score = 0;
    const catName = normalize(cat.name);
    const catKeywords = KEYWORDS_DICTIONARY[cat.name] || [];
    
    // 1. Keyword Matching (Elevata confidenza)
    words.forEach(word => {
      catKeywords.forEach(kw => {
        if (word === kw) score += 40; // Corrispondenza esatta parola chiave
        else if (word.includes(kw) || kw.includes(word)) score += 15; // Corrispondenza parziale
        else {
          const sim = calculateSimilarity(word, kw);
          if (sim > 0.8) score += 10; // Corrispondenza fuzzy
        }
      });
    });

    // 2. Direct Similarity con il nome categoria
    const directSim = calculateSimilarity(cleanDesc, catName);
    score += directSim * 30;

    // 3. Boosting per descrizione categoria
    if (cat.description) {
      const cleanCatDesc = normalize(cat.description);
      const sharedWords = words.filter(w => cleanCatDesc.includes(w));
      score += sharedWords.length * 5;
    }

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
      confidence: r.score > 60 ? 'high' : r.score > 25 ? 'medium' : 'low'
    }));
};

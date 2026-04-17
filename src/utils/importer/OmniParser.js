import * as XLSX from 'xlsx';

/**
 * OMNI PARSER
 * Motore di acquisizione universale ad alta resilienza.
 */
export const parseFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        let data = [];

        // 1. TENTA LETTURA CLASSICA (XLSX, CSV standard)
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          // Prova a estrarre dati da ogni foglio
          for (const sn of wb.SheetNames) {
            const sheet = wb.Sheets[sn];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (sheetData.length > 2) {
              data = sheetData;
              break;
            }
          }
        } catch (err) {
          console.warn('XLSX parser failed, attempting raw text fallback...', err);
        }

        // 2. FALLBACK: RAW TEXT PARSING (Per CSV corrotti o delimitatori strani)
        if (data.length < 2) {
          const text = new TextDecoder().decode(buffer);
          data = parseRawText(text);
        }

        if (data.length < 1) throw new Error('Impossibile estrarre righe valide dal file.');
        
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * PARSE RAW TEXT
 * Gestisce delimitatori , ; \t e pulizia righe
 */
const parseRawText = (text) => {
  if (!text) return [];
  
  // Rileva il delimitatore più probabile nelle prime 5 righe
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiters = [',', ';', '\t', '|'];
  let bestDelim = ',';
  let maxCols = 0;

  delimiters.forEach(d => {
    const avgCols = lines.slice(0, 5).reduce((acc, line) => acc + line.split(d).length, 0) / 5;
    if (avgCols > maxCols) {
      maxCols = avgCols;
      bestDelim = d;
    }
  });

  console.log(`OmniParser: Rilevato delimitatore "${bestDelim}" con media colonne ${maxCols}`);

  return lines.map(line => {
    // Gestisce i valori racchiusi tra virgolette che contengono il delimitatore
    return line.split(bestDelim).map(val => val.replace(/^["']|["']$/g, '').trim());
  });
};

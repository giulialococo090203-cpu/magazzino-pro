import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * OMNI PARSER
 * Motore di acquisizione universale ad alta resilienza.
 */
export const parseFile = async (file) => {
  const extension = getFileExtension(file.name);

  if (extension === 'pdf') {
    return await parsePdfBruteForce(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        let data = [];

        // 1. TENTA LETTURA CLASSICA (XLSX, CSV standard)
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
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

        // 2. FALLBACK: RAW TEXT PARSING
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

    reader.onerror = () => reject(new Error('Errore durante la lettura del file.'));
    reader.readAsArrayBuffer(file);
  });
};

const getFileExtension = (fileName = '') => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

/**
 * PARSER PDF BRUTE FORCE
 * Nessun worker, solo estrazione testo + regex robuste.
 */
const parsePdfBruteForce = async (file) => {
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines = groupItemsIntoLines(textContent.items);
    allLines.push(...lines);
  }

  const cleaned = allLines
    .map((line) => normalizePdfLine(line))
    .filter(Boolean);

  const rows = extractInvoiceRowsBruteForce(cleaned);

  if (!rows.length) {
    throw new Error('PDF letto, ma nessuna riga articolo riconosciuta.');
  }

  return [
    ['Codice', 'Descrizione', 'Quantità', 'UM', 'Marca', 'Categoria', 'Posizione'],
    ...rows.map((row) => [
      row.code || '',
      row.description || '',
      row.quantity ?? '',
      row.unit || 'ST',
      '',
      '',
      '',
    ]),
  ];
};

const groupItemsIntoLines = (items) => {
  const buckets = new Map();

  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text) continue;

    const y = Math.round(item.transform[5]);

    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push({
      x: item.transform[4],
      text,
    });
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
};

const normalizePdfLine = (line) => {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/€/g, ' € ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractInvoiceRowsBruteForce = (lines) => {
  const results = [];
  let inProducts = false;
  let currentItem = null;

  const endRegex = /METODO DI PAGAMENTO|REGIME FISCALE|DATI AGGIUNTIVI|RIEPILOGO IVA|CALCOLO FATTURA/i;
  const headerRegex = /NR\s+DESCRIZIONE\s+QUANTITA/i;

  for (const line of lines) {
    if (/PRODOTTI E SERVIZI/i.test(line)) {
      inProducts = true;
      continue;
    }

    if (!inProducts) continue;
    if (headerRegex.test(line)) continue;

    if (endRegex.test(line)) {
      if (currentItem) {
        results.push(currentItem);
        currentItem = null;
      }
      break;
    }

    const codeMatch = line.match(/Cod\.valore:\s*([A-Z0-9\-]+)/i);
    if (codeMatch && currentItem) {
      currentItem.code = codeMatch[1].trim();
      continue;
    }

    // Esempi:
    // 1 GRUPPO RITORNO 1 ST 75,98000000 € 75,98 €
    // 17 VALVOLA GAS 2 ST 58,57500000 € 117,15 €
    // 9950 MAGG TRASP ASSOLUT 1 ST 13,62000000 € 13,62 €
    const productMatch = line.match(
      /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,5})\s+(\d+(?:[.,]\d+)?)\s+€\s+(\d+(?:[.,]\d+)?)\s+€/i
    );

    if (productMatch) {
      if (currentItem) {
        results.push(currentItem);
      }

      currentItem = {
        rowNumber: productMatch[1],
        description: productMatch[2].trim(),
        quantity: parseItalianNumber(productMatch[3]),
        unit: productMatch[4].trim(),
        code: '',
      };
      continue;
    }

    // Riga descrizione spezzata
    if (
      currentItem &&
      line.length > 2 &&
      !/Cod\.tipo:|Cod\.valore:/i.test(line) &&
      !endRegex.test(line)
    ) {
      currentItem.description = `${currentItem.description} ${line}`
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (currentItem) {
    results.push(currentItem);
  }

  return results.filter((item) => item.description && item.quantity > 0);
};

const parseItalianNumber = (value) => {
  const cleaned = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

/**
 * PARSE RAW TEXT
 */
const parseRawText = (text) => {
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiters = [',', ';', '\t', '|'];
  let bestDelim = ',';
  let maxCols = 0;

  delimiters.forEach((d) => {
    const sample = lines.slice(0, 5);
    const avgCols = sample.length
      ? sample.reduce((acc, line) => acc + line.split(d).length, 0) / sample.length
      : 0;

    if (avgCols > maxCols) {
      maxCols = avgCols;
      bestDelim = d;
    }
  });

  return lines.map((line) =>
    line.split(bestDelim).map((val) => val.replace(/^["']|["']$/g, '').trim())
  );
};
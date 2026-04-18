import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * OMNI PARSER
 * Motore di acquisizione universale ad alta resilienza.
 */
export const parseFile = async (file) => {
  const extension = getFileExtension(file.name);

  if (extension === 'pdf') {
    return await parsePdfFile(file);
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

        if (data.length < 1) {
          throw new Error('Impossibile estrarre righe valide dal file.');
        }

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
 * PARSER PDF DEDICATO
 * Gestisce fatture PDF con layout tipo:
 * NR | DESCRIZIONE | QUANTITA' | PREZZO | IMPORTO | IVA
 * e righe di dettaglio con "Cod.valore: XXXXX"
 */
const parsePdfFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const pageLines = groupTextItemsIntoLines(content.items);
    lines.push(...pageLines);
  }

  const cleanedLines = lines
    .map(normalizePdfLine)
    .filter(Boolean);

  const invoiceRows = extractInvoiceRowsFromPdfLines(cleanedLines);

  if (invoiceRows.length === 0) {
    throw new Error('PDF letto, ma nessuna riga articolo riconosciuta.');
  }

  // Ritorniamo una struttura tabellare compatibile col resto del sistema
  return [
    ['Codice', 'Descrizione', 'Quantità', 'UM', 'Marca', 'Categoria', 'Posizione'],
    ...invoiceRows.map((row) => [
      row.code || '',
      row.description || '',
      row.quantity ?? '',
      row.unit || 'PZ',
      row.brand || '',
      row.category || '',
      row.location || '',
    ]),
  ];
};

/**
 * Raggruppa i frammenti PDF in righe usando la coordinata Y
 */
const groupTextItemsIntoLines = (items) => {
  const rows = new Map();

  for (const item of items) {
    const str = String(item.str || '').trim();
    if (!str) continue;

    const y = Math.round(item.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({
      text: str,
      x: item.transform[4],
    });
  }

  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, rowItems]) =>
      rowItems
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
};

const normalizePdfLine = (line) => {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .replace(/€\s+/g, '€ ')
    .trim();
};

/**
 * Estrae le righe prodotto dal PDF
 */
const extractInvoiceRowsFromPdfLines = (lines) => {
  const results = [];

  let inProductsSection = false;
  let currentItem = null;

  const isProductsStart = (line) =>
    /PRODOTTI E SERVIZI/i.test(line);

  const isProductsHeader = (line) =>
    /NR\s+DESCRIZIONE\s+QUANTITA/i.test(line);

  const isProductsEnd = (line) =>
    /METODO DI PAGAMENTO|REGIME FISCALE|DATI AGGIUNTIVI|RIEPILOGO IVA|CALCOLO FATTURA/i.test(line);

  for (const line of lines) {
    if (isProductsStart(line)) {
      inProductsSection = true;
      continue;
    }

    if (!inProductsSection) continue;
    if (isProductsHeader(line)) continue;

    if (isProductsEnd(line)) {
      if (currentItem) {
        results.push(currentItem);
        currentItem = null;
      }
      break;
    }

    // Riga dettaglio codice:
    // Cod.tipo: COD_FORNITORE, Cod.valore: 65105322, ...
    const codeMatch = line.match(/Cod\.valore:\s*([A-Z0-9\-]+)/i);
    if (codeMatch && currentItem) {
      currentItem.code = codeMatch[1].trim();
      continue;
    }

    // Riga prodotto standard:
    // 1 GRUPPO RITORNO 1 ST 75,98000000 € 75,98 € 22 % -
    // 17 VALVOLA GAS 2 ST 58,57500000 € 117,15 € 22 % -
    const productMatch = line.match(
      /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,5})\s+(\d+(?:[.,]\d+)?)\s*€\s+(\d+(?:[.,]\d+)?)\s*€/
    );

    // Riga prodotto senza numero progressivo classico:
    // 9950 MAGG TRASP ASSOLUT 1 ST 13,62000000 € 13,62 € 22 % -
    const altProductMatch = line.match(
      /^([A-Z0-9]+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,5})\s+(\d+(?:[.,]\d+)?)\s*€\s+(\d+(?:[.,]\d+)?)\s*€/
    );

    const match = productMatch || altProductMatch;

    if (match) {
      if (currentItem) {
        results.push(currentItem);
      }

      currentItem = {
        rowNumber: match[1],
        description: match[2].trim(),
        quantity: parseItalianNumber(match[3]),
        unit: match[4].trim(),
        code: '',
        brand: '',
        category: '',
        location: '',
      };

      continue;
    }

    // Se capita una descrizione spezzata su più righe, la accodiamo
    if (
      currentItem &&
      !/Cod\.tipo:|Cod\.valore:/i.test(line) &&
      !isProductsEnd(line) &&
      line.length > 2
    ) {
      currentItem.description = `${currentItem.description} ${line}`.replace(/\s+/g, ' ').trim();
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
 * Gestisce delimitatori , ; \t e pulizia righe
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

  console.log(`OmniParser: Rilevato delimitatore "${bestDelim}" con media colonne ${maxCols}`);

  return lines.map((line) =>
    line.split(bestDelim).map((val) => val.replace(/^["']|["']$/g, '').trim())
  );
};
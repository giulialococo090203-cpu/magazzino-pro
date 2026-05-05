import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const PDF_TEXT_PARSER_URL =
  import.meta.env.VITE_PDF_TEXT_PARSER_URL || 'https://pdf-parser-vercel-wheat.vercel.app/parse';

function getFileExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).trim();
}

function cleanRow(row = []) {
  if (!Array.isArray(row)) return [];
  return row.map(normalizeCell);
}

function hasEnoughUsefulCells(row = []) {
  if (!Array.isArray(row)) return false;

  const filled = row.filter((cell) => String(cell ?? '').trim() !== '');
  return filled.length >= 2;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fileToArrayBuffer(file) {
  return await file.arrayBuffer();
}

async function fileToText(file) {
  return await file.text();
}

function normalizeSpaces(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseItalianNumber(value = '') {
  const text = String(value || '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanBoschDescription(lines = []) {
  const blacklist = [
    /^ricambio$/i,
    /^ricambi$/i,
    /^solar$/i,
    /^old\s+/i,
    /^old$/i,
    /^d\.d\.t\./i,
    /^vs\.\s*ordine/i,
    /^cessione/i,
    /^cod\.ean/i,
    /^pos\s+cod\./i,
    /^descrizione/i,
    /^robert bosch/i,
    /^capitale/i,
    /^c\.c\.i\.a\.a\./i,
    /^bollo/i,
    /^bosch e il simbolo/i,
    /^dati da indicare/i,
    /^dest\./i,
    /^fattura$/i,
    /^ns\.\s*codice/i,
    /^presso iln/i,
    /^pagina\s+\d+/i,
    /^via\s+/i,
    /^cl thermoservice/i,
    /^it-\d+/i,
    /^cod\.cliente/i,
    /^partita iva/i,
    /^iva\s+/i,
    /^ricevuta/i,
    /^\(c\)=/i,
    /^il documento/i,
    /^per eventuali/i,
    /^unicredit/i,
    /^iban/i,
    /^swift/i,
    /^indicare sempre/i,
    /^informazioni/i,
    /^regolamento/i,
    /^www\./i,
    /^addebito trasporto/i,
    /^contributo ambientale/i,
  ];

  const useful = [];

  for (const rawLine of lines) {
    const line = normalizeSpaces(rawLine);

    if (!line) continue;
    if (/^\d+[.,]\d+$/.test(line)) continue;
    if (/^\d{10,}$/.test(line)) continue;
    if (blacklist.some((regex) => regex.test(line))) continue;

    useful.push(line);
  }

  return normalizeSpaces(useful.join(' '));
}

function extractPlainTextFromPdfParserResult(data = {}) {
  const parts = [];

  if (typeof data === 'string') {
    parts.push(data);
  }

  if (typeof data?.text === 'string') {
    parts.push(data.text);
  }

  if (typeof data?.rawText === 'string') {
    parts.push(data.rawText);
  }

  if (typeof data?.content === 'string') {
    parts.push(data.content);
  }

  if (Array.isArray(data?.pages)) {
    data.pages.forEach((page) => {
      if (typeof page === 'string') {
        parts.push(page);
      } else if (typeof page?.text === 'string') {
        parts.push(page.text);
      } else if (typeof page?.content === 'string') {
        parts.push(page.content);
      }
    });
  }

  if (Array.isArray(data?.lines)) {
    parts.push(data.lines.join('\n'));
  }

  if (Array.isArray(data?.rows)) {
    data.rows.forEach((row) => {
      if (Array.isArray(row)) {
        parts.push(row.join(' '));
      } else if (typeof row === 'string') {
        parts.push(row);
      } else if (row && typeof row === 'object') {
        parts.push(Object.values(row).join(' '));
      }
    });
  }

  if (Array.isArray(data?.matrix)) {
    data.matrix.forEach((row) => {
      if (Array.isArray(row)) {
        parts.push(row.join(' '));
      }
    });
  }

  return parts.join('\n').trim();
}

function parseBoschInvoiceText(text = '') {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  if (!rawLines.length) return [];

  const header = [
    'Codice',
    'Descrizione',
    'Quantità',
    'UM',
    'Prezzo Netto',
    'Marca',
    'Categoria',
    'Posizione',
  ];

  const rows = [];

  /*
    Formato Bosch tipico:
    0010 8-718-641-615-0 1 56,45 -30,00%(c) -5,00%(d) 37,53 H6
    MASCHERINA
    RICAMBIO

    Gruppi:
    posizione, codice, quantità, prezzo unitario, eventuali sconti, importo netto, iva
  */
  const articleRegex =
    /^(\d{4})\s+([A-Z0-9][A-Z0-9-]{4,})\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+.*?)*\s+(\d+(?:[.,]\d+)?)\s+[A-Z]{1,3}\d?$/i;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.match(articleRegex);

    if (!match) continue;

    const position = match[1];
    const code = match[2];
    const quantity = parseItalianNumber(match[3]);
    const unitPrice = parseItalianNumber(match[4]);

    if (!code || quantity <= 0) continue;

    const descriptionLines = [];

    for (let j = i + 1; j < rawLines.length; j++) {
      const nextLine = rawLines[j];

      if (articleRegex.test(nextLine)) break;

      if (/^\d{4}\s+/.test(nextLine)) break;
      if (/^d\.d\.t\./i.test(nextLine)) break;
      if (/^vs\.\s*ordine/i.test(nextLine)) break;
      if (/^cessione/i.test(nextLine)) break;
      if (/^addebito trasporto/i.test(nextLine)) break;
      if (/^contributo ambientale/i.test(nextLine)) break;
      if (/^robert bosch/i.test(nextLine)) break;
      if (/^capitale/i.test(nextLine)) break;
      if (/^pagina\s+\d+/i.test(nextLine)) break;
      if (/^fattura$/i.test(nextLine)) break;
      if (/^cod\.cliente/i.test(nextLine)) break;
      if (/^iva\s+/i.test(nextLine)) break;
      if (/^\d+[.,]\d+$/.test(nextLine)) break;

      descriptionLines.push(nextLine);

      if (descriptionLines.length >= 5) break;
    }

    const description = cleanBoschDescription(descriptionLines);

    if (!description) continue;

    rows.push([
      code,
      description,
      quantity,
      'PZ',
      unitPrice,
      'Bosch',
      '',
      position,
    ]);
  }

  if (!rows.length) return [];

  return [header, ...rows];
}

function parseBoschInvoiceFromMatrix(matrix = []) {
  if (!Array.isArray(matrix) || !matrix.length) return [];

  const text = matrix
    .map((row) => (Array.isArray(row) ? row.join(' ') : String(row || '')))
    .join('\n');

  return parseBoschInvoiceText(text);
}

async function parseExcelFile(file) {
  const buffer = await fileToArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    throw new Error('Il file Excel non contiene fogli.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const cleaned = rows.map(cleanRow).filter(hasEnoughUsefulCells);

  if (!cleaned.length) {
    throw new Error('Il file Excel non contiene righe utili.');
  }

  return cleaned;
}

async function parseCsvFile(file) {
  const text = await fileToText(file);

  const workbook = XLSX.read(text, {
    type: 'string',
    raw: false,
    FS: ';',
  });

  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    throw new Error('Il CSV non contiene dati leggibili.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const cleaned = rows.map(cleanRow).filter(hasEnoughUsefulCells);

  if (!cleaned.length) {
    throw new Error('Il CSV non contiene righe utili.');
  }

  return cleaned;
}

async function parseXmlFile(file) {
  const text = await fileToText(file);
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');

  if (xml.querySelector('parsererror')) {
    throw new Error('XML non valido.');
  }

  const rows = [];
  const allNodes = Array.from(xml.querySelectorAll('*'));

  allNodes.forEach((node) => {
    const children = Array.from(node.children || []);
    if (!children.length) return;

    const row = children.map((child) => normalizeCell(child.textContent));
    if (hasEnoughUsefulCells(row)) {
      rows.push(row);
    }
  });

  if (!rows.length) {
    throw new Error('XML letto ma senza righe utili.');
  }

  return rows;
}

async function parseDocxFile(file) {
  const buffer = await fileToArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = result?.value || '';

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('DOCX senza testo utile.');
  }

  return lines.map((line) => [line]);
}

async function parseDocFile(file) {
  const text = await fileToText(file);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('DOC senza testo utile.');
  }

  return lines.map((line) => [line]);
}

async function callPdfTextParser(file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;

  try {
    response = await fetch(PDF_TEXT_PARSER_URL, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(
      'Connessione al parser PDF non riuscita. In locale può essere un problema CORS del server PDF.'
    );
  }

  const text = await response.text();
  const parsed = safeJsonParse(text);

  if (!response.ok) {
    throw new Error(
      parsed?.error ||
        parsed?.message ||
        parsed?.detail ||
        `Parser PDF non disponibile (${response.status}).`
    );
  }

  return parsed || {};
}

function parserObjectRowToMatrixRow(row = {}) {
  return [
    normalizeCell(row.code || ''),
    normalizeCell(row.description || row.name || row.nome || ''),
    normalizeCell(row.quantity ?? row.qty ?? row.quantita ?? ''),
    normalizeCell(row.unit || row.um || 'ST'),
    normalizeCell(row.price ?? row.netPrice ?? row.prezzoNetto ?? row.prezzo ?? ''),
    normalizeCell(row.brand || row.marca || ''),
    normalizeCell(row.category || row.categoria || ''),
    normalizeCell(row.position || row.posizione || ''),
  ];
}

function normalizeTextParserRows(data) {
  if (Array.isArray(data)) {
    return data.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  if (Array.isArray(data?.matrix) && data.matrix.length > 0) {
    const cleanedMatrix = data.matrix.map(cleanRow).filter(hasEnoughUsefulCells);

    const boschRows = parseBoschInvoiceFromMatrix(cleanedMatrix);
    if (boschRows.length > 0) return boschRows;

    return cleanedMatrix;
  }

  if (Array.isArray(data?.rows) && data.rows.length > 0) {
    const firstRow = data.rows[0];

    if (Array.isArray(firstRow)) {
      const cleanedRows = data.rows.map(cleanRow).filter(hasEnoughUsefulCells);

      const boschRows = parseBoschInvoiceFromMatrix(cleanedRows);
      if (boschRows.length > 0) return boschRows;

      return cleanedRows;
    }

    if (typeof firstRow === 'object' && firstRow !== null) {
      const header = [
        'Codice',
        'Descrizione',
        'Quantità',
        'UM',
        'Prezzo Netto',
        'Marca',
        'Categoria',
        'Posizione',
      ];

      const rows = data.rows
        .map(parserObjectRowToMatrixRow)
        .filter(hasEnoughUsefulCells);

      return [header, ...rows];
    }
  }

  if (Array.isArray(data?.data)) {
    const cleanedData = data.data.map(cleanRow).filter(hasEnoughUsefulCells);

    const boschRows = parseBoschInvoiceFromMatrix(cleanedData);
    if (boschRows.length > 0) return boschRows;

    return cleanedData;
  }

  const plainText = extractPlainTextFromPdfParserResult(data);
  const boschRows = parseBoschInvoiceText(plainText);

  if (boschRows.length > 0) {
    return boschRows;
  }

  return [];
}

export async function parseFile(file) {
  if (!file) {
    throw new Error('Nessun file selezionato.');
  }

  const ext = getFileExtension(file.name);

  if (['xlsx', 'xls'].includes(ext)) return await parseExcelFile(file);
  if (ext === 'csv') return await parseCsvFile(file);
  if (ext === 'xml') return await parseXmlFile(file);
  if (ext === 'docx') return await parseDocxFile(file);
  if (ext === 'doc') return await parseDocFile(file);

  if (ext === 'pdf') {
    const textResult = await callPdfTextParser(file);

    if (textResult?.scanDetected) {
      return textResult;
    }

    const rows = normalizeTextParserRows(textResult);

    if (!rows.length) {
      throw new Error(
        textResult?.error ||
          textResult?.message ||
          'Il PDF è stato letto, ma non sono state riconosciute righe articolo utilizzabili.'
      );
    }

    return { matrix: rows };
  }

  throw new Error(`Formato file non supportato: .${ext || 'sconosciuto'}`);
}

export default {
  parseFile,
};
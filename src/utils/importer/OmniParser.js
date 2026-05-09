import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const PDF_TEXT_PARSER_URL =
  import.meta.env.VITE_PDF_TEXT_PARSER_URL ||
  '/api/pdf-parse';

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

function normalizeSpaces(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function parseItalianNumber(value = '') {
  const text = normalizeSpaces(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanBoschDescription(value = '') {
  let text = normalizeSpaces(value);

  text = text.replace(/\bRICAMBIO\b/gi, '');
  text = text.replace(/\bRICAMBI\b/gi, '');
  text = text.replace(/\bSOLAR\b/gi, '');
  text = text.replace(/\bOLD\s+[0-9A-Z-]+/gi, '');
  text = text.replace(/\bold\s+[0-9A-Z-]+/g, '');
  text = text.replace(/\bD\.d\.T\..*$/gi, '');
  text = text.replace(/\bVs\. ordine.*$/gi, '');
  text = text.replace(/\bCessione Norm\..*$/gi, '');
  text = text.replace(/\bAddebito Trasporto.*$/gi, '');
  text = text.replace(/\bContributo Ambientale.*$/gi, '');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/^[-–—,\s]+/, '');
  text = text.replace(/[-–—,\s]+$/, '');

  return text.trim();
}

function isBoschCode(value = '') {
  return /^\d(?:-\d+){2,}(?:-\d+)?$/.test(String(value || '').trim());
}

function isNoiseLine(line = '') {
  const text = normalizeSpaces(line);

  if (!text) return true;

  return (
    /^Pos\s+Cod\./i.test(text) ||
    /^Descrizione\s+in\s+EUR/i.test(text) ||
    /^Cod\.EAN/i.test(text) ||
    /^Partita IVA/i.test(text) ||
    /^D\.d\.T\./i.test(text) ||
    /^Vs\. ordine/i.test(text) ||
    /^del\s+\d{2}\.\d{2}\.\d{4}/i.test(text) ||
    /^Cessione Norm\./i.test(text) ||
    /^ROBERT BOSCH/i.test(text) ||
    /^Robert Bosch/i.test(text) ||
    /^Capitale sottoscritto/i.test(text) ||
    /^C\.C\.I\.A\.A\./i.test(text) ||
    /^Bollo assolto/i.test(text) ||
    /^Pile\s+/i.test(text) ||
    /^BOSCH e il simbolo/i.test(text) ||
    /^Dati da indicare/i.test(text) ||
    /^Dest\./i.test(text) ||
    /^Fattura$/i.test(text) ||
    /^Ns\. codice/i.test(text) ||
    /^presso ILN/i.test(text) ||
    /^Pagina\s+\d+\s*\/\s*\d+/i.test(text) ||
    /^Via M\.A\. Colonna/i.test(text) ||
    /^CL THERMOSERVICE/i.test(text) ||
    /^VIA TOMMASO/i.test(text) ||
    /^IT-\d+/i.test(text) ||
    /^Cod\.Cliente/i.test(text) ||
    /^11311532/i.test(text) ||
    /^IVA\s+IV\s+Descrizione/i.test(text) ||
    /^22\.00%/i.test(text) ||
    /^0\.00%/i.test(text) ||
    /^Ricevuta/i.test(text) ||
    /^\(c\)=/i.test(text) ||
    /^Il documento non firmato/i.test(text) ||
    /^Per eventuali bonifici/i.test(text) ||
    /^UniCredit/i.test(text) ||
    /^IBAN/i.test(text) ||
    /^SWIFT/i.test(text) ||
    /^INDICARE SEMPRE/i.test(text) ||
    /^IL RITARDATO/i.test(text) ||
    /^DI INTERESSI/i.test(text) ||
    /^Informazioni sulle Sostanze/i.test(text) ||
    /^regolamento REACH/i.test(text) ||
    /^www\./i.test(text)
  );
}

function extractTextFromParserResult(data = {}) {
  if (typeof data === 'string') return data;

  const possibleKeys = [
    'text',
    'fullText',
    'rawText',
    'content',
    'plainText',
    'extractedText',
    'pdfText',
    'documentText',
    '__rawText',
  ];

  for (const key of possibleKeys) {
    if (typeof data?.[key] === 'string' && data[key].trim()) {
      return data[key];
    }
  }

  if (Array.isArray(data?.pages)) {
    return data.pages
      .map((page) => {
        if (typeof page === 'string') return page;
        return page?.text || page?.content || page?.rawText || page?.plainText || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (Array.isArray(data?.lines)) {
    return data.lines
      .map((line) => {
        if (typeof line === 'string') return line;
        return line?.text || line?.content || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function parseBoschInvoiceTextToRows(text = '') {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

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

  const itemRegex =
    /^(\d{4})\s+(\d(?:-\d+){2,}(?:-\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s*[-–]?\d+(?:[.,]\d+)?%\([a-z]\))*\s+(\d+(?:[.,]\d+)?)\s+([A-Z0-9]{1,3})?\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(itemRegex);

    if (!match) continue;

    const code = match[2];
    const quantity = parseItalianNumber(match[3]);
    const total = parseItalianNumber(match[5]);

    if (!isBoschCode(code) || quantity <= 0) continue;

    const price = quantity > 0 && total > 0 ? total / quantity : parseItalianNumber(match[4]);
    const descriptionParts = [];

    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];

      if (itemRegex.test(nextLine)) break;
      if (/^\d{4}\s+\d(?:-\d+){2,}/.test(nextLine)) break;

      if (isNoiseLine(nextLine)) {
        if (descriptionParts.length > 0) break;
        continue;
      }

      if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(nextLine)) {
        if (descriptionParts.length > 0) break;
        continue;
      }

      if (/^(RICAMBIO|RICAMBI|SOLAR)$/i.test(nextLine)) {
        continue;
      }

      if (/^OLD\s+/i.test(nextLine) || /^old\s+/.test(nextLine)) {
        continue;
      }

      const cleaned = cleanBoschDescription(nextLine);

      if (cleaned) {
        descriptionParts.push(cleaned);
      }

      if (descriptionParts.length >= 3) break;
    }

    const description = cleanBoschDescription(descriptionParts.join(' '));

    rows.push([
      code,
      description || code,
      quantity,
      'ST',
      Number(price.toFixed(4)),
      'Bosch',
      '',
      '',
    ]);
  }

  if (!rows.length) return [];

  return [header, ...rows];
}

function parserObjectRowToMatrixRow(row = {}) {
  return [
    normalizeCell(row.code || row.codice || row.productCode || row.codiceProdotto || ''),
    normalizeCell(
      row.description ||
        row.name ||
        row.nome ||
        row.descrizione ||
        row.productDescription ||
        row.descrizioneProdotto ||
        ''
    ),
    normalizeCell(row.quantity ?? row.qty ?? row.quantita ?? row.quantità ?? ''),
    normalizeCell(row.unit || row.um || row.unita || row.unitaMisura || 'ST'),
    normalizeCell(row.price ?? row.netPrice ?? row.prezzoNetto ?? row.prezzo ?? ''),
    normalizeCell(row.brand || row.marca || ''),
    normalizeCell(row.category || row.categoria || ''),
    normalizeCell(row.position || row.posizione || ''),
  ];
}

function normalizeObjectRows(rows = []) {
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

  const matrixRows = rows.map(parserObjectRowToMatrixRow).filter(hasEnoughUsefulCells);

  if (!matrixRows.length) return [];

  return [header, ...matrixRows];
}

function normalizeTextParserRows(data) {
  if (Array.isArray(data)) {
    const firstRow = data[0];

    if (Array.isArray(firstRow)) {
      return data.map(cleanRow).filter(hasEnoughUsefulCells);
    }

    if (typeof firstRow === 'object' && firstRow !== null) {
      return normalizeObjectRows(data);
    }
  }

  if (Array.isArray(data?.matrix) && data.matrix.length > 0) {
    return data.matrix.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  const objectArrayKeys = ['rows', 'data', 'items', 'articles', 'products', 'materials'];

  for (const key of objectArrayKeys) {
    if (Array.isArray(data?.[key]) && data[key].length > 0) {
      const firstRow = data[key][0];

      if (Array.isArray(firstRow)) {
        return data[key].map(cleanRow).filter(hasEnoughUsefulCells);
      }

      if (typeof firstRow === 'object' && firstRow !== null) {
        const normalized = normalizeObjectRows(data[key]);
        if (normalized.length > 0) return normalized;
      }
    }
  }

  const extractedText = extractTextFromParserResult(data);

  if (extractedText) {
    const boschRows = parseBoschInvoiceTextToRows(extractedText);
    if (boschRows.length > 0) return boschRows;
  }

  return [];
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

  let workbook = XLSX.read(text, {
    type: 'string',
    raw: false,
    FS: ';',
  });

  let firstSheetName = workbook.SheetNames?.[0];

  if (!firstSheetName) {
    workbook = XLSX.read(text, {
      type: 'string',
      raw: false,
      FS: ',',
    });

    firstSheetName = workbook.SheetNames?.[0];
  }

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

function buildPdfParserUrl() {
  if (PDF_TEXT_PARSER_URL.startsWith('/')) {
    return PDF_TEXT_PARSER_URL;
  }

  return PDF_TEXT_PARSER_URL;
}

async function callPdfTextParser(file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;

  try {
    response = await fetch(buildPdfParserUrl(), {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Connessione al parser PDF non riuscita. Se da terminale il parser risponde correttamente, controlla il proxy Cloudflare /api/pdf-parse o svuota cache del browser.'
    );
  }

  const responseText = await response.text();
  const parsed = safeJsonParse(responseText);

  const payload =
    parsed && typeof parsed === 'object'
      ? {
          ...parsed,
          __httpOk: response.ok,
          __status: response.status,
          __rawText: responseText,
        }
      : {
          text: responseText,
          __httpOk: response.ok,
          __status: response.status,
          __rawText: responseText,
        };

  if (!response.ok) {
    const hasRecoverableText = Boolean(extractTextFromParserResult(payload));
    const hasRecoverableRows = normalizeTextParserRows(payload).length > 0;

    if (!hasRecoverableText && !hasRecoverableRows) {
      throw new Error(
        payload?.error ||
          payload?.message ||
          payload?.detail ||
          `Parser PDF non disponibile (${response.status}).`
      );
    }
  }

  return payload || {};
}

function buildPdfManualFallback(file, message) {
  return {
    ok: true,
    mode: 'scan',
    scanDetected: true,
    fileName: file?.name || '',
    message:
      message ||
      'Il PDF è stato letto, ma non sono state riconosciute righe articolo utilizzabili. Puoi completare l’importazione con inserimento guidato.',
    rows: [],
    matrix: [],
  };
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
      console.warn('PDF parser payload non riconosciuto:', textResult);

      return buildPdfManualFallback(
        file,
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
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const PDF_TEXT_PARSER_URL = 'https://pdf-parser-vercel-wheat.vercel.app/parse';
const SCAN_PARSER_URL = 'https://pdf-scan-parser-docker.onrender.com/parse-scan-invoice';

function getFileExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).trim();
}

function cleanRow(row = []) {
  return row.map(normalizeCell);
}

function hasEnoughUsefulCells(row = []) {
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

  const response = await fetch(PDF_TEXT_PARSER_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    const parsed = safeJsonParse(text);
    throw new Error(parsed?.message || parsed?.detail || `Parser PDF testuale non disponibile (${response.status}).`);
  }

  const data = await response.json();

  if (!data) {
    throw new Error('Risposta non valida dal parser PDF testuale.');
  }

  return data;
}

async function callScanPdfParser(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(SCAN_PARSER_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    const parsed = safeJsonParse(text);

    if (parsed?.detail?.message) {
      throw new Error(parsed.detail.message);
    }

    throw new Error(`Parser scansioni non disponibile (${response.status}).`);
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.matrix) || !data.matrix.length) {
    throw new Error('Risposta non valida dal parser scansioni.');
  }

  return data;
}

function normalizeTextParserRows(data) {
  if (Array.isArray(data)) {
    return data.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  if (Array.isArray(data?.matrix)) {
    return data.matrix.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  if (Array.isArray(data?.rows)) {
    return data.rows.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  if (Array.isArray(data?.data)) {
    return data.data.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  return [];
}

function looksLikeScannedResponse(data) {
  if (!data) return false;

  if (data.scanDetected === true) return true;
  if (data.mode === 'scan-ocr') return true;

  if (typeof data.message === 'string') {
    const msg = data.message.toLowerCase();
    if (
      msg.includes('scans') ||
      msg.includes('ocr') ||
      msg.includes('immagine') ||
      msg.includes('scan')
    ) {
      return true;
    }
  }

  return false;
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
    let textParserError = null;

    try {
      const textResult = await callPdfTextParser(file);

      if (!looksLikeScannedResponse(textResult)) {
        const rows = normalizeTextParserRows(textResult);
        if (rows.length) {
          return rows;
        }
      }
    } catch (err) {
      textParserError = err;
    }

    try {
      const scanResult = await callScanPdfParser(file);

      return {
        scanDetected: false,
        mode: scanResult.mode || 'scan-ocr',
        matrix: scanResult.matrix,
        extractedRows: scanResult.extractedRows || [],
        debug: scanResult.debug || null,
      };
    } catch (scanErr) {
      throw new Error(
        scanErr?.message ||
        textParserError?.message ||
        'Risposta non valida dal parser PDF.'
      );
    }
  }

  throw new Error(`Formato file non supportato: .${ext || 'sconosciuto'}`);
}

export default {
  parseFile,
};
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
    return data.matrix.map(cleanRow).filter(hasEnoughUsefulCells);
  }

  if (Array.isArray(data?.rows) && data.rows.length > 0) {
    const firstRow = data.rows[0];

    if (Array.isArray(firstRow)) {
      return data.rows.map(cleanRow).filter(hasEnoughUsefulCells);
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
    return data.data.map(cleanRow).filter(hasEnoughUsefulCells);
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
          'Il PDF non contiene righe utilizzabili.'
      );
    }

    return { matrix: rows };
  }

  throw new Error(`Formato file non supportato: .${ext || 'sconosciuto'}`);
}

export default {
  parseFile,
};
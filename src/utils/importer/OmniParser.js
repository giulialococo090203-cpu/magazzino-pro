import * as XLSX from 'xlsx';

export const parseFile = async (file) => {
  const extension = getFileExtension(file.name);

  if (extension === 'pdf') {
    return await parsePdfViaBackend(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        let data = [];

        try {
          const wb = XLSX.read(buffer, { type: 'array' });

          for (const sn of wb.SheetNames) {
            const sheet = wb.Sheets[sn];
            const sheetData = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: '',
            });

            if (sheetData.length > 0) {
              data = sheetData;
              break;
            }
          }
        } catch (err) {
          console.warn('XLSX parser failed, attempting raw text fallback...', err);
        }

        if (data.length < 1) {
          const text = new TextDecoder().decode(buffer);
          data = parseRawText(text);
        }

        if (data.length < 1) {
          throw new Error('Impossibile estrarre righe valide dal file.');
        }

        resolve({
          mode: 'table',
          scanDetected: false,
          matrix: data,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Errore durante la lettura del file.'));
    reader.readAsArrayBuffer(file);
  });
};

const parsePdfViaBackend = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api', {
    method: 'POST',
    body: formData,
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    throw new Error('Risposta non valida dal parser PDF.');
  }

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || 'Errore parsing PDF lato backend.');
  }

  if (payload?.scanDetected) {
    return {
      mode: 'scan',
      scanDetected: true,
      message: payload?.message || 'Documento scansito rilevato.',
      fileName: payload?.fileName || file.name,
      matrix: [],
      rows: [],
      raw: payload,
    };
  }

  if (!payload?.matrix || !Array.isArray(payload.matrix)) {
    throw new Error('Il backend PDF non ha restituito una matrice valida.');
  }

  if (payload.matrix.length <= 1) {
    throw new Error('Il parser PDF ha restituito solo l’intestazione, senza articoli.');
  }

  return {
    mode: 'table',
    scanDetected: false,
    matrix: payload.matrix,
    rows: payload.rows || [],
    raw: payload,
  };
};

const getFileExtension = (fileName = '') => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

const parseRawText = (text) => {
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

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
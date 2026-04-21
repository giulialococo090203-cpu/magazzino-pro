import express from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getData } from 'pdf-parse/worker';
import cors from 'cors';

PDFParse.setWorker(getData());

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.post('/api/parse-invoice-pdf', upload.single('file'), async (req, res) => {
  let parser = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file ricevuto.' });
    }

    parser = new PDFParse({
      data: new Uint8Array(req.file.buffer),
    });

    const result = await parser.getText();
    const text = String(result?.text || '');

    if (!text.trim()) {
      return res.status(400).json({ error: 'PDF senza testo estraibile.' });
    }

    const rows = extractInvoiceRows(text);

    if (!rows.length) {
      return res.status(400).json({
        error: 'Nessuna riga articolo riconosciuta nel PDF.',
      });
    }

    return res.json({
      ok: true,
      fileName: req.file.originalname,
      rows,
      matrix: [
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
      ],
    });
  } catch (err) {
    console.error('parse-invoice-pdf error:', err);
    return res.status(500).json({
      error: err?.message || 'Errore interno parsing PDF.',
    });
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // ignore
      }
    }
  }
});

function extractInvoiceRows(text) {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const sectionMatch = normalized.match(
    /PRODOTTI E SERVIZI([\s\S]*?)(METODO DI PAGAMENTO|REGIME FISCALE|DATI AGGIUNTIVI|RIEPILOGO IVA|CALCOLO FATTURA)/i
  );

  if (!sectionMatch) return [];

  const section = sectionMatch[1];
  const lines = section
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];
  let currentItem = null;

  for (const line of lines) {
    if (/^NR\s+DESCRIZIONE\s+QUANTITA/i.test(line)) continue;

    const codeMatch = line.match(/Cod\.valore:\s*([A-Z0-9\-]+)/i);
    if (codeMatch && currentItem) {
      currentItem.code = codeMatch[1].trim();
      continue;
    }

    const productMatch = line.match(
      /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,5})\s+(\d+(?:[.,]\d+)?)\s+€\s+(\d+(?:[.,]\d+)?)\s+€/i
    );

    if (productMatch) {
      if (currentItem) {
        results.push(finalizeItem(currentItem));
      }

      currentItem = {
        rowNumber: productMatch[1],
        description: cleanDescription(productMatch[2]),
        quantity: parseItalianNumber(productMatch[3]),
        unit: productMatch[4].trim(),
        code: '',
      };
      continue;
    }

    if (
      currentItem &&
      line.length > 2 &&
      !/Cod\.tipo:|Cod\.valore:/i.test(line) &&
      !/METODO DI PAGAMENTO|REGIME FISCALE|DATI AGGIUNTIVI|RIEPILOGO IVA|CALCOLO FATTURA/i.test(line)
    ) {
      currentItem.description = `${currentItem.description} ${cleanDescription(line)}`
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (currentItem) {
    results.push(finalizeItem(currentItem));
  }

  return results.filter((item) => item.description && item.quantity > 0);
}

function finalizeItem(item) {
  return {
    code: String(item.code || '').trim(),
    description: cleanDescription(item.description || ''),
    quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
    unit: String(item.unit || 'ST').trim(),
  };
}

function cleanDescription(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+/, '')
    .trim();
}

function parseItalianNumber(value) {
  const cleaned = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

app.listen(3001, () => {
  console.log('PDF parser server attivo su http://localhost:3001');
});
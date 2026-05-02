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
    console.log('--- PDF REQUEST ARRIVATA ---');

    if (!req.file) {
      console.log('Nessun file ricevuto');
      return res.status(400).json({ error: 'Nessun file ricevuto.' });
    }

    console.log('File ricevuto:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    parser = new PDFParse({
      data: new Uint8Array(req.file.buffer),
    });

    console.log('Parser creato');

    const result = await parser.getText();
    const text = String(result?.text || '');

    console.log('Testo estratto, lunghezza:', text.length);
    console.log('Prime 1000 battute:\n', text.slice(0, 1000));

    if (!text.trim()) {
      console.log('PDF senza testo estraibile');
      return res.status(400).json({ error: 'PDF senza testo estraibile.' });
    }

    const rows = extractInvoiceRows(text);

    console.log('Righe trovate:', rows.length);
    console.log('Prime 5 righe:', rows.slice(0, 5));

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
        ['Codice', 'Descrizione', 'Quantità', 'UM', 'Prezzo', 'Marca', 'Categoria', 'Posizione'],
        ...rows.map((row) => [
          row.code || '',
          row.description || '',
          row.quantity ?? '',
          row.unit || 'ST',
          row.price ?? '',
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

  if (!sectionMatch) {
    console.log('Sezione PRODOTTI E SERVIZI non trovata');
    return [];
  }

  const section = sectionMatch[1];
  const lines = section
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  console.log('Righe nella sezione prodotti:', lines.length);

  const results = [];
  let currentItem = null;

  for (const line of lines) {
    if (/^NR\s+DESCRIZIONE\s+QUANTITA/i.test(line)) continue;

    const codeMatch = line.match(/Cod\.valore:\s*([A-Z0-9\-]+)/i);
    if (codeMatch && currentItem) {
      currentItem.code = codeMatch[1].trim();
      continue;
    }

    // Esempio:
    // 1 GRUPPO RITORNO 1 ST 75,98000000 € 75,98 € 22 % -
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
        price: parseItalianNumber(productMatch[5]),
        total: parseItalianNumber(productMatch[6]),
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
    price: Number.isFinite(item.price) ? item.price : 0,
    total: Number.isFinite(item.total) ? item.total : 0,
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
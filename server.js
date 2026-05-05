import express from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getData } from 'pdf-parse/worker';
import cors from 'cors';

PDFParse.setWorker(getData());

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const ALLOWED_ORIGINS = [
  'https://magazzino-pro.vercel.app',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin non consentita dal CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'pdf-parser',
    endpoints: ['/parse', '/api/parse-invoice-pdf'],
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'running',
  });
});

app.post('/parse', upload.single('file'), parseInvoicePdfHandler);
app.post('/api/parse-invoice-pdf', upload.single('file'), parseInvoicePdfHandler);

async function parseInvoicePdfHandler(req, res) {
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

    const result = await parser.getText();
    const text = String(result?.text || '');

    console.log('Testo estratto, lunghezza:', text.length);
    console.log('Prime 1500 battute:\n', text.slice(0, 1500));

    if (!text.trim()) {
      console.log('PDF senza testo estraibile');
      return res.status(400).json({
        error: 'PDF senza testo estraibile. Probabilmente è una scansione/immagine.',
      });
    }

    const rows = extractInvoiceRows(text);

    console.log('Righe trovate:', rows.length);
    console.log('Prime 10 righe:', rows.slice(0, 10));

    if (!rows.length) {
      return res.status(400).json({
        error: 'Il PDF non contiene righe utilizzabili.',
        debug: {
          textLength: text.length,
          preview: text.slice(0, 2000),
        },
      });
    }

    return res.json({
      ok: true,
      fileName: req.file.originalname,
      rows,
      matrix: [
        [
          'Codice',
          'Descrizione',
          'Quantità',
          'UM',
          'Prezzo Netto',
          'Marca',
          'Categoria',
          'Posizione',
        ],
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
}

function extractInvoiceRows(text) {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const section = extractProductsSection(normalized);
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  console.log('Righe analizzate:', lines.length);

  const results = [];
  let currentItem = null;

  for (const line of lines) {
    if (isIgnoredLine(line)) {
      continue;
    }

    const codeMatch = line.match(/Cod\.?\s*valore\s*:?\s*([A-Z0-9._/-]+)/i);
    if (codeMatch && currentItem) {
      currentItem.code = codeMatch[1].trim();
      continue;
    }

    const product = parseProductLine(line);

    if (product) {
      if (currentItem) {
        results.push(finalizeItem(currentItem));
      }

      currentItem = product;
      continue;
    }

    if (currentItem && isContinuationLine(line)) {
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

function extractProductsSection(normalized) {
  const sectionMatch = normalized.match(
    /PRODOTTI\s+E\s+SERVIZI([\s\S]*?)(METODO\s+DI\s+PAGAMENTO|REGIME\s+FISCALE|DATI\s+AGGIUNTIVI|RIEPILOGO\s+IVA|CALCOLO\s+FATTURA|SCADENZE|TOTALE\s+DOCUMENTO)/i
  );

  if (sectionMatch) {
    console.log('Sezione PRODOTTI E SERVIZI trovata');
    return sectionMatch[1];
  }

  console.log('Sezione PRODOTTI E SERVIZI non trovata, provo su tutto il testo');
  return normalized;
}

function parseProductLine(line) {
  const cleanLine = String(line || '').replace(/\s+/g, ' ').trim();

  const patterns = [
    // 1 GRUPPO RITORNO 1 ST 75,98000000 € 75,98 € 22 % -
    /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,6})\s+(\d+(?:[.,]\d+)?)\s*€?\s+(\d+(?:[.,]\d+)?)\s*€?/i,

    // 1 GRUPPO RITORNO ST 1 75,98000000 75,98
    /^(\d+)\s+(.+?)\s+([A-Z]{1,6})\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)/i,

    // 1 GRUPPO RITORNO 1 ST 75,98000000
    /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]{1,6})\s+(\d+(?:[.,]\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanLine.match(pattern);

    if (!match) {
      continue;
    }

    if (pattern === patterns[1]) {
      return {
        rowNumber: match[1],
        description: cleanDescription(match[2]),
        unit: match[3].trim(),
        quantity: parseItalianNumber(match[4]),
        price: parseItalianNumber(match[5]),
        total: parseItalianNumber(match[6]),
        code: '',
      };
    }

    return {
      rowNumber: match[1],
      description: cleanDescription(match[2]),
      quantity: parseItalianNumber(match[3]),
      unit: match[4].trim(),
      price: parseItalianNumber(match[5]),
      total: parseItalianNumber(match[6] || ''),
      code: '',
    };
  }

  return null;
}

function isIgnoredLine(line) {
  return (
    /^NR\s+DESCRIZIONE/i.test(line) ||
    /^DESCRIZIONE\s+QUANTITA/i.test(line) ||
    /^COD\.?\s*TIPO/i.test(line) ||
    /METODO\s+DI\s+PAGAMENTO|REGIME\s+FISCALE|DATI\s+AGGIUNTIVI|RIEPILOGO\s+IVA|CALCOLO\s+FATTURA/i.test(line)
  );
}

function isContinuationLine(line) {
  return (
    line.length > 2 &&
    !/^Cod\.?\s*tipo/i.test(line) &&
    !/^Cod\.?\s*valore/i.test(line) &&
    !/^\d+\s+/.test(line)
  );
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

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`PDF parser server attivo su http://localhost:${port}`);
});
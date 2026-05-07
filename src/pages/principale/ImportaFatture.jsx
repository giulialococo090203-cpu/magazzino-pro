import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  materialStore,
  categoryStore,
  movementStore,
  adminLogStore,
  invoiceImportStore,
  priceHistoryStore,
} from '../../data/store';
import { useAuth } from '../../App';
import { normalize, aggressiveMatch } from '../../utils/classificationEngine';
import { parseFile } from '../../utils/importer/OmniParser';
import { findBestMapping } from '../../utils/importer/HeuristicAnalysis';
import ScanInvoiceFallback, {
  createEmptyRow,
} from '../../components/import/ScanInvoiceFallback.jsx';

const MAX_FILE_SIZE_MB = 15;

function isPlaceholderSupplier(value = '') {
  const normalized = String(value || '').trim().toLowerCase();

  return ['', 'importato', 'senza fornitore', 'da assegnare'].includes(normalized);
}

function chooseImportedSupplier(invoiceSupplier = '', brand = '', existingSupplier = '') {
  const supplierFromInvoice = String(invoiceSupplier || '').trim();
  const brandValue = String(brand || '').trim();
  const existingValue = String(existingSupplier || '').trim();

  if (supplierFromInvoice) return supplierFromInvoice;
  if (existingValue && !isPlaceholderSupplier(existingValue)) return existingValue;
  if (brandValue && !isPlaceholderSupplier(brandValue)) return brandValue;

  return existingValue || 'Importato';
}

const SUPPORTED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'xml', 'doc', 'docx'];

function getFileExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canImportInvoices(role) {
  return ['segretaria', 'segreteria', 'magazziniere', 'datore', 'admin'].includes(
    normalizeRole(role)
  );
}

function canViewInstallerPrice(role) {
  return ['datore', 'segretaria', 'segreteria', 'magazziniere', 'admin'].includes(
    normalizeRole(role)
  );
}

function createImportRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCurrency(value = 0) {
  const number = Number(value || 0);

  return number.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

function calculateListPrice(netPrice = 0) {
  return Number(netPrice || 0) * 1.22;
}

function calculateInstallerPrice(netPrice = 0) {
  return Number(netPrice || 0) * 0.9 * 1.22;
}

function buildImportAssistantMessage(error, file) {
  const extension = getFileExtension(file?.name);
  const fileSizeMb = file?.size ? (file.size / (1024 * 1024)).toFixed(2) : null;
  const rawMessage = error?.message || 'Errore sconosciuto durante l’importazione.';
  const msg = rawMessage.toLowerCase();
  const suggestions = [];

  if (!file) {
    return {
      title: 'Nessun file selezionato',
      message: 'Seleziona un documento prima di procedere.',
      suggestions: [
        'Scegli un file dal computer.',
        'Verifica che il file non sia stato spostato o eliminato.',
      ],
    };
  }

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      title: 'Formato file non supportato',
      message: `Il file "${file.name}" ha un formato non supportato.`,
      suggestions: [
        'Usa un file PDF, Excel, CSV, XML, DOC o DOCX.',
        'Se il documento arriva da un gestionale, prova a esportarlo in Excel o CSV.',
      ],
    };
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      title: 'File troppo grande',
      message: `Il file pesa ${fileSizeMb} MB e supera il limite consigliato di ${MAX_FILE_SIZE_MB} MB.`,
      suggestions: [
        'Riduci il file o esporta solo le righe necessarie.',
        'Se è un PDF molto pesante, prova a salvarlo di nuovo in versione più leggera.',
        'Se è un Excel, elimina fogli inutili o immagini incorporate.',
      ],
    };
  }

  if (msg.includes('cors') || msg.includes('connessione al parser pdf')) {
    suggestions.push('Il parser PDF sta rifiutando le richieste dal tuo ambiente locale.');
    suggestions.push('Prova dalla versione online oppure abilita http://localhost:4173 nel CORS del parser.');
  }

  if (msg.includes('empty') || msg.includes('vuoto')) {
    suggestions.push('Controlla che il file contenga davvero dati leggibili.');
    suggestions.push('Se è un Excel, verifica che il foglio giusto non sia vuoto.');
  }

  if (msg.includes('sheet') || msg.includes('foglio')) {
    suggestions.push('Controlla che il file Excel contenga almeno un foglio con dati.');
    suggestions.push('Verifica che intestazioni e righe siano presenti nello stesso foglio.');
  }

  if (msg.includes('pdf')) {
    suggestions.push(
      'Se il PDF è una scansione immagine, il parser potrebbe non riuscire a leggere automaticamente il contenuto.'
    );
    suggestions.push('Se è un PDF nativo, il sistema proverà a leggerne i dati e mostrarteli in anteprima.');
  }

  if (msg.includes('csv')) {
    suggestions.push('Controlla il separatore del CSV: virgola o punto e virgola.');
    suggestions.push('Verifica che la prima riga contenga intestazioni leggibili.');
  }

  if (msg.includes('mapping') || msg.includes('colonn') || msg.includes('header')) {
    suggestions.push('Le colonne potrebbero non essere riconosciute automaticamente.');
    suggestions.push('Usa la mappatura manuale per indicare Codice, Descrizione, Quantità e Prezzo.');
  }

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    suggestions.push('Controlla la connessione internet o il server di parsing PDF.');
    suggestions.push('Riprova tra qualche secondo.');
  }

  if (msg.includes('read') || msg.includes('parse') || msg.includes('format')) {
    suggestions.push('Il file potrebbe essere danneggiato o salvato in un formato non valido.');
    suggestions.push('Aprilo manualmente e salvalo di nuovo, poi riprova.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Controlla che il file sia leggibile e completo.');
    suggestions.push('Se l’errore continua, riprova con lo stesso file dopo aver riavviato il server PDF.');
    suggestions.push('Se necessario, correggi manualmente le categorie prima della conferma.');
  }

  return {
    title: 'L’assistente ha rilevato un problema nel caricamento',
    message: `Non sono riuscito a leggere correttamente il file "${file.name}". Motivo: ${rawMessage}`,
    suggestions,
  };
}

export default function ImportaFatture() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [results, setResults] = useState(null);
  const [categories, setCategories] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [rawWorkbookData, setRawWorkbookData] = useState(null);
  const [manualMapping, setManualMapping] = useState({
    code: -1,
    description: -1,
    quantity: -1,
    unit: -1,
    price: -1,
    brand: -1,
    category: -1,
    location: -1,
    supplier: -1,
  });

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  const [importError, setImportError] = useState(null);
  const [assistantAdvice, setAssistantAdvice] = useState(null);
  const [lastFile, setLastFile] = useState(null);

  const [scanDetected, setScanDetected] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [scanRows, setScanRows] = useState([createEmptyRow()]);

  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');

  const canUseImport = canImportInvoices(user?.role);
  const showInstallerPrice = canViewInstallerPrice(user?.role);

  const supplierSuggestions = useMemo(() => {
    return [
      ...new Set(
        (allMaterials || [])
          .map((material) => String(material.supplier || '').trim())
          .filter((supplier) =>
            supplier &&
            !['importato', 'senza fornitore', 'da assegnare'].includes(supplier.toLowerCase())
          )
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [allMaterials]);

  useEffect(() => {
    async function loadData() {
      try {
        const cats = await categoryStore.getAll();
        const materials = await materialStore.getAll();

        setCategories(Array.isArray(cats) ? cats : []);
        setAllMaterials(Array.isArray(materials) ? materials : []);
      } catch (err) {
        console.error('Errore caricamento dati importazione:', err);
      }
    }

    loadData();
  }, []);

  const resetImportState = () => {
    setStep(1);
    setFileName('');
    setParsedItems([]);
    setResults(null);
    setRawWorkbookData(null);
    setManualMapping({
      code: -1,
      description: -1,
      quantity: -1,
      unit: -1,
      price: -1,
      brand: -1,
      category: -1,
      location: -1,
    supplier: -1,
    });
    setImportError(null);
    setAssistantAdvice(null);
    setLoading(false);
    setLoadingProgress({ current: 0, total: 0 });
    setScanDetected(false);
    setScanMessage('');
    setScanRows([createEmptyRow()]);
    setInvoiceRecord(null);
    setStorageWarning('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startManualInsert = () => {
    if (!canUseImport) {
      setImportError('Non hai i permessi per inserire componenti manualmente.');
      return;
    }

    setStep(6);
    setFileName('Inserimento manuale');
    setParsedItems([]);
    setResults(null);
    setRawWorkbookData([]);
    setImportError(null);
    setAssistantAdvice(null);
    setLoading(false);
    setLoadingProgress({ current: 0, total: 0 });
    setScanDetected(true);
    setScanMessage('Inserisci manualmente uno o più componenti da caricare in magazzino.');
    setScanRows([createEmptyRow()]);
    setInvoiceRecord(null);
    setStorageWarning('');
  };

  const validateFileBeforeImport = (file) => {
    if (!file) {
      throw new Error('Nessun file selezionato.');
    }

    const extension = getFileExtension(file.name);

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new Error(`Formato non supportato: .${extension || 'sconosciuto'}`);
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`File troppo grande. Dimensione massima consigliata: ${MAX_FILE_SIZE_MB} MB.`);
    }

    if (file.size === 0) {
      throw new Error('Il file selezionato è vuoto.');
    }
  };

  const updateItem = (index, field, value) => {
    setParsedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value, isAutoAssigned: false } : item
      )
    );
  };

  const updateScanRow = (index, field, value) => {
    setScanRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addScanRow = () => {
    setScanRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeScanRow = (index) => {
    setScanRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const getCategoryName = (categoryId) => {
    const found = categories.find((c) => String(c.id) === String(categoryId));
    return found?.name || '';
  };

  const scoreCategoryFromText = (item, category) => {
    const itemText = normalize(`${item.code || ''} ${item.description || ''} ${item.brand || ''}`);
    const categoryText = normalize(`${category.name || ''}`);

    if (!itemText || !categoryText) return 0;

    let score = 0;

    if (itemText.includes(categoryText)) score += 100;

    const itemWords = itemText.split(/\s+/).filter(Boolean);
    const categoryWords = categoryText.split(/\s+/).filter(Boolean);

    categoryWords.forEach((word) => {
      if (word.length >= 3 && itemWords.some((w) => w.includes(word) || word.includes(w))) {
        score += 20;
      }
    });

    return score;
  };

  const suggestCategoryForItem = (item) => {
    if (item.existingMaterial?.category) {
      return item.existingMaterial.category;
    }

    const categorySuggestions = (item.suggestions || []).filter((s) => s.type === 'category');
    if (categorySuggestions.length > 0) {
      return categorySuggestions[0].id;
    }

    const itemText = normalize(`${item.code || ''} ${item.description || ''} ${item.brand || ''}`);

    let bestMaterialMatch = null;
    let bestMaterialScore = 0;

    for (const material of allMaterials) {
      const materialText = normalize(`${material.code || ''} ${material.description || ''} ${material.brand || ''}`);
      let score = 0;

      if (item.code && material.code && normalize(item.code) === normalize(material.code)) {
        score += 1000;
      }

      if (item.description && material.description) {
        const itemWords = itemText.split(/\s+/).filter(Boolean);
        const materialWords = materialText.split(/\s+/).filter(Boolean);

        itemWords.forEach((w) => {
          if (w.length >= 3 && materialWords.some((mw) => mw.includes(w) || w.includes(mw))) {
            score += 10;
          }
        });
      }

      if (score > bestMaterialScore && material.category) {
        bestMaterialScore = score;
        bestMaterialMatch = material;
      }
    }

    if (bestMaterialMatch?.category) {
      return bestMaterialMatch.category;
    }

    let bestCategory = null;
    let bestCategoryScore = 0;

    for (const category of categories) {
      const score = scoreCategoryFromText(item, category);
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        bestCategory = category;
      }
    }

    if (bestCategory && bestCategoryScore >= 20) {
      return bestCategory.id;
    }

    return '';
  };

  const applyAllSuggestions = () => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (!item.selected) return item;

        const suggestedCategory = suggestCategoryForItem(item);
        if (!suggestedCategory) return item;

        return {
          ...item,
          category: suggestedCategory,
          isAutoAssigned: true,
        };
      })
    );
  };

  const markInvoiceAsAnalyzedSafe = async (invoice, count) => {
    if (!invoice?.id) return;

    try {
      const updated = await invoiceImportStore.markAnalyzed(invoice.id, count);
      setInvoiceRecord(updated);
    } catch (err) {
      console.warn('Impossibile aggiornare stato fattura ad analizzata:', err);
      setStorageWarning(
        'Il file è stato salvato, ma non sono riuscito ad aggiornare lo stato dell’archivio fatture.'
      );
    }
  };

  const markInvoiceAsErrorSafe = async (invoice, errorMessage) => {
    if (!invoice?.id) return;

    try {
      const updated = await invoiceImportStore.markError(invoice.id, errorMessage);
      setInvoiceRecord(updated);
    } catch (err) {
      console.warn('Impossibile aggiornare stato fattura ad errore:', err);
    }
  };

  const buildParsedItemsFromPdfRows = async (
    rows,
    currentFileName = fileName,
    invoice = invoiceRecord
  ) => {
    const trainingData = await materialStore.getAll();

    const processed = rows
      .map((row) => {
        if (!row || row.length < 5) return null;

        const code = String(row[0] || '').trim();
        const desc = String(row[1] || '').trim();
        const qty = parseFloat(String(row[2] || '0').replace(',', '.')) || 0;
        const unit = String(row[3] || 'pz').trim();
        const price = parseFloat(String(row[4] || '0').replace(',', '.')) || 0;
        const brand = String(row[5] || '').trim();
        const explicitCat = String(row[6] || '').trim();
        const location = String(row[7] || 'A1-01').trim();

        if (!code || !desc || qty <= 0) return null;

        const recognition = aggressiveMatch(
          { code, description: desc },
          { materials: trainingData, categories }
        );

        let existing =
          recognition.bestMatch?.type === 'material'
            ? recognition.bestMatch.original
            : null;

        if ((!existing || recognition.confidence !== 'certi') && code) {
          const strictMatch = trainingData.find(
            (m) => String(m.code || '').toLowerCase() === code.toLowerCase()
          );
          if (strictMatch) existing = strictMatch;
        }

        let catId =
          existing?.category ||
          (recognition.bestMatch?.type === 'category' ? recognition.bestMatch.id : '');

        let isAutoAssigned =
          recognition.confidence === 'certi' || recognition.confidence === 'probabili';

        let suggestions = (recognition.allCandidates || [])
          .filter((candidate) => candidate.type === 'category')
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);

        if (!catId && explicitCat) {
          const normalizedExplicitCat = normalize(explicitCat);
          const matchedCategory = categories.find(
            (c) =>
              normalize(c.name || '').includes(normalizedExplicitCat) ||
              normalizedExplicitCat.includes(normalize(c.name || ''))
          );

          if (matchedCategory) {
            catId = matchedCategory.id;
            isAutoAssigned = true;
          }
        }

        return {
          importRowId: createImportRowId(),
          code: existing?.code || code,
          description: existing ? existing.description : desc,
          quantity: qty,
          unit: existing ? existing.unit : unit,
          price: price || existing?.netPrice || 0,
          isNew: !existing,
          selected: true,
          category: catId,
          isAutoAssigned,
          confidence: recognition.confidence,
          suggestions,
          brand: brand || existing?.brand || recognition.bestMatch?.original?.brand || 'Da assegnare',
          minThreshold: existing?.minThreshold || 10,
          location: location || existing?.location || 'A1-01',
          supplier: chooseImportedSupplier(typeof supplierFromRow !== 'undefined' ? supplierFromRow : row?.[8], brand, existing?.supplier),
          notes: `Import: ${currentFileName}`,
          existingMaterial: existing,
        };
      })
      .filter(Boolean);

    if (processed.length === 0) {
      throw new Error('Nessun materiale valido rilevato nel PDF.');
    }

    setParsedItems(processed);
    setImportError(null);
    setAssistantAdvice(null);
    setScanDetected(false);
    setScanMessage('');
    setStep(2);

    await markInvoiceAsAnalyzedSafe(invoice, processed.length);
  };

  const processItems = async (
    rows,
    mapping,
    currentFileName = fileName,
    invoice = invoiceRecord
  ) => {
    const processed = [];
    const trainingData = await materialStore.getAll();

    for (const row of rows) {
      if (!row || row.length === 0) continue;

      const rawCode = row?.[mapping.code];
      const rawDescription = row?.[mapping.description];
      const rawQuantity = row?.[mapping.quantity];
      const rawUnit = row?.[mapping.unit];
      const rawPrice = mapping.price !== undefined && mapping.price !== -1 ? row?.[mapping.price] : 0;
      const rawBrand = mapping.brand !== undefined && mapping.brand !== -1 ? row?.[mapping.brand] : '';
      const rawCategory = mapping.category !== undefined && mapping.category !== -1 ? row?.[mapping.category] : '';
      const rawLocation = mapping.location !== undefined && mapping.location !== -1 ? row?.[mapping.location] : '';

      const code = String(rawCode || '').trim();
      const desc = String(rawDescription || '').trim();
      const unit = String(rawUnit || 'pz').trim();
      const brand = String(rawBrand || '').trim();
      const explicitCat = String(rawCategory || '').trim();
      const location = String(rawLocation || 'A1-01').trim();

      const qtyStr = String(rawQuantity || '0').replace(',', '.');
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, '')) || 0;

      const priceStr = String(rawPrice || '0').replace(',', '.');
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

      const looksLikeHeader =
        code.toLowerCase() === 'codice' ||
        desc.toLowerCase() === 'descrizione' ||
        String(rawQuantity || '').toLowerCase() === 'quantita' ||
        String(rawQuantity || '').toLowerCase() === 'quantità';

      if (looksLikeHeader) continue;
      if (!code && !desc) continue;
      if (!code || code.length < 2) continue;
      if (qty <= 0) continue;

      const recognition = aggressiveMatch(
        { code, description: desc },
        { materials: trainingData, categories: categories }
      );

      let existing =
        recognition.bestMatch?.type === 'material'
          ? recognition.bestMatch.original
          : null;

      if ((!existing || recognition.confidence !== 'certi') && code) {
        const strictMatch = trainingData.find(
          (m) => String(m.code || '').toLowerCase() === code.toLowerCase()
        );
        if (strictMatch) {
          existing = strictMatch;
        }
      }

      let catId =
        existing?.category ||
        (recognition.bestMatch?.type === 'category' ? recognition.bestMatch.id : '');

      let isAutoAssigned =
        recognition.confidence === 'certi' || recognition.confidence === 'probabili';

      let suggestions = (recognition.allCandidates || [])
        .filter((candidate) => candidate.type === 'category')
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

      if (!catId && explicitCat) {
        const normalizedExplicitCat = normalize(explicitCat);
        const matchedCategory = categories.find(
          (c) =>
            normalize(c.name || '').includes(normalizedExplicitCat) ||
            normalizedExplicitCat.includes(normalize(c.name || ''))
        );

        if (matchedCategory) {
          catId = matchedCategory.id;
          isAutoAssigned = true;
        }
      }

      processed.push({
        importRowId: createImportRowId(),
        code: existing?.code || code,
        description: existing ? existing.description : desc || code,
        quantity: qty,
        unit: existing ? existing.unit : unit,
        price: price || existing?.netPrice || 0,
        isNew: !existing,
        selected: true,
        category: catId,
        isAutoAssigned,
        confidence: recognition.confidence,
        suggestions,
        brand: brand || existing?.brand || recognition.bestMatch?.original?.brand || 'Da assegnare',
        minThreshold: existing?.minThreshold || 10,
        location: location || existing?.location || 'A1-01',
        supplier: chooseImportedSupplier(typeof supplierValue !== 'undefined' ? supplierValue : row?.[8], brand, existing?.supplier),
        notes: `Import: ${currentFileName}`,
        existingMaterial: existing,
      });
    }

    if (processed.length === 0) {
      throw new Error('Nessun materiale valido rilevato nel documento.');
    }

    setParsedItems(processed);
    setImportError(null);
    setAssistantAdvice(null);
    setScanDetected(false);
    setScanMessage('');
    setStep(2);

    await markInvoiceAsAnalyzedSafe(invoice, processed.length);
  };

  const continueFromScanFallback = async () => {
    const validRows = (scanRows || []).filter((row) => {
      const hasCode = String(row.code || '').trim().length > 0;
      const hasDescription = String(row.description || '').trim().length > 0;
      const qty = Number(row.quantity || 0);
      return hasCode && hasDescription && qty > 0;
    });

    if (validRows.length === 0) {
      alert('Inserisci almeno una riga valida con codice, descrizione e quantità.');
      return;
    }

    const matrix = [
      ['Codice', 'Descrizione', 'Quantità', 'UM', 'Prezzo Netto', 'Marca', 'Categoria', 'Posizione'],
      ...validRows.map((row) => [
        row.code || '',
        row.description || '',
        row.quantity || 0,
        row.unit || 'PZ',
        row.price || 0,
        row.brand || '',
        row.category || '',
        row.location || 'A1-01',
      ]),
    ];

    setRawWorkbookData(matrix);
    setScanDetected(false);
    setScanMessage('');

    await buildParsedItemsFromPdfRows(matrix.slice(1), fileName || 'Inserimento manuale', invoiceRecord);
  };

  const uploadInvoiceFileSafe = async (file) => {
    try {
      const uploaded = await invoiceImportStore.uploadOriginalFile(file, user);
      setInvoiceRecord(uploaded);
      setStorageWarning('');
      return uploaded;
    } catch (err) {
      console.warn('Salvataggio file originale non riuscito:', err);
      setInvoiceRecord(null);
      setStorageWarning(
        'Il file non è stato salvato nell’archivio Supabase Storage, ma puoi continuare comunque con l’importazione.'
      );
      return null;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canUseImport) {
      setImportError('Non hai i permessi per caricare fatture o documenti.');
      return;
    }

    setLastFile(file);
    setImportError(null);
    setAssistantAdvice(null);
    setResults(null);
    setParsedItems([]);
    setRawWorkbookData(null);
    setScanDetected(false);
    setScanMessage('');
    setScanRows([createEmptyRow()]);
    setFileName(file.name);
    setInvoiceRecord(null);
    setStorageWarning('');

    try {
      const duplicateInvoice = await invoiceImportStore.findDuplicateFile(file);

      if (duplicateInvoice) {
        const duplicateDate = duplicateInvoice.createdAt
          ? new Date(duplicateInvoice.createdAt).toLocaleString('it-IT')
          : 'data non disponibile';

        const confirmed = window.confirm(
          `⚠️ Questa fattura sembra già essere stata caricata.\n\n` +
            `File: ${file.name}\n` +
            `Caricata il: ${duplicateDate}\n\n` +
            `Vuoi continuare comunque con l'importazione?`
        );

        if (!confirmed) {
          setImportError('Importazione annullata: fattura già presente in archivio.');
          setAssistantAdvice({
            title: 'Fattura già presente',
            message:
              `Il file "${file.name}" risulta già caricato nell’archivio fatture. ` +
              'L’importazione è stata annullata per evitare un doppio caricamento.',
            suggestions: [
              'Controlla l’Archivio Fatture se vuoi verificare il documento già caricato.',
              'Se devi davvero ricaricarla, seleziona di nuovo il file e conferma il popup.',
            ],
          });

          if (e.target) e.target.value = '';
          return;
        }
      }
    } catch (duplicateError) {
      console.warn('Controllo duplicato fattura non riuscito:', duplicateError);
    }

    let uploadedInvoice = null;

    try {
      validateFileBeforeImport(file);

      uploadedInvoice = await uploadInvoiceFileSafe(file);

      setStep(2);

      const parsed = await parseFile(file);

      if (parsed?.scanDetected) {
        setScanDetected(true);
        setScanMessage(parsed?.message || 'Documento scansito rilevato.');
        setRawWorkbookData([]);
        setScanRows([createEmptyRow()]);
        setStep(6);
        return;
      }

      const data = parsed?.matrix || parsed;
      setRawWorkbookData(data);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Il file è stato letto ma non contiene righe utilizzabili.');
      }

      const extension = getFileExtension(file.name);

      if (extension === 'pdf') {
        await buildParsedItemsFromPdfRows(data.slice(1), file.name, uploadedInvoice);
        return;
      }

      const analysis = findBestMapping(data);

      if (analysis && analysis.confidence > 0.6) {
        await processItems(
          data.slice(analysis.headerRowIndex + 1),
          analysis.mapping,
          file.name,
          uploadedInvoice
        );
      } else {
        setStep(3);
      }
    } catch (err) {
      console.error('OmniParser Error:', err);
      setImportError(err.message || 'Errore durante la lettura del file.');
      setAssistantAdvice(buildImportAssistantMessage(err, file));
      await markInvoiceAsErrorSafe(uploadedInvoice, err.message || 'Errore durante la lettura del file.');
      setStep(1);
    }
  };

  const retryLastImport = async () => {
    if (!lastFile) return;

    setImportError(null);
    setAssistantAdvice(null);
    setResults(null);
    setParsedItems([]);
    setRawWorkbookData(null);
    setScanDetected(false);
    setScanMessage('');
    setScanRows([createEmptyRow()]);
    setFileName(lastFile.name);

    let activeInvoice = invoiceRecord;

    try {
      validateFileBeforeImport(lastFile);

      if (!activeInvoice?.id) {
        activeInvoice = await uploadInvoiceFileSafe(lastFile);
      }

      setStep(2);

      const parsed = await parseFile(lastFile);

      if (parsed?.scanDetected) {
        setScanDetected(true);
        setScanMessage(parsed?.message || 'Documento scansito rilevato.');
        setRawWorkbookData([]);
        setScanRows([createEmptyRow()]);
        setStep(6);
        return;
      }

      const data = parsed?.matrix || parsed;
      setRawWorkbookData(data);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Il file è stato letto ma non contiene righe utilizzabili.');
      }

      const extension = getFileExtension(lastFile.name);

      if (extension === 'pdf') {
        await buildParsedItemsFromPdfRows(data.slice(1), lastFile.name, activeInvoice);
        return;
      }

      const analysis = findBestMapping(data);

      if (analysis && analysis.confidence > 0.6) {
        await processItems(
          data.slice(analysis.headerRowIndex + 1),
          analysis.mapping,
          lastFile.name,
          activeInvoice
        );
      } else {
        setStep(3);
      }
    } catch (err) {
      console.error('Retry Import Error:', err);
      setImportError(err.message || 'Errore durante il nuovo tentativo.');
      setAssistantAdvice(buildImportAssistantMessage(err, lastFile));
      await markInvoiceAsErrorSafe(activeInvoice, err.message || 'Errore durante il nuovo tentativo.');
      setStep(1);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setImportError(null);
    setAssistantAdvice(null);

    let loaded = 0;
    let created = 0;
    const errors = [];

    const selectedItems = parsedItems.filter((item) => item.selected);

    const groupedItems = {};
    selectedItems.forEach((item) => {
      const key = String(item.code || '').toLowerCase();
      if (!groupedItems[key]) {
        groupedItems[key] = { ...item };
      } else {
        groupedItems[key].quantity += item.quantity;
        if (!groupedItems[key].existingMaterial) {
          groupedItems[key].existingMaterial = item.existingMaterial;
        }
      }
    });

    const itemsToProcess = Object.values(groupedItems);
    setLoadingProgress({ current: 0, total: itemsToProcess.length });

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      setLoadingProgress({ current: i + 1, total: itemsToProcess.length });

      try {
        if (item.isNew && !item.existingMaterial) {
          const dbCheck = await materialStore.getByCode(item.code);
          if (dbCheck) {
            item.isNew = false;
            item.existingMaterial = dbCheck;
          }
        }

        if (item.isNew && !item.existingMaterial) {
          if (!item.category) {
            errors.push(`${item.code}: categoria mancante`);
            continue;
          }

          const createdMaterial = await materialStore.create({
            code: item.code,
            description: item.description,
            brand: item.brand,
            category: item.category,
            quantity: 0,
            unit: item.unit,
            netPrice: item.price || 0,
            minThreshold: item.minThreshold,
            location: item.location,
            supplier: item.supplier,
            notes: item.notes,
          });

          await movementStore.create({
            materialId: createdMaterial.id,
            type: 'entrata',
            quantity: item.quantity,
            reason: fileName === 'Inserimento manuale' ? 'inserimento_manuale' : 'importazione_fattura',
            notes:
              fileName === 'Inserimento manuale'
                ? `Inserimento manuale fornitore: ${item.supplier || ''}`
                : `Importazione da fattura/documento: ${fileName}`,
            userId: user?.id,
            userName: user?.fullName || user?.username || '',
            operatorName: user?.fullName || user?.username || '',
            supplier: item.supplier || '',
          });

          if ((item.price || 0) > 0) {
            await priceHistoryStore.create({
              materialId: createdMaterial.id,
              code: item.code,
              description: item.description,
              supplier: item.supplier || '',
              netPrice: item.price || 0,
              quantity: item.quantity,
              origin: fileName === 'Inserimento manuale' ? 'manuale' : 'fattura',
              document: fileName,
              userName: user?.fullName || user?.username || '',
            });
          }

          created++;
        } else if (item.existingMaterial) {
          if ((item.price || 0) > 0) {
            await materialStore.update(item.existingMaterial.id, {
              netPrice: item.price || 0,
            });
          }

          await movementStore.create({
            materialId: item.existingMaterial.id,
            type: 'entrata',
            quantity: item.quantity,
            reason: fileName === 'Inserimento manuale' ? 'inserimento_manuale' : 'importazione_fattura',
            notes:
              fileName === 'Inserimento manuale'
                ? `Inserimento manuale fornitore: ${item.supplier || ''}`
                : `Importazione da fattura/documento: ${fileName}`,
            userId: user?.id,
            userName: user?.fullName || user?.username || '',
            operatorName: user?.fullName || user?.username || '',
            supplier: item.supplier || '',
          });

          if ((item.price || 0) > 0) {
            await priceHistoryStore.create({
              materialId: item.existingMaterial.id,
              code: item.code || item.existingMaterial.code,
              description: item.description || item.existingMaterial.description,
              supplier: item.supplier || item.existingMaterial.supplier || '',
              netPrice: item.price || 0,
              quantity: item.quantity,
              origin: fileName === 'Inserimento manuale' ? 'manuale' : 'fattura',
              document: fileName,
              userName: user?.fullName || user?.username || '',
            });
          }

          loaded++;
        }
      } catch (err) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    setResults({ loaded, created, errors });

    if (created > 0 || loaded > 0) {
      await adminLogStore.create({
        userId: user?.id,
        entity: 'materiali',
        action: 'importazione',
        details: `Importazione completata: ${created} creati, ${loaded} aggiornati dal file ${fileName}.`,
      });
    }

    if (invoiceRecord?.id) {
      try {
        const updated = await invoiceImportStore.markCompleted(invoiceRecord.id, {
          detectedItems: selectedItems.length,
          createdItems: created,
          updatedItems: loaded,
          errors,
          supplier:
            selectedItems.map((item) => String(item.supplier || '').trim()).find(Boolean) ||
            invoiceRecord?.supplier ||
            '',
        });

        setInvoiceRecord(updated);
      } catch (err) {
        console.warn('Impossibile aggiornare stato finale fattura:', err);
        setStorageWarning(
          'Importazione completata, ma non sono riuscito ad aggiornare lo stato finale dell’archivio fatture.'
        );
      }
    }

    setLoading(false);
    setStep(5);
  };

  if (!canUseImport) {
    return (
      <div className="animate-slideUp">
        <div className="page-header">
          <div>
            <h1 className="page-title">📄 Importa da Fatture</h1>
            <p className="page-subtitle">Carica materiali partendo da documenti di ordine o fatture</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🔒</div>
              <div className="empty-state-title">Accesso non consentito</div>
              <div className="empty-state-text">
                Il tuo ruolo non può caricare fatture o inserire componenti manualmente.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp" style={{ position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255,255,255,0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <h3 style={{ marginTop: 24, fontWeight: 800 }}>Salvataggio in corso...</h3>
          <p className="text-muted">Sto elaborando i materiali nel database</p>
          <div
            style={{
              width: 300,
              background: 'var(--gray-200)',
              height: 8,
              borderRadius: 4,
              marginTop: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${loadingProgress.total ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%`,
                height: '100%',
                background: 'var(--primary-600)',
                transition: 'width 0.3s',
              }}
            ></div>
          </div>
          <div className="mt-2 text-sm fw-bold">
            {loadingProgress.current} di {loadingProgress.total}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Importa da Fatture</h1>
          <p className="page-subtitle">Carica materiali partendo da documenti di ordine o fatture</p>
        </div>
      </div>

      {storageWarning && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            border: '1px solid var(--warning-300)',
            background: 'var(--warning-50)',
          }}
        >
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Avviso archivio fatture</div>
                <div className="text-sm" style={{ color: 'var(--gray-700)' }}>
                  {storageWarning}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {invoiceRecord?.id && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            border: '1px solid var(--success-100)',
            background: 'var(--success-50)',
          }}
        >
          <div className="card-body" style={{ padding: 14 }}>
            <div className="text-sm" style={{ color: 'var(--success-700)', fontWeight: 800 }}>
              ✅ File originale salvato in Supabase Storage · Stato archivio: {invoiceRecord.status}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {invoiceRecord.originalFileName || invoiceRecord.fileName}
            </div>
          </div>
        </div>
      )}

      {(assistantAdvice || importError) && !scanDetected && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            border: '1px solid var(--warning-300)',
            background: 'var(--warning-50)',
          }}
        >
          <div className="card-body" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ fontSize: 28 }}>🤖</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 8, fontWeight: 800 }}>
                  {assistantAdvice?.title || 'Assistente importazione'}
                </h3>
                <p style={{ marginBottom: 12, color: 'var(--gray-700)' }}>
                  {assistantAdvice?.message || importError}
                </p>

                {assistantAdvice?.suggestions?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Cosa puoi fare adesso:</div>
                    <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--gray-700)' }}>
                      {assistantAdvice.suggestions.map((tip, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={retryLastImport} disabled={!lastFile}>
                    Riprova con lo stesso file
                  </button>
                  <button className="btn btn-secondary" onClick={resetImportState}>
                    Scegli un altro file
                  </button>
                  <button className="btn btn-success" onClick={startManualInsert}>
                    + Inserimento manuale
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 24,
          background: 'white',
          borderRadius: 'var(--border-radius-lg)',
          border: '1px solid var(--gray-200)',
          overflow: 'hidden',
        }}
      >
        {['Caricamento', 'Mappatura Manuale', 'Anteprima', 'Conferma', 'Completato'].map((label, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '14px 16px',
              textAlign: 'center',
              background:
                step > i + 1 ? 'var(--success-50)' : step === i + 1 ? 'var(--primary-50)' : 'white',
              borderRight: i < 4 ? '1px solid var(--gray-200)' : 'none',
              color:
                step > i + 1
                  ? 'var(--success-700)'
                  : step === i + 1
                    ? 'var(--primary-700)'
                    : 'var(--gray-400)',
              fontWeight: step === i + 1 || (step === 2 && i === 1) ? 700 : 500,
              fontSize: 13,
            }}
          >
            <span style={{ marginRight: 6 }}>{step > i + 1 ? '✓' : i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <div className="card-body" style={{ padding: 40 }}>
            <div className="import-dropzone" onClick={() => fileInputRef.current?.click()}>
              <div className="import-dropzone-icon">📄</div>
              <div className="import-dropzone-text">
                Clicca per selezionare un file o trascinalo qui
              </div>
              <div className="import-dropzone-hint">
                Formati supportati: PDF, Excel, CSV, XML, DOC, DOCX
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.xml,.doc,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            <div
              style={{
                marginTop: 24,
                padding: 20,
                border: '1px dashed var(--primary-300)',
                borderRadius: 'var(--border-radius-lg)',
                background: 'var(--primary-50)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>✍️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                Inserimento manuale componenti
              </h3>
              <p className="text-muted" style={{ marginBottom: 16 }}>
                Usa questa funzione per caricare uno o più componenti senza importare una fattura.
              </p>
              <button className="btn btn-primary btn-lg" onClick={startManualInsert}>
                + Inserisci componente manualmente
              </button>
            </div>

            <p className="text-center text-muted mt-4" style={{ fontSize: 13 }}>
              Il sistema analizzerà il documento e individuerà automaticamente i materiali contenuti.
              Potrai verificare e confermare tutto prima del caricamento.
            </p>
          </div>
        </div>
      )}

      {step === 6 && (
        <ScanInvoiceFallback
          fileName={fileName}
          rows={scanRows}
          showInstallerPrice={showInstallerPrice}
          onChangeRow={updateScanRow}
          onAddRow={addScanRow}
          onRemoveRow={removeScanRow}
          onCancel={resetImportState}
          onContinue={continueFromScanFallback}
          supplierSuggestions={supplierSuggestions}
        />
      )}

      {step === 3 && rawWorkbookData && (
        <div className="card animate-fadeIn">
          <div className="card-header" style={{ background: 'var(--warning-50)' }}>
            <h3 className="card-title">🛡️ Mappatura Manuale</h3>
            <p className="text-sm mt-1">
              L'auto-rilevamento è fallito. Indica quali colonne contengono i dati:
            </p>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {rawWorkbookData[0].map((_, colIdx) => (
                    <th key={colIdx} style={{ minWidth: 120, textAlign: 'center' }}>
                      <select
                        className="form-control mb-2"
                        value={Object.keys(manualMapping).find((k) => manualMapping[k] === colIdx) || ''}
                        onChange={(e) => {
                          const field = e.target.value;
                          if (field) setManualMapping((prev) => ({ ...prev, [field]: colIdx }));
                        }}
                        style={{ fontSize: 11, padding: 4 }}
                      >
                        <option value="">Ignora</option>
                        <option value="code">Codice</option>
                        <option value="description">Descrizione</option>
                        <option value="quantity">Quantità</option>
                        <option value="unit">U.M.</option>
                        <option value="price">Prezzo Netto</option>
                        <option value="brand">Marca</option>
                        <option value="category">Categoria</option>
                        <option value="location">Posizione</option>
                        <option value="supplier">Fornitore</option>
                      </select>
                      <div style={{ color: 'var(--gray-400)', fontSize: 10 }}>Col {colIdx + 1}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawWorkbookData.slice(0, 10).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          background: Object.values(manualMapping).includes(cIdx)
                            ? 'var(--primary-50)'
                            : 'transparent',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {String(cell || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            <button
              className="btn btn-primary btn-lg w-100"
              disabled={manualMapping.code === -1 || manualMapping.quantity === -1}
              onClick={() => {
                const memory = JSON.parse(localStorage.getItem('import_mapping_memory') || '{}');
                const fingerprint = rawWorkbookData[0].join('|');
                memory[fingerprint] = manualMapping;
                localStorage.setItem('import_mapping_memory', JSON.stringify(memory));

                processItems(rawWorkbookData.slice(1), manualMapping, fileName, invoiceRecord);
              }}
            >
              {manualMapping.code === -1 || manualMapping.quantity === -1
                ? 'Seleziona almeno Codice e Quantità'
                : 'Analizza con Mappatura Manuale →'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div
            className="card-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h3 className="card-title">📋 Materiali rilevati da: {fileName}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-sm btn-outline-primary" onClick={applyAllSuggestions}>
                🪄 Applica Suggerimenti Auto
              </button>
              <button className="btn btn-sm btn-success" onClick={startManualInsert}>
                + Aggiungi manualmente
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setStep(1);
                  setParsedItems([]);
                }}
              >
                ← Indietro
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>✓</th>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Marca</th>
                  <th>Qtà</th>
                  <th>UM</th>
                  <th>Prezzo Netto</th>
                  <th>Listino +22%</th>
                  {showInstallerPrice && <th>Installatore -10% +22%</th>}
                  <th>Totale Netto</th>
                  <th>Posizione</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, idx) => {
                  const rowTotal = Number(item.quantity || 0) * Number(item.price || 0);

                  return (
                    <tr
                      key={item.importRowId || idx}
                      style={{
                        background:
                          item.confidence === 'certi'
                            ? 'var(--success-25)'
                            : item.confidence === 'probabili'
                              ? 'var(--primary-25)'
                              : item.isNew
                                ? 'var(--warning-25)'
                                : 'transparent',
                        borderLeft:
                          item.confidence === 'certi'
                            ? '4px solid var(--success-500)'
                            : item.confidence === 'probabili'
                              ? '4px solid var(--primary-500)'
                              : item.isNew
                                ? '4px solid var(--warning-500)'
                                : 'none',
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => updateItem(idx, 'selected', e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                      </td>

                      <td>
                        <input
                          className="form-control"
                          value={item.code}
                          onChange={(e) => updateItem(idx, 'code', e.target.value)}
                          style={{ minWidth: 130 }}
                        />
                      </td>

                      <td>
                        <input
                          className="form-control"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          style={{ minWidth: 220 }}
                        />
                      </td>

                      <td>
                        <input
                          className="form-control"
                          value={item.brand}
                          onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                          style={{ minWidth: 140 }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-control"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          style={{ width: 90 }}
                        />
                      </td>

                      <td>
                        <input
                          className="form-control"
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          style={{ width: 80 }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          value={item.price ?? 0}
                          onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                          style={{ width: 110 }}
                        />
                      </td>

                      <td style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {formatCurrency(calculateListPrice(item.price))}
                      </td>

                      {showInstallerPrice && (
                        <td
                          style={{
                            fontWeight: 900,
                            whiteSpace: 'nowrap',
                            color: 'var(--primary-700)',
                          }}
                        >
                          {formatCurrency(calculateInstallerPrice(item.price))}
                        </td>
                      )}

                      <td style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {formatCurrency(rowTotal)}
                      </td>

                      <td>
                        <input
                          className="form-control"
                          value={item.location}
                          onChange={(e) => updateItem(idx, 'location', e.target.value)}
                          style={{ width: 110 }}
                        />
                      </td>

                      <td>
                        <select
                          className="form-control"
                          value={item.category}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            border: item.category
                              ? '1px solid var(--gray-300)'
                              : '2px solid var(--warning-400)',
                            backgroundColor: 'white',
                            minWidth: 150,
                          }}
                        >
                          <option value="">Seleziona...</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        {item.category && (
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gray-500)' }}>
                            {getCategoryName(item.category)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="card-footer"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div className="text-sm">
              {parsedItems.filter((i) => i.selected).length} materiali selezionati ·{' '}
              <span
                style={{
                  color: parsedItems.some((i) => i.isNew && i.selected && !i.category)
                    ? 'var(--danger-600)'
                    : 'inherit',
                }}
              >
                {parsedItems.filter((i) => i.isNew && i.selected && !i.category).length} da completare
              </span>
            </div>

            <button
              className="btn btn-primary"
              disabled={parsedItems.filter((i) => i.selected).length === 0}
              onClick={() => {
                const missing = parsedItems.some((i) => i.isNew && i.selected && !i.category);
                if (missing) {
                  alert('Seleziona una categoria per tutti i nuovi materiali prima di procedere.');
                  return;
                }
                setStep(4);
              }}
            >
              {parsedItems.filter((i) => i.selected).length === 0
                ? 'Nessun materiale selezionato'
                : 'Procedi alla conferma →'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">✅ Riepilogo Importazione</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 15, color: 'var(--gray-700)' }}>
                Stai per importare <strong>{parsedItems.filter((i) => i.selected).length}</strong> materiali
                dal file <strong>{fileName}</strong>:
              </p>
              <ul style={{ marginTop: 12, paddingLeft: 20, color: 'var(--gray-600)' }}>
                <li>
                  <strong>{parsedItems.filter((i) => i.selected && !i.isNew).length}</strong> materiali esistenti — verrà aggiunta la quantità
                </li>
                <li>
                  <strong>{parsedItems.filter((i) => i.selected && i.isNew).length}</strong> nuovi materiali — verranno creati in anagrafica
                </li>
              </ul>
            </div>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Modifica
              </button>
              <button className="btn btn-success btn-lg" onClick={handleConfirmImport}>
                ✓ Conferma Importazione
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 5 && results && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
              Importazione Completata
            </h2>

            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              <div
                style={{
                  background: 'var(--success-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '16px 24px',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success-600)' }}>
                  {results.loaded}
                </div>
                <div className="text-sm text-muted">Caricati</div>
              </div>

              <div
                style={{
                  background: 'var(--primary-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '16px 24px',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-600)' }}>
                  {results.created}
                </div>
                <div className="text-sm text-muted">Creati</div>
              </div>

              {results.errors.length > 0 && (
                <div
                  style={{
                    background: 'var(--danger-50)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '16px 24px',
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger-600)' }}>
                    {results.errors.length}
                  </div>
                  <div className="text-sm text-muted">Errori</div>
                </div>
              )}
            </div>

            {invoiceRecord?.id && (
              <div
                style={{
                  background: 'var(--success-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: 16,
                  marginBottom: 20,
                  textAlign: 'left',
                }}
              >
                <div className="fw-semibold text-success mb-2">File originale archiviato</div>
                <div className="text-sm text-muted">
                  {invoiceRecord.originalFileName || invoiceRecord.fileName}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Stato archivio: {invoiceRecord.status}
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div
                style={{
                  textAlign: 'left',
                  background: 'var(--danger-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div className="fw-semibold text-danger mb-2">Errori riscontrati:</div>
                {results.errors.map((err, i) => (
                  <div
                    key={i}
                    className="text-sm"
                    style={{ color: 'var(--danger-700)', marginBottom: 4 }}
                  >
                    • {err}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={resetImportState}>
                Importa un altro documento
              </button>
              <Link to="/inventario" className="btn btn-secondary btn-lg">
                📦 Vai all'Inventario
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
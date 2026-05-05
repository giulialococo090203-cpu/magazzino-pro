import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  materialStore,
  categoryStore,
  movementStore,
  adminLogStore,
  invoiceImportStore,
} from '../../data/store';
import { useAuth } from '../../App';
import { normalize, aggressiveMatch } from '../../utils/classificationEngine';
import { parseFile } from '../../utils/importer/OmniParser';
import { findBestMapping } from '../../utils/importer/HeuristicAnalysis';
import ScanInvoiceFallback, {
  createEmptyRow,
} from '../../components/import/ScanInvoiceFallback.jsx';

const MAX_FILE_SIZE_MB = 15;
const SUPPORTED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'xml', 'doc', 'docx'];

const EMPTY_MAPPING = {
  code: -1,
  description: -1,
  quantity: -1,
  unit: -1,
  price: -1,
  brand: -1,
  category: -1,
  location: -1,
};

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

function formatCurrency(value = 0) {
  const number = Number(value || 0);

  return number.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCode(value = '') {
  return String(value || '').trim().toLowerCase();
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
        'Se il documento arriva da un gestionale, prova a esportarlo in Excel, CSV o XML fattura elettronica.',
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
    suggestions.push('Se il PDF è una scansione immagine, compila le righe con la procedura guidata.');
    suggestions.push('Se è un PDF nativo, il sistema prova a leggerne i dati e mostrarli in anteprima.');
  }

  if (msg.includes('xml')) {
    suggestions.push('Verifica che sia un XML fattura elettronica valido.');
    suggestions.push('Se arriva dal cassetto fiscale o da un gestionale, scarica il file XML originale e non una copia PDF.');
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
    suggestions.push('Correggi manualmente eventuali righe in anteprima prima della conferma.');
    suggestions.push('Se necessario, usa inserimento manuale guidato.');
  }

  return {
    title: 'L’assistente ha rilevato un problema nel caricamento',
    message: `Non sono riuscito a leggere correttamente il file "${file.name}". Motivo: ${rawMessage}`,
    suggestions,
  };
}

function getInitialDocumentMeta(fileName = '') {
  return {
    source: '',
    fileName,
    supplierName: '',
    invoiceNumber: '',
    invoiceDate: '',
    documentTotal: 0,
    vatNumber: '',
  };
}

export default function ImportaFatture() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [documentMeta, setDocumentMeta] = useState(getInitialDocumentMeta());

  const [parsedItems, setParsedItems] = useState([]);
  const [results, setResults] = useState(null);

  const [categories, setCategories] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [rawWorkbookData, setRawWorkbookData] = useState(null);
  const [manualMapping, setManualMapping] = useState({ ...EMPTY_MAPPING });

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

  const [showOnlyProblems, setShowOnlyProblems] = useState(false);

  const canUseImport = canImportInvoices(user?.role);

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

  const existingCodesSet = useMemo(() => {
    return new Set((allMaterials || []).map((m) => normalizeCode(m.code)).filter(Boolean));
  }, [allMaterials]);

  const previewStats = useMemo(() => {
    const selected = parsedItems.filter((item) => item.selected);
    const newItems = selected.filter((item) => item.isNew);
    const existingItems = selected.filter((item) => !item.isNew);
    const missingCategory = selected.filter((item) => item.isNew && !item.category);
    const invalidRows = selected.filter((item) => item.validationErrors?.length > 0);
    const totalQty = selected.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
    const totalValue = selected.reduce(
      (sum, item) => sum + safeNumber(item.quantity) * safeNumber(item.price),
      0
    );

    return {
      selectedCount: selected.length,
      newCount: newItems.length,
      existingCount: existingItems.length,
      missingCategoryCount: missingCategory.length,
      invalidCount: invalidRows.length,
      totalQty,
      totalValue,
    };
  }, [parsedItems]);

  const visiblePreviewItems = useMemo(() => {
    if (!showOnlyProblems) return parsedItems;

    return parsedItems.filter(
      (item) =>
        item.validationErrors?.length > 0 ||
        (item.isNew && item.selected && !item.category) ||
        item.confidence === 'da_confermare' ||
        item.confidence === 'none'
    );
  }, [parsedItems, showOnlyProblems]);

  const resetImportState = () => {
    setStep(1);
    setFileName('');
    setDocumentMeta(getInitialDocumentMeta());
    setParsedItems([]);
    setResults(null);
    setRawWorkbookData(null);
    setManualMapping({ ...EMPTY_MAPPING });
    setImportError(null);
    setAssistantAdvice(null);
    setLoading(false);
    setLoadingProgress({ current: 0, total: 0 });
    setScanDetected(false);
    setScanMessage('');
    setScanRows([createEmptyRow()]);
    setInvoiceRecord(null);
    setStorageWarning('');
    setShowOnlyProblems(false);

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
    setDocumentMeta({
      ...getInitialDocumentMeta('Inserimento manuale'),
      source: 'manuale',
    });
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
    setShowOnlyProblems(false);
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

  const enrichAndValidateItems = (items = []) => {
    const codeCounts = {};

    items.forEach((item) => {
      const key = normalizeCode(item.code);
      if (!key) return;
      codeCounts[key] = (codeCounts[key] || 0) + 1;
    });

    return items.map((item) => {
      const validationErrors = [];

      const code = String(item.code || '').trim();
      const description = String(item.description || '').trim();
      const quantity = safeNumber(item.quantity);
      const price = safeNumber(item.price);

      if (!code) validationErrors.push('Codice mancante');
      if (!description) validationErrors.push('Descrizione mancante');
      if (quantity <= 0) validationErrors.push('Quantità non valida');
      if (price < 0) validationErrors.push('Prezzo non valido');
      if (item.isNew && !item.category) validationErrors.push('Categoria mancante');
      if (codeCounts[normalizeCode(code)] > 1) validationErrors.push('Codice duplicato nel documento');

      return {
        ...item,
        code,
        description,
        quantity,
        price,
        validationErrors,
      };
    });
  };

  const updateItem = (index, field, value) => {
    setParsedItems((prev) => {
      const next = prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
              isAutoAssigned: field === 'category' ? false : item.isAutoAssigned,
            }
          : item
      );

      return enrichAndValidateItems(next);
    });
  };

  const toggleItemSelected = (index, selected) => {
    setParsedItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, selected } : item));
      return enrichAndValidateItems(next);
    });
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
      const materialText = normalize(
        `${material.code || ''} ${material.description || ''} ${material.brand || ''}`
      );

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
    setParsedItems((prev) => {
      const next = prev.map((item) => {
        if (!item.selected) return item;

        const suggestedCategory = suggestCategoryForItem(item);
        if (!suggestedCategory) return item;

        return {
          ...item,
          category: suggestedCategory,
          isAutoAssigned: true,
        };
      });

      return enrichAndValidateItems(next);
    });
  };

  const selectAllPreviewRows = () => {
    setParsedItems((prev) => enrichAndValidateItems(prev.map((item) => ({ ...item, selected: true }))));
  };

  const deselectAllPreviewRows = () => {
    setParsedItems((prev) => enrichAndValidateItems(prev.map((item) => ({ ...item, selected: false }))));
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

  const buildItemFromRawValues = async ({
    rawCode,
    rawDescription,
    rawQuantity,
    rawUnit,
    rawPrice,
    rawBrand,
    rawCategory,
    rawLocation,
    currentFileName,
    source,
  }) => {
    const trainingData = allMaterials.length > 0 ? allMaterials : await materialStore.getAll();

    const code = String(rawCode || '').trim();
    const desc = String(rawDescription || '').trim();
    const unit = String(rawUnit || 'ST').trim() || 'ST';
    const brand = String(rawBrand || '').trim();
    const explicitCat = String(rawCategory || '').trim();
    const location = String(rawLocation || 'A1-01').trim() || 'A1-01';

    const qty = safeNumber(rawQuantity);
    const price = safeNumber(rawPrice);

    if (!code && !desc) return null;
    if (!code || code.length < 2) return null;
    if (!desc) return null;
    if (qty <= 0) return null;

    const recognition = aggressiveMatch(
      { code, description: desc },
      { materials: trainingData, categories }
    );

    let existing =
      recognition.bestMatch?.type === 'material' ? recognition.bestMatch.original : null;

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

    const suggestions = (recognition.allCandidates || [])
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

    const alreadyExistsByCode = existingCodesSet.has(normalizeCode(code));

    return {
      code: existing?.code || code,
      description: existing ? existing.description : desc,
      quantity: qty,
      unit: existing ? existing.unit : unit,
      price: price || existing?.netPrice || 0,
      isNew: !existing && !alreadyExistsByCode,
      selected: true,
      category: catId,
      isAutoAssigned,
      confidence: recognition.confidence,
      suggestions,
      brand: brand || existing?.brand || recognition.bestMatch?.original?.brand || documentMeta.supplierName || 'Da assegnare',
      minThreshold: existing?.minThreshold || 10,
      location: location || existing?.location || 'A1-01',
      supplier: existing?.supplier || documentMeta.supplierName || 'Importato',
      notes: `Import: ${currentFileName}`,
      existingMaterial: existing,
      source,
      validationErrors: [],
    };
  };

  const buildParsedItemsFromRows = async ({
    rows,
    mapping,
    currentFileName = fileName,
    invoice = invoiceRecord,
    source = 'documento',
  }) => {
    const processed = [];

    for (const row of rows || []) {
      if (!row || row.length === 0) continue;

      const rawCode = row?.[mapping.code];
      const rawDescription = mapping.description !== -1 ? row?.[mapping.description] : '';
      const rawQuantity = row?.[mapping.quantity];
      const rawUnit = mapping.unit !== undefined && mapping.unit !== -1 ? row?.[mapping.unit] : 'ST';
      const rawPrice = mapping.price !== undefined && mapping.price !== -1 ? row?.[mapping.price] : 0;
      const rawBrand = mapping.brand !== undefined && mapping.brand !== -1 ? row?.[mapping.brand] : '';
      const rawCategory =
        mapping.category !== undefined && mapping.category !== -1 ? row?.[mapping.category] : '';
      const rawLocation =
        mapping.location !== undefined && mapping.location !== -1 ? row?.[mapping.location] : '';

      const looksLikeHeader =
        String(rawCode || '').toLowerCase() === 'codice' ||
        String(rawDescription || '').toLowerCase() === 'descrizione' ||
        String(rawQuantity || '').toLowerCase() === 'quantita' ||
        String(rawQuantity || '').toLowerCase() === 'quantità';

      if (looksLikeHeader) continue;

      const item = await buildItemFromRawValues({
        rawCode,
        rawDescription,
        rawQuantity,
        rawUnit,
        rawPrice,
        rawBrand,
        rawCategory,
        rawLocation,
        currentFileName,
        source,
      });

      if (item) processed.push(item);
    }

    if (processed.length === 0) {
      throw new Error('Nessun materiale valido rilevato nel documento.');
    }

    const enriched = enrichAndValidateItems(processed);

    setParsedItems(enriched);
    setImportError(null);
    setAssistantAdvice(null);
    setScanDetected(false);
    setScanMessage('');
    setShowOnlyProblems(false);
    setStep(2);

    await markInvoiceAsAnalyzedSafe(invoice, enriched.length);
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
        row.unit || 'ST',
        row.price || 0,
        row.brand || '',
        row.category || '',
        row.location || 'A1-01',
      ]),
    ];

    setRawWorkbookData(matrix);
    setScanDetected(false);
    setScanMessage('');

    await buildParsedItemsFromRows({
      rows: matrix.slice(1),
      mapping: {
        code: 0,
        description: 1,
        quantity: 2,
        unit: 3,
        price: 4,
        brand: 5,
        category: 6,
        location: 7,
      },
      currentFileName: fileName || 'Inserimento manuale',
      invoice: invoiceRecord,
      source: 'manuale',
    });
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

  const analyzeParsedFile = async (parsed, activeFile, uploadedInvoice) => {
    const extension = getFileExtension(activeFile.name);
    const data = parsed?.matrix || parsed;

    const meta = {
      ...getInitialDocumentMeta(activeFile.name),
      ...(parsed?.meta || {}),
      source: parsed?.source || extension,
      fileName: activeFile.name,
    };

    setDocumentMeta(meta);
    setRawWorkbookData(data);

    if (parsed?.scanDetected) {
      setScanDetected(true);
      setScanMessage(parsed?.message || 'Documento scansito rilevato.');
      setRawWorkbookData([]);
      setScanRows([createEmptyRow()]);
      setStep(6);
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Il file è stato letto ma non contiene righe utilizzabili.');
    }

    if (extension === 'pdf' || extension === 'xml') {
      await buildParsedItemsFromRows({
        rows: data.slice(1),
        mapping: {
          code: 0,
          description: 1,
          quantity: 2,
          unit: 3,
          price: 4,
          brand: 5,
          category: 6,
          location: 7,
        },
        currentFileName: activeFile.name,
        invoice: uploadedInvoice,
        source: extension,
      });

      return;
    }

    const analysis = findBestMapping(data);

    if (analysis && analysis.confidence > 0.6) {
      await buildParsedItemsFromRows({
        rows: data.slice(analysis.headerRowIndex + 1),
        mapping: analysis.mapping,
        currentFileName: activeFile.name,
        invoice: uploadedInvoice,
        source: extension,
      });
    } else {
      setStep(3);
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
    setDocumentMeta(getInitialDocumentMeta(file.name));
    setInvoiceRecord(null);
    setStorageWarning('');
    setShowOnlyProblems(false);

    let uploadedInvoice = null;

    try {
      validateFileBeforeImport(file);

      uploadedInvoice = await uploadInvoiceFileSafe(file);

      setStep(2);

      const parsed = await parseFile(file);

      await analyzeParsedFile(parsed, file, uploadedInvoice);
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
    setDocumentMeta(getInitialDocumentMeta(lastFile.name));
    setShowOnlyProblems(false);

    let activeInvoice = invoiceRecord;

    try {
      validateFileBeforeImport(lastFile);

      if (!activeInvoice?.id) {
        activeInvoice = await uploadInvoiceFileSafe(lastFile);
      }

      setStep(2);

      const parsed = await parseFile(lastFile);

      await analyzeParsedFile(parsed, lastFile, activeInvoice);
    } catch (err) {
      console.error('Retry Import Error:', err);
      setImportError(err.message || 'Errore durante il nuovo tentativo.');
      setAssistantAdvice(buildImportAssistantMessage(err, lastFile));
      await markInvoiceAsErrorSafe(activeInvoice, err.message || 'Errore durante il nuovo tentativo.');
      setStep(1);
    }
  };

  const canProceedToConfirm = () => {
    const selected = parsedItems.filter((item) => item.selected);

    if (selected.length === 0) return false;

    return !selected.some(
      (item) =>
        item.validationErrors?.some(
          (err) =>
            err !== 'Codice duplicato nel documento' &&
            !(err === 'Categoria mancante' && !item.isNew)
        ) ||
        (item.isNew && !item.category)
    );
  };

  const handleGoToConfirm = () => {
    if (parsedItems.filter((item) => item.selected).length === 0) {
      alert('Seleziona almeno una riga da importare.');
      return;
    }

    const missing = parsedItems.some((item) => item.isNew && item.selected && !item.category);
    if (missing) {
      alert('Seleziona una categoria per tutti i nuovi materiali prima di procedere.');
      setShowOnlyProblems(true);
      return;
    }

    const invalid = parsedItems.some(
      (item) =>
        item.selected &&
        item.validationErrors?.some((err) => err !== 'Codice duplicato nel documento')
    );

    if (invalid) {
      alert('Correggi le righe con errori prima di procedere.');
      setShowOnlyProblems(true);
      return;
    }

    setStep(4);
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
      const key = normalizeCode(item.code);

      if (!groupedItems[key]) {
        groupedItems[key] = { ...item };
      } else {
        groupedItems[key].quantity = safeNumber(groupedItems[key].quantity) + safeNumber(item.quantity);

        if (!groupedItems[key].existingMaterial) {
          groupedItems[key].existingMaterial = item.existingMaterial;
        }

        groupedItems[key].notes = `${groupedItems[key].notes || ''} · Riga duplicata accorpata`;
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

          await materialStore.create({
            code: item.code,
            description: item.description,
            brand: item.brand,
            category: item.category,
            quantity: safeNumber(item.quantity),
            unit: item.unit,
            netPrice: safeNumber(item.price),
            minThreshold: item.minThreshold,
            location: item.location,
            supplier: item.supplier || documentMeta.supplierName || 'Importato',
            notes: item.notes,
          });

          created++;
        } else if (item.existingMaterial) {
          if (safeNumber(item.price) > 0) {
            await materialStore.update(item.existingMaterial.id, {
              netPrice: safeNumber(item.price),
            });
          }

          await movementStore.create({
            materialId: item.existingMaterial.id,
            type: 'entrata',
            quantity: safeNumber(item.quantity),
            reason: 'importazione_fattura',
            notes: `Importazione da fattura/documento: ${fileName}${
              documentMeta.invoiceNumber ? ` · Documento ${documentMeta.invoiceNumber}` : ''
            }`,
            userId: user?.id,
            userName: user?.fullName || user?.username || '',
            operatorName: user?.fullName || user?.username || '',
          });

          loaded++;
        }
      } catch (err) {
        errors.push(`${item.code}: ${err.message}`);
      }
    }

    setResults({
      loaded,
      created,
      errors,
      totalSelected: selectedItems.length,
      totalGrouped: itemsToProcess.length,
      totalValue: previewStats.totalValue,
    });

    if (created > 0 || loaded > 0) {
      await adminLogStore.create({
        userId: user?.id,
        entity: 'materiali',
        action: 'importazione',
        details: `Importazione controllata completata: ${created} creati, ${loaded} aggiornati dal file ${fileName}${
          documentMeta.invoiceNumber ? `, documento ${documentMeta.invoiceNumber}` : ''
        }.`,
      });
    }

    if (invoiceRecord?.id) {
      try {
        const updated = await invoiceImportStore.markCompleted(invoiceRecord.id, {
          detectedItems: selectedItems.length,
          createdItems: created,
          updatedItems: loaded,
          errors,
        });

        setInvoiceRecord(updated);
      } catch (err) {
        console.warn('Impossibile aggiornare stato finale fattura:', err);
        setStorageWarning(
          'Importazione completata, ma non sono riuscito ad aggiornare lo stato finale dell’archivio fatture.'
        );
      }
    }

    try {
      const freshMaterials = await materialStore.getAll();
      setAllMaterials(Array.isArray(freshMaterials) ? freshMaterials : []);
    } catch {
      // Non bloccare il completamento se il refresh inventario fallisce.
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
          <p className="page-subtitle">
            Procedura controllata con lettura PDF, Excel, CSV, XML, anteprima e correzione manuale
          </p>
        </div>

        <div className="btn-group">
          <Link to="/fatture" className="btn btn-secondary">
            🗂️ Archivio fatture
          </Link>
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
        {['Caricamento', 'Anteprima controllata', 'Mappatura manuale', 'Conferma', 'Completato'].map(
          (label, i) => {
            const visualStep =
              step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : step === 4 ? 4 : step === 5 ? 5 : 2;

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  textAlign: 'center',
                  background:
                    visualStep > i + 1
                      ? 'var(--success-50)'
                      : visualStep === i + 1
                        ? 'var(--primary-50)'
                        : 'white',
                  borderRight: i < 4 ? '1px solid var(--gray-200)' : 'none',
                  color:
                    visualStep > i + 1
                      ? 'var(--success-700)'
                      : visualStep === i + 1
                        ? 'var(--primary-700)'
                        : 'var(--gray-400)',
                  fontWeight: visualStep === i + 1 ? 700 : 500,
                  fontSize: 13,
                }}
              >
                <span style={{ marginRight: 6 }}>{visualStep > i + 1 ? '✓' : i + 1}</span>
                {label}
              </div>
            );
          }
        )}
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
                Formati supportati: PDF, Excel, CSV, XML fattura elettronica, DOC, DOCX
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

            <div className="grid-3" style={{ marginTop: 24 }}>
              <div className="kpi-card">
                <div className="kpi-icon blue">🧾</div>
                <div className="kpi-content">
                  <div className="kpi-label">XML fattura</div>
                  <div className="kpi-detail">Legge righe, codici, quantità e prezzi</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon purple">🛡️</div>
                <div className="kpi-content">
                  <div className="kpi-label">Anteprima</div>
                  <div className="kpi-detail">Correggi tutto prima di salvare</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon green">✅</div>
                <div className="kpi-content">
                  <div className="kpi-label">Import controllato</div>
                  <div className="kpi-detail">Crea nuovi o carica esistenti solo alla conferma</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 6 && (
        <ScanInvoiceFallback
          fileName={fileName}
          rows={scanRows}
          onChangeRow={updateScanRow}
          onAddRow={addScanRow}
          onRemoveRow={removeScanRow}
          onCancel={resetImportState}
          onContinue={continueFromScanFallback}
        />
      )}

      {step === 3 && rawWorkbookData && (
        <div className="card animate-fadeIn">
          <div className="card-header" style={{ background: 'var(--warning-50)' }}>
            <div>
              <h3 className="card-title">🛡️ Mappatura Manuale</h3>
              <p className="text-sm mt-1">
                L’auto-rilevamento è incerto. Indica quali colonne contengono i dati.
              </p>
            </div>
          </div>

          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {(rawWorkbookData[0] || []).map((_, colIdx) => (
                    <th key={colIdx} style={{ minWidth: 120, textAlign: 'center' }}>
                      <select
                        className="form-control mb-2"
                        value={Object.keys(manualMapping).find((k) => manualMapping[k] === colIdx) || ''}
                        onChange={(e) => {
                          const field = e.target.value;

                          setManualMapping((prev) => {
                            const next = { ...prev };

                            Object.keys(next).forEach((key) => {
                              if (next[key] === colIdx) next[key] = -1;
                            });

                            if (field) next[field] = colIdx;

                            return next;
                          });
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
                      </select>

                      <div style={{ color: 'var(--gray-400)', fontSize: 10 }}>Col {colIdx + 1}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rawWorkbookData.slice(0, 10).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {(row || []).map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          background: Object.values(manualMapping).includes(cIdx)
                            ? 'var(--primary-50)'
                            : 'transparent',
                          whiteSpace: 'nowrap',
                          maxWidth: 220,
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
              className="btn btn-primary btn-lg w-full"
              disabled={
                manualMapping.code === -1 ||
                manualMapping.quantity === -1 ||
                manualMapping.description === -1
              }
              onClick={() => {
                const memory = JSON.parse(localStorage.getItem('import_mapping_memory') || '{}');
                const fingerprint = (rawWorkbookData[0] || []).join('|');

                memory[fingerprint] = manualMapping;
                localStorage.setItem('import_mapping_memory', JSON.stringify(memory));

                buildParsedItemsFromRows({
                  rows: rawWorkbookData.slice(1),
                  mapping: manualMapping,
                  currentFileName: fileName,
                  invoice: invoiceRecord,
                  source: getFileExtension(fileName) || 'manual_mapping',
                });
              }}
            >
              {manualMapping.code === -1 ||
              manualMapping.quantity === -1 ||
              manualMapping.description === -1
                ? 'Seleziona almeno Codice, Descrizione e Quantità'
                : 'Analizza con Mappatura Manuale →'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-icon blue">📋</div>
              <div className="kpi-content">
                <div className="kpi-label">Righe selezionate</div>
                <div className="kpi-value">{previewStats.selectedCount}</div>
                <div className="kpi-detail">su {parsedItems.length} rilevate</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon green">📦</div>
              <div className="kpi-content">
                <div className="kpi-label">Esistenti</div>
                <div className="kpi-value">{previewStats.existingCount}</div>
                <div className="kpi-detail">verrà aggiunta quantità</div>
              </div>
            </div>

            <div className={`kpi-card ${previewStats.missingCategoryCount > 0 ? 'warning' : ''}`}>
              <div className="kpi-icon yellow">🆕</div>
              <div className="kpi-content">
                <div className="kpi-label">Nuovi materiali</div>
                <div className="kpi-value">{previewStats.newCount}</div>
                <div className="kpi-detail">
                  {previewStats.missingCategoryCount > 0
                    ? `${previewStats.missingCategoryCount} senza categoria`
                    : 'categorie complete'}
                </div>
              </div>
            </div>

            <div className={`kpi-card ${previewStats.invalidCount > 0 ? 'danger' : ''}`}>
              <div className="kpi-icon red">🛡️</div>
              <div className="kpi-content">
                <div className="kpi-label">Controlli</div>
                <div className="kpi-value">{previewStats.invalidCount}</div>
                <div className="kpi-detail">righe da verificare</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon purple">🔢</div>
              <div className="kpi-content">
                <div className="kpi-label">Quantità totale</div>
                <div className="kpi-value">{previewStats.totalQty}</div>
                <div className="kpi-detail">somma righe selezionate</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon teal">💶</div>
              <div className="kpi-content">
                <div className="kpi-label">Valore stimato</div>
                <div className="kpi-value" style={{ fontSize: 23 }}>
                  {formatCurrency(previewStats.totalValue)}
                </div>
                <div className="kpi-detail">quantità × prezzo netto</div>
              </div>
            </div>
          </div>

          {(documentMeta.supplierName ||
            documentMeta.invoiceNumber ||
            documentMeta.invoiceDate ||
            documentMeta.documentTotal) && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3 className="card-title">🧾 Dati documento rilevati</h3>
              </div>

              <div className="card-body">
                <div className="grid-3">
                  <div>
                    <div className="text-xs text-muted fw-semibold">Fornitore</div>
                    <div style={{ fontWeight: 900 }}>{documentMeta.supplierName || '—'}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted fw-semibold">Numero documento</div>
                    <div style={{ fontWeight: 900 }}>{documentMeta.invoiceNumber || '—'}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted fw-semibold">Data documento</div>
                    <div style={{ fontWeight: 900 }}>{documentMeta.invoiceDate || '—'}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted fw-semibold">Totale documento</div>
                    <div style={{ fontWeight: 900 }}>
                      {documentMeta.documentTotal ? formatCurrency(documentMeta.documentTotal) : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted fw-semibold">P.IVA fornitore</div>
                    <div style={{ fontWeight: 900 }}>{documentMeta.vatNumber || '—'}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted fw-semibold">Origine lettura</div>
                    <div style={{ fontWeight: 900 }}>{documentMeta.source || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div
              className="card-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
            >
              <div>
                <h3 className="card-title">📋 Anteprima controllata: {fileName}</h3>
                <p className="card-subtitle">
                  Correggi codici, quantità, prezzi, categoria e posizione prima della conferma.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-outline-primary" onClick={applyAllSuggestions}>
                  🪄 Applica suggerimenti
                </button>

                <button className="btn btn-sm btn-secondary" onClick={selectAllPreviewRows}>
                  Seleziona tutto
                </button>

                <button className="btn btn-sm btn-secondary" onClick={deselectAllPreviewRows}>
                  Deseleziona tutto
                </button>

                <button
                  className={`btn btn-sm ${showOnlyProblems ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={() => setShowOnlyProblems((prev) => !prev)}
                >
                  {showOnlyProblems ? 'Mostra tutte' : 'Solo problemi'}
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
                    <th>Esito</th>
                    <th>Codice</th>
                    <th>Descrizione</th>
                    <th>Marca</th>
                    <th>Qtà</th>
                    <th>UM</th>
                    <th>Prezzo Netto</th>
                    <th>Totale</th>
                    <th>Posizione</th>
                    <th>Categoria</th>
                    <th>Controlli</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePreviewItems.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ padding: 36 }}>
                        <div className="empty-state">
                          <div className="empty-state-icon">✅</div>
                          <div className="empty-state-title">Nessun problema da mostrare</div>
                          <div className="empty-state-text">Tutte le righe selezionate sembrano complete.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visiblePreviewItems.map((item) => {
                      const realIndex = parsedItems.findIndex((row) => row === item);
                      const rowTotal = safeNumber(item.quantity) * safeNumber(item.price);
                      const hasProblems = item.validationErrors?.length > 0;

                      return (
                        <tr
                          key={`${item.code}-${realIndex}`}
                          style={{
                            background: hasProblems
                              ? 'var(--danger-50)'
                              : item.confidence === 'certi'
                                ? 'var(--success-25)'
                                : item.confidence === 'probabili'
                                  ? 'var(--primary-25)'
                                  : item.isNew
                                    ? 'var(--warning-25)'
                                    : 'transparent',
                            borderLeft: hasProblems
                              ? '4px solid var(--danger-500)'
                              : item.confidence === 'certi'
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
                              onChange={(e) => toggleItemSelected(realIndex, e.target.checked)}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>

                          <td>
                            {item.isNew ? (
                              <span className="status-badge status-sotto_soglia">Nuovo</span>
                            ) : (
                              <span className="status-badge status-disponibile">Esistente</span>
                            )}

                            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                              {item.confidence || '—'}
                            </div>
                          </td>

                          <td>
                            <input
                              className="form-control"
                              value={item.code}
                              onChange={(e) => updateItem(realIndex, 'code', e.target.value)}
                              style={{ minWidth: 130 }}
                            />
                          </td>

                          <td>
                            <input
                              className="form-control"
                              value={item.description}
                              onChange={(e) => updateItem(realIndex, 'description', e.target.value)}
                              style={{ minWidth: 240 }}
                            />
                          </td>

                          <td>
                            <input
                              className="form-control"
                              value={item.brand}
                              onChange={(e) => updateItem(realIndex, 'brand', e.target.value)}
                              style={{ minWidth: 140 }}
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-control"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(realIndex, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              style={{ width: 90 }}
                            />
                          </td>

                          <td>
                            <input
                              className="form-control"
                              value={item.unit}
                              onChange={(e) => updateItem(realIndex, 'unit', e.target.value.toUpperCase())}
                              style={{ width: 80 }}
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              className="form-control"
                              value={item.price ?? 0}
                              onChange={(e) =>
                                updateItem(realIndex, 'price', parseFloat(e.target.value) || 0)
                              }
                              style={{ width: 120 }}
                            />
                          </td>

                          <td style={{ fontWeight: 900 }}>{formatCurrency(rowTotal)}</td>

                          <td>
                            <input
                              className="form-control"
                              value={item.location}
                              onChange={(e) => updateItem(realIndex, 'location', e.target.value)}
                              style={{ width: 110 }}
                            />
                          </td>

                          <td>
                            <select
                              className="form-control"
                              value={item.category}
                              onChange={(e) => updateItem(realIndex, 'category', e.target.value)}
                              style={{
                                padding: '6px 10px',
                                fontSize: 12,
                                border: item.category
                                  ? '1px solid var(--gray-300)'
                                  : '2px solid var(--warning-400)',
                                backgroundColor: 'white',
                                minWidth: 160,
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

                          <td>
                            {item.validationErrors?.length > 0 ? (
                              <div style={{ minWidth: 180 }}>
                                {item.validationErrors.map((err, i) => (
                                  <div
                                    key={i}
                                    className="text-xs"
                                    style={{
                                      color:
                                        err === 'Codice duplicato nel documento'
                                          ? 'var(--warning-700)'
                                          : 'var(--danger-700)',
                                      fontWeight: 800,
                                      marginBottom: 4,
                                    }}
                                  >
                                    • {err}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-success fw-semibold">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="card-footer"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
            >
              <div className="text-sm">
                <strong>{previewStats.selectedCount}</strong> selezionati ·{' '}
                <strong>{previewStats.newCount}</strong> nuovi ·{' '}
                <strong>{previewStats.existingCount}</strong> esistenti · Valore stimato{' '}
                <strong>{formatCurrency(previewStats.totalValue)}</strong>
              </div>

              <button
                className="btn btn-primary"
                disabled={!canProceedToConfirm()}
                onClick={handleGoToConfirm}
              >
                {previewStats.selectedCount === 0
                  ? 'Nessun materiale selezionato'
                  : previewStats.invalidCount > 0 || previewStats.missingCategoryCount > 0
                    ? 'Correggi le righe prima di continuare'
                    : 'Procedi alla conferma →'}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">✅ Riepilogo Importazione</h3>
          </div>

          <div className="card-body">
            <div className="grid-3" style={{ marginBottom: 22 }}>
              <div className="kpi-card">
                <div className="kpi-icon blue">📋</div>
                <div className="kpi-content">
                  <div className="kpi-label">Righe selezionate</div>
                  <div className="kpi-value">{previewStats.selectedCount}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon green">📦</div>
                <div className="kpi-content">
                  <div className="kpi-label">Da caricare</div>
                  <div className="kpi-value">{previewStats.existingCount}</div>
                  <div className="kpi-detail">materiali già presenti</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon purple">🆕</div>
                <div className="kpi-content">
                  <div className="kpi-label">Da creare</div>
                  <div className="kpi-value">{previewStats.newCount}</div>
                  <div className="kpi-detail">nuovi materiali</div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 15, color: 'var(--gray-700)', marginBottom: 14 }}>
              Stai per importare <strong>{previewStats.selectedCount}</strong> materiali dal file{' '}
              <strong>{fileName}</strong>.
            </p>

            <div
              style={{
                padding: 16,
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--warning-50)',
                color: 'var(--warning-700)',
                marginBottom: 20,
                fontWeight: 800,
              }}
            >
              Dopo la conferma, i materiali nuovi verranno creati e quelli già presenti riceveranno un movimento
              di entrata. Controlla bene quantità, prezzi e categorie prima di procedere.
            </div>

            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Modifica anteprima
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

              <div
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '16px 24px',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-800)' }}>
                  {formatCurrency(results.totalValue)}
                </div>
                <div className="text-sm text-muted">Valore stimato</div>
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
                  <div key={i} className="text-sm" style={{ color: 'var(--danger-700)', marginBottom: 4 }}>
                    • {err}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={resetImportState}>
                Importa un altro documento
              </button>
              <Link to="/fatture" className="btn btn-secondary btn-lg">
                🗂️ Archivio Fatture
              </Link>
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
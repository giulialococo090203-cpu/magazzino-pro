import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

function readEnv(name) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  const match = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) return '';

  return match[1].trim().replace(/^["']|["']$/g, '');
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY nel file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PREFIX = 'TEST_2026_';
const YEAR = 2026;

const suppliers = [
  'Ariston spa',
  'Baxi Italia',
  'Immergas Ricambi',
  'Vaillant Group',
  'Ferroli Service',
  'Riello Ricambi',
  'Caleffi',
  'Gewiss',
  'BTicino',
  'Vimar',
];

const categories = [
  'Elettrico',
  'Idraulico',
  'Caldaie',
  'Schede elettroniche',
  'Sensori',
  'Valvole',
  'Cavi',
  'Accessori',
];

const materialNames = [
  'SCHEDA PRINCIPALE',
  'ELETTRODO DI ACCENSIONE',
  'ELETTRODO DI IONIZZAZIONE',
  'SONDA NTC',
  'VALVOLA GAS',
  'PRESSOSTATO FUMI',
  'CIRCOLATORE',
  'MANOPOLA NERA',
  'TERMOSTATO SICUREZZA',
  'CAVO CABLAGGIO',
  'GUARNIZIONE CAMERA',
  'VASO ESPANSIONE',
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function dateInMonth(year, monthIndex) {
  const day = randomInt(1, 26);
  const hour = randomInt(8, 18);
  const minute = randomInt(0, 59);
  return new Date(year, monthIndex, day, hour, minute, 0).toISOString();
}

function cloneRowsWithoutColumn(rows, column) {
  return rows.map((row) => {
    const copy = { ...row };
    delete copy[column];
    return copy;
  });
}

function detectMissingColumn(message) {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" does not exist/i,
    /Could not find the column '([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = String(message || '').match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function insertFlexible(table, rows, label, maxRetries = 20) {
  let workingRows = rows.map((row) => ({ ...row }));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.from(table).insert(workingRows).select();

    if (!error) {
      console.log(`✅ Inseriti ${data.length} record in ${table} (${label})`);
      return data;
    }

    const missingColumn = detectMissingColumn(error.message);

    if (missingColumn) {
      console.warn(`⚠️ ${table}: colonna non trovata "${missingColumn}", la rimuovo e riprovo...`);
      workingRows = cloneRowsWithoutColumn(workingRows, missingColumn);
      continue;
    }

    console.error(`❌ Errore inserimento ${label} (${table}):`, error.message);
    console.error('Esempio riga:', workingRows[0]);
    return [];
  }

  console.error(`❌ Troppi tentativi su ${table}.`);
  return [];
}

async function tryInsertOneOfTables(tables, rows, label) {
  for (const table of tables) {
    const inserted = await insertFlexible(table, rows, label);
    if (inserted.length) {
      return { table, rows: inserted };
    }
  }

  return { table: null, rows: [] };
}

async function main() {
  console.log('🚀 Creo simulazione annuale MagazzinoPro compatibile...');
  console.log(`Anno: ${YEAR}`);
  console.log(`Prefisso dati test: ${PREFIX}`);

  const categoryRows = categories.map((name) => ({
    name: `${PREFIX}${name}`,
    nome: `${PREFIX}${name}`,
    label: `${PREFIX}${name}`,
    created_at: new Date(YEAR, 0, 1).toISOString(),
    updated_at: new Date(YEAR, 0, 1).toISOString(),
  }));

  const insertedCategories = await insertFlexible('categorie', categoryRows, 'categorie');

  const categoryNames = insertedCategories.length
    ? insertedCategories.map((c) => c.name || c.nome || c.label).filter(Boolean)
    : categories.map((c) => `${PREFIX}${c}`);

  const materialRows = Array.from({ length: 120 }, (_, index) => {
    const supplier = randomItem(suppliers);
    const category = randomItem(categoryNames);
    const code = `${PREFIX}${60000000 + index + 1}`;
    const quantity = randomInt(0, 35);
    const minStock = randomInt(2, 12);
    const netPrice = randomPrice(8, 420);

    return {
      code,
      codice: code,
      description: `${randomItem(materialNames)} TEST ${index + 1}`,
      descrizione: `${randomItem(materialNames)} TEST ${index + 1}`,
      category,
      categoria: category,
      supplier,
      fornitore: supplier,
      quantity,
      quantita: quantity,
      giacenza: quantity,
      min_stock: minStock,
      soglia_minima: minStock,
      net_price: netPrice,
      prezzo_netto: netPrice,
      location: `Scaffale ${randomInt(1, 8)} - Ripiano ${randomInt(1, 5)}`,
      ubicazione: `Scaffale ${randomInt(1, 8)} - Ripiano ${randomInt(1, 5)}`,
      created_at: new Date(YEAR, 0, 2, 9, index % 60, 0).toISOString(),
      updated_at: new Date(YEAR, 0, 2, 9, index % 60, 0).toISOString(),
    };
  });

  const insertedMaterials = await insertFlexible('materiali', materialRows, 'materiali');

  if (!insertedMaterials.length) {
    console.error('❌ Nessun materiale inserito. Mandami l’output del grep su store.js per adattare le colonne.');
    process.exit(1);
  }

  const movementRows = [];

  for (let month = 0; month < 12; month++) {
    const monthlyMovements = randomInt(45, 80);

    for (let i = 0; i < monthlyMovements; i++) {
      const material = randomItem(insertedMaterials);
      const isEntry = Math.random() > 0.42;
      const quantity = isEntry ? randomInt(1, 12) : randomInt(1, 6);
      const date = dateInMonth(YEAR, month);

      movementRows.push({
        material_id: material.id,
        materialId: material.id,
        material_id_ref: material.id,
        code: material.code || material.codice,
        codice: material.code || material.codice,
        description: material.description || material.descrizione,
        descrizione: material.description || material.descrizione,
        type: isEntry ? 'entrata' : 'uscita',
        tipo: isEntry ? 'entrata' : 'uscita',
        movement_type: isEntry ? 'entrata' : 'uscita',
        quantity,
        quantita: quantity,
        reason: isEntry ? 'importazione_fattura' : 'uscita_lavoro',
        motivo: isEntry ? 'importazione_fattura' : 'uscita_lavoro',
        client_name: isEntry ? '' : randomItem(['Rossi Impianti', 'Bianchi Service', 'Condominio Aurora']),
        cliente: isEntry ? '' : randomItem(['Rossi Impianti', 'Bianchi Service', 'Condominio Aurora']),
        authorized_by: isEntry ? '' : 'Roberto Lococo',
        autorizzato_da: isEntry ? '' : 'Roberto Lococo',
        user_name: 'Terminale',
        utente: 'Terminale',
        date,
        data: date,
        created_at: date,
        updated_at: date,
      });
    }
  }

  await insertFlexible('movimenti', movementRows, 'movimenti annuali');

  const priceRows = [];

  for (let month = 0; month < 12; month++) {
    const monthlyRows = randomInt(35, 70);

    for (let i = 0; i < monthlyRows; i++) {
      const material = randomItem(insertedMaterials);
      const supplier = material.supplier || material.fornitore || randomItem(suppliers);
      const quantity = randomInt(1, 18);
      const netPrice = randomPrice(8, 460);
      const date = dateInMonth(YEAR, month);

      priceRows.push({
        material_id: material.id,
        materialId: material.id,
        code: material.code || material.codice,
        codice: material.code || material.codice,
        description: material.description || material.descrizione,
        descrizione: material.description || material.descrizione,
        supplier,
        fornitore: supplier,
        quantity,
        quantita: quantity,
        net_price: netPrice,
        prezzo_netto: netPrice,
        gross_price: Number((netPrice * 1.22).toFixed(2)),
        prezzo_lordo: Number((netPrice * 1.22).toFixed(2)),
        origin: 'fattura',
        origine: 'fattura',
        document: `FATTURA_TEST_${YEAR}_${String(month + 1).padStart(2, '0')}_${String(i + 1).padStart(3, '0')}.pdf`,
        documento: `FATTURA_TEST_${YEAR}_${String(month + 1).padStart(2, '0')}_${String(i + 1).padStart(3, '0')}.pdf`,
        date,
        data: date,
        created_at: date,
        updated_at: date,
      });
    }
  }

  const priceResult = await tryInsertOneOfTables(
    ['storico_prezzi', 'price_history', 'prezzi', 'prezzi_storico'],
    priceRows,
    'righe economiche'
  );

  if (!priceResult.rows.length) {
    console.warn('⚠️ Righe economiche non inserite: tabella storico prezzi non trovata o colonne incompatibili.');
  }

  const notificationRows = insertedMaterials.slice(0, 35).map((material) => ({
    title: `Scorta bassa ${material.code || material.codice}`,
    titolo: `Scorta bassa ${material.code || material.codice}`,
    message: `${material.code || material.codice} - ${material.description || material.descrizione}: quantità sotto soglia`,
    messaggio: `${material.code || material.codice} sotto soglia`,
    type: 'warning',
    tipo: 'warning',
    read: false,
    letta: false,
    is_read: false,
    material_id: material.id,
    materialId: material.id,
    created_at: dateInMonth(YEAR, randomInt(0, 11)),
    updated_at: new Date().toISOString(),
  }));

  await insertFlexible('notifiche', notificationRows, 'notifiche');

  console.log('');
  console.log('🎉 Simulazione annuale completata.');
  console.log(`- ${insertedCategories.length} categorie`);
  console.log(`- ${insertedMaterials.length} materiali`);
  console.log(`- ${movementRows.length} movimenti generati`);
  console.log(`- ${priceResult.rows.length} righe economiche inserite in ${priceResult.table || 'nessuna tabella'}`);
  console.log(`- ${notificationRows.length} notifiche generate`);
  console.log('');
  console.log('Apri l’app e testa dashboard, storico, inventario, rendicontazione ed export Excel.');
}

main().catch((err) => {
  console.error('❌ Errore generale seed:', err);
  process.exit(1);
});

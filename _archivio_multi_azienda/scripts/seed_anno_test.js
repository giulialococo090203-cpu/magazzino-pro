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
  'Fantini Cosmi',
  'Caleffi',
  'Gewiss',
  'BTicino',
  'Vimar',
  'Finder',
];

const categories = [
  'Elettrico',
  'Idraulico',
  'Caldaie',
  'Bruciatori',
  'Schede elettroniche',
  'Sensori',
  'Valvole',
  'Cavi',
  'Accessori',
  'Consumabili',
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
  'RUBINETTO CARICO',
  'VENTILATORE FUMI',
  'TRASFORMATORE ACCENSIONE',
  'FLUSSOSTATO',
  'SCAMBIATORE PRIMARIO',
  'SCAMBIATORE SANITARIO',
  'KIT MEMBRANE',
  'FILTRO ACQUA',
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

async function insertRows(table, rows, label) {
  if (!rows.length) return [];

  const { data, error } = await supabase.from(table).insert(rows).select();

  if (error) {
    console.error(`❌ Errore inserimento ${label} (${table}):`, error.message);
    console.error('Esempio riga:', rows[0]);
    return [];
  }

  console.log(`✅ Inseriti ${data.length} record in ${table} (${label})`);
  return data;
}

async function main() {
  console.log('🚀 Creo simulazione annuale MagazzinoPro...');
  console.log(`Anno: ${YEAR}`);
  console.log(`Prefisso dati test: ${PREFIX}`);

  // 1. Categorie
  const categoryRows = categories.map((name, index) => ({
    name: `${PREFIX}${name}`,
    description: `Categoria test annuale ${name}`,
    created_at: new Date(YEAR, 0, 1, 8, index, 0).toISOString(),
    updated_at: new Date(YEAR, 0, 1, 8, index, 0).toISOString(),
  }));

  const insertedCategories = await insertRows('categorie', categoryRows, 'categorie');

  // 2. Materiali
  const materialRows = Array.from({ length: 120 }, (_, index) => {
    const supplier = randomItem(suppliers);
    const category = randomItem(insertedCategories)?.name || `${PREFIX}${randomItem(categories)}`;
    const baseCode = String(60000000 + index + 1);

    const minStock = randomInt(2, 12);
    const quantity = randomInt(0, 35);
    const netPrice = randomPrice(8, 420);

    return {
      code: `${PREFIX}${baseCode}`,
      description: `${randomItem(materialNames)} TEST ${index + 1}`,
      brand: randomItem(['Ariston', 'Baxi', 'Immergas', 'Vaillant', 'Riello', 'Generico']),
      category,
      supplier,
      quantity,
      min_stock: minStock,
      minStock,
      net_price: netPrice,
      netPrice,
      location: `Scaffale ${randomInt(1, 8)} - Ripiano ${randomInt(1, 5)}`,
      notes: 'Dato generato per test annuale',
      created_at: new Date(YEAR, 0, 2, 9, index % 60, 0).toISOString(),
      updated_at: new Date(YEAR, 0, 2, 9, index % 60, 0).toISOString(),
    };
  });

  const insertedMaterials = await insertRows('materiali', materialRows, 'materiali');

  if (!insertedMaterials.length) {
    console.error('❌ Nessun materiale inserito. Mi fermo per evitare dati incompleti.');
    process.exit(1);
  }

  // 3. Movimenti per 12 mesi
  const movementRows = [];

  for (let month = 0; month < 12; month++) {
    const monthlyMovements = randomInt(45, 80);

    for (let i = 0; i < monthlyMovements; i++) {
      const material = randomItem(insertedMaterials);
      const isEntry = Math.random() > 0.42;
      const quantity = isEntry ? randomInt(1, 12) : randomInt(1, 6);
      const movementDate = dateInMonth(YEAR, month);

      movementRows.push({
        material_id: material.id,
        materialId: material.id,
        code: material.code,
        description: material.description,
        type: isEntry ? 'entrata' : 'uscita',
        movement_type: isEntry ? 'entrata' : 'uscita',
        quantity,
        previous_quantity: randomInt(0, 35),
        new_quantity: randomInt(0, 45),
        reason: isEntry
          ? randomItem(['carico_fornitore', 'importazione_fattura', 'reintegro_magazzino'])
          : randomItem(['uscita_lavoro', 'scarico_cliente', 'utilizzo_intervento']),
        client_name: isEntry ? '' : randomItem(['Rossi Impianti', 'Bianchi Service', 'Condominio Aurora', 'Cliente banco']),
        authorized_by: isEntry ? '' : randomItem(['Roberto Lococo', 'Terminale', 'Operatore']),
        user_name: randomItem(['Terminale', 'Roberto Lococo', 'Admin']),
        date: movementDate,
        created_at: movementDate,
        updated_at: movementDate,
      });
    }
  }

  await insertRows('movimenti', movementRows, 'movimenti annuali');

  // 4. Righe economiche / storico prezzi per rendicontazione
  const priceRows = [];

  for (let month = 0; month < 12; month++) {
    const monthlyRows = randomInt(35, 70);

    for (let i = 0; i < monthlyRows; i++) {
      const material = randomItem(insertedMaterials);
      const supplier = material.supplier || randomItem(suppliers);
      const quantity = randomInt(1, 18);
      const netPrice = randomPrice(8, 460);
      const date = dateInMonth(YEAR, month);

      priceRows.push({
        material_id: material.id,
        materialId: material.id,
        code: material.code,
        description: material.description,
        supplier,
        quantity,
        net_price: netPrice,
        netPrice,
        gross_price: Number((netPrice * 1.22).toFixed(2)),
        grossPrice: Number((netPrice * 1.22).toFixed(2)),
        origin: randomItem(['fattura', 'importazione_fattura', 'carico manuale']),
        document: `FATTURA_TEST_${YEAR}_${String(month + 1).padStart(2, '0')}_${String(i + 1).padStart(3, '0')}.pdf`,
        date,
        created_at: date,
        updated_at: date,
      });
    }
  }

  const priceTables = ['storico_prezzi', 'price_history', 'prezzi'];

  let priceInserted = false;

  for (const table of priceTables) {
    const { data, error } = await supabase.from(table).insert(priceRows).select();

    if (!error) {
      console.log(`✅ Inserite ${data.length} righe economiche in ${table}`);
      priceInserted = true;
      break;
    }
  }

  if (!priceInserted) {
    console.warn('⚠️ Non sono riuscito a inserire righe economiche: tabella storico prezzi non riconosciuta.');
    console.warn('   Materiali e movimenti sono comunque stati creati.');
  }

  // 5. Notifiche
  const notificationRows = insertedMaterials
    .filter((m) => Number(m.quantity || 0) <= Number(m.min_stock || m.minStock || 0))
    .slice(0, 35)
    .map((material) => ({
      title: `Scorta bassa ${material.code}`,
      message: `${material.code} - ${material.description}: quantità sotto soglia`,
      type: 'warning',
      read: false,
      is_read: false,
      material_id: material.id,
      materialId: material.id,
      created_at: dateInMonth(YEAR, randomInt(0, 11)),
      updated_at: new Date().toISOString(),
    }));

  await insertRows('notifiche', notificationRows, 'notifiche');

  console.log('');
  console.log('🎉 Simulazione annuale completata.');
  console.log(`Creati circa:`);
  console.log(`- ${categoryRows.length} categorie`);
  console.log(`- ${materialRows.length} materiali`);
  console.log(`- ${movementRows.length} movimenti`);
  console.log(`- ${priceRows.length} righe economiche`);
  console.log(`- ${notificationRows.length} notifiche`);
  console.log('');
  console.log('Apri l’app e testa dashboard, storico, inventario, rendicontazione ed export Excel.');
}

main().catch((err) => {
  console.error('❌ Errore generale seed:', err);
  process.exit(1);
});

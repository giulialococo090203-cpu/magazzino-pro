
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

  'Finder',

  'Fantini Cosmi',

];

const categoryNames = [

  'Elettrico',

  'Idraulico',

  'Caldaie',

  'Schede elettroniche',

  'Sensori',

  'Valvole',

  'Cavi',

  'Accessori',

  'Consumabili',

  'Bruciatori',

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

async function safeDelete(label, fn) {

  const { error } = await fn();

  if (error) {

    console.warn(`⚠️ Pulizia ${label} non completata: ${error.message}`);

  } else {

    console.log(`🧹 Pulizia ${label} completata`);

  }

}

async function insertRows(table, rows, label) {

  if (!rows.length) return [];

  const { data, error } = await supabase.from(table).insert(rows).select();

  if (error) {

    console.error(`❌ Errore inserimento ${label} in ${table}:`, error.message);

    console.error('Esempio riga:', rows[0]);

    return [];

  }

  console.log(`✅ Inseriti ${data.length} record in ${table} (${label})`);

  return data;

}

async function main() {

  console.log('🚀 Seed annuale reale MagazzinoPro');

  console.log(`Anno: ${YEAR}`);

  console.log(`Prefisso: ${PREFIX}`);

  console.log('');

  console.log('🧹 Rimuovo eventuali dati test precedenti...');

  await safeDelete('notifiche TEST', () =>

    supabase.from('notifiche').delete().ilike('messaggio', `%${PREFIX}%`)

  );

  await safeDelete('movimenti TEST', () =>

    supabase.from('movimenti').delete().ilike('motivo', `%${PREFIX}%`)

  );

  await safeDelete('storico_prezzi TEST', () =>

    supabase.from('storico_prezzi').delete().ilike('codice', `${PREFIX}%`)

  );

  await safeDelete('fatture_importate TEST', () =>

    supabase.from('fatture_importate').delete().ilike('nome_file', `${PREFIX}%`)

  );

  await safeDelete('materiali TEST', () =>

    supabase.from('materiali').delete().ilike('codice', `${PREFIX}%`)

  );

  await safeDelete('categorie TEST', () =>

    supabase.from('categorie').delete().ilike('nome', `${PREFIX}%`)

  );

  console.log('');

  console.log('📦 Creo categorie...');

  const categorie = await insertRows(

    'categorie',

    categoryNames.map((name) => ({

      nome: `${PREFIX}${name}`,

      descrizione: `Categoria test ${name}`,

    })),

    'categorie'

  );

  if (!categorie.length) {

    console.error('❌ Categorie non create. Mi fermo.');

    process.exit(1);

  }

  console.log('');

  console.log('📦 Creo materiali...');

  const materialiRows = Array.from({ length: 500 }, (_, index) => {

    const categoria = randomItem(categorie);

    const supplier = randomItem(suppliers);

    const code = `${PREFIX}${String(70000000 + index + 1)}`;

    const qty = randomInt(0, 45);

    const min = randomInt(3, 14);

    const price = randomPrice(7, 520);

    return {

      codice: code,

      descrizione: `${randomItem(materialNames)} TEST ${index + 1}`,

      marca: randomItem(['Ariston', 'Baxi', 'Immergas', 'Vaillant', 'Riello', 'Generico']),

      quantita: qty,

      categoria_id: categoria.id,

      unita_misura: randomItem(['pz', 'mt', 'kg', 'cf']),

      soglia_minima: min,

      stato_disponibilita: qty <= 0 ? 'esaurito' : qty <= min ? 'sotto_soglia' : 'disponibile',

      posizione_scaffale: `Scaffale ${randomInt(1, 10)} - Ripiano ${randomInt(1, 5)}`,

      fornitore: supplier,

      note: `${PREFIX}Dato generato per test annuale`,

      prezzo_netto: price,

    };

  });

  const materiali = await insertRows('materiali', materialiRows, 'materiali');

  if (!materiali.length) {

    console.error('❌ Materiali non creati. Mi fermo.');

    process.exit(1);

  }

  console.log('');

  console.log('🔁 Creo movimenti annuali...');

  const movimentiRows = [];

  for (let month = 0; month < 12; month++) {

    const monthlyMovements = randomInt(180, 260);

    for (let i = 0; i < monthlyMovements; i++) {

      const material = randomItem(materiali);

      const isEntry = Math.random() > 0.42;

      const qta = isEntry ? randomInt(1, 16) : randomInt(1, 8);

      const previousQty = randomInt(0, 50);

      const newQty = isEntry ? previousQty + qta : Math.max(0, previousQty - qta);

      const date = dateInMonth(YEAR, month);

      movimentiRows.push({

        materiale_id: material.id,

        tipo_movimento: isEntry ? 'entrata' : 'uscita',

        quantita: qta,

        motivo: `${PREFIX}${isEntry ? 'Carico fornitore / fattura' : 'Scarico intervento cliente'}`,

        note: isEntry

          ? `${PREFIX}Carico test annuale`

          : `${PREFIX}Uscita test annuale per intervento`,

        utente_id: null,

        data_movimento: date,

        cliente_nome: isEntry

          ? null

          : randomItem(['Rossi Impianti', 'Bianchi Service', 'Condominio Aurora', 'Cliente banco']),

        autorizzato_da: isEntry ? null : randomItem(['Roberto Lococo', 'Terminale', 'Admin']),

        operatore_nome: randomItem(['Terminale', 'Roberto Lococo', 'Admin']),

        previous_qty: previousQty,

        new_qty: newQty,

        fornitore: material.fornitore || randomItem(suppliers),

      });

    }

  }

  const movimenti = await insertRows('movimenti', movimentiRows, 'movimenti annuali');

  console.log('');

  console.log('💶 Creo storico prezzi / rendicontazione economica...');

  const storicoPrezziRows = [];

  for (let month = 0; month < 12; month++) {

    const monthlyPrices = randomInt(150, 240);

    for (let i = 0; i < monthlyPrices; i++) {

      const material = randomItem(materiali);

      const qty = randomInt(1, 22);

      const netPrice = randomPrice(8, 540);

      const date = dateInMonth(YEAR, month);

      storicoPrezziRows.push({

        codice: material.codice,

        descrizione: material.descrizione,

        fornitore: material.fornitore || randomItem(suppliers),

        quantita: qty,

        prezzo_netto: netPrice,

        origine: 'fattura',

        documento: `${PREFIX}FATTURA_${YEAR}_${String(month + 1).padStart(2, '0')}_${String(i + 1).padStart(3, '0')}.pdf`,

        created_at: date,

      });

    }

  }

  const storico = await insertRows('storico_prezzi', storicoPrezziRows, 'storico prezzi');

  console.log('');

  console.log('🔔 Creo notifiche...');

  const materialiCritici = materiali

    .filter((m) => Number(m.quantita || 0) <= Number(m.soglia_minima || 0))

    .slice(0, 180);

  const notificheRows = materialiCritici.map((material) => ({

    materiale_id: material.id,

    tipo: 'warning',

    messaggio: `${PREFIX}${material.codice} - ${material.descrizione}: quantità sotto soglia`,

    letta: false,

  }));

  const notifiche = await insertRows('notifiche', notificheRows, 'notifiche');

  console.log('');

  console.log('📄 Creo fatture importate test, se la tabella lo permette...');

  const fattureRows = Array.from({ length: 180 }, (_, index) => {

    const month = index % 12;

    const supplier = suppliers[index % suppliers.length];

    const date = dateInMonth(YEAR, month);

    return {

      nome_file: `${PREFIX}FATTURA_${YEAR}_${String(month + 1).padStart(2, '0')}_${String(index + 1).padStart(3, '0')}.pdf`,

      nome_file_originale: `Fattura ${supplier} ${String(month + 1).padStart(2, '0')}-${YEAR}.pdf`,

      percorso_file: `${PREFIX.toLowerCase()}fatture/test_${index + 1}.pdf`,

      bucket: 'fatture',

      dimensione_file: randomInt(120000, 2400000),

      tipo_file: 'application/pdf',

      fornitore: supplier,

      utente_id: null,

      utente_nome: 'Terminale',

      stato_importazione: 'completata',

      numero_materiali_rilevati: randomInt(4, 18),

      numero_materiali_creati: randomInt(0, 4),

      numero_materiali_aggiornati: randomInt(2, 16),

      eventuali_errori: '',

      created_at: date,

      updated_at: date,

    };

  });

  const fatture = await insertRows('fatture_importate', fattureRows, 'fatture importate');

  console.log('');

  console.log('🎉 Seed completato.');

  console.log(`Categorie: ${categorie.length}`);

  console.log(`Materiali: ${materiali.length}`);

  console.log(`Movimenti: ${movimenti.length}`);

  console.log(`Storico prezzi: ${storico.length}`);

  console.log(`Notifiche: ${notifiche.length}`);

  console.log(`Fatture importate: ${fatture.length}`);

  console.log('');

  console.log('Ora apri l’app e testa: Dashboard, Inventario, Storico, Fatture, Rendicontazione, Export Excel.');

}

main().catch((err) => {

  console.error('❌ Errore generale seed:', err);

  process.exit(1);

});


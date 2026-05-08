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

const MATERIALS_COUNT = 1800;
const INTERVENTIONS_PER_DAY = 40;
const MIN_PIECES_PER_INTERVENTION = 4;
const MAX_PIECES_PER_INTERVENTION = 7;
const MIN_DAILY_ENTRY_ROWS = 18;
const MAX_DAILY_ENTRY_ROWS = 35;
const IMPORTED_INVOICES_COUNT = 900;
const CHUNK_SIZE = 1000;

const workers = [
  'Operaio 01 - Mario R.',
  'Operaio 02 - Luca B.',
  'Operaio 03 - Antonio F.',
  'Operaio 04 - Giuseppe C.',
  'Operaio 05 - Marco D.',
  'Operaio 06 - Paolo S.',
  'Operaio 07 - Salvatore G.',
  'Operaio 08 - Francesco L.',
  'Operaio 09 - Andrea P.',
  'Operaio 10 - Roberto M.',
  'Operaio 11 - Vincenzo T.',
  'Operaio 12 - Davide N.',
  'Operaio 13 - Simone A.',
  'Operaio 14 - Nicola V.',
  'Operaio 15 - Stefano E.',
  'Operaio 16 - Alessio Z.',
  'Operaio 17 - Fabio Q.',
];

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
  'Honeywell',
  'Danfoss',
  'Grundfos',
  'Wilo',
  'Italtherm',
  'Beretta Ricambi',
  'Sime',
  'Roca',
  'Fischer',
  'Bosch Termotecnica',
  'Cordivari',
  'Giacomini',
  'Watts',
  'Siemens',
  'ABB',
  'Schneider Electric',
  'Tecnocontrol',
  'Generico Forniture',
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
  'Termostati',
  'Pompe',
  'Raccorderia',
  'Sicurezza',
  'Filtri',
  'Guarnizioni',
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
  'RACCORDO OTTONE',
  'TUBO FLESSIBILE',
  'VALVOLA SFIATO',
  'CAVO ALIMENTAZIONE',
  'MORSETTIERA',
  'FUSIBILE',
  'PRESSOSTATO ACQUA',
  'KIT UGELLI',
  'POMPA CONDENSA',
  'SIFONE CONDENSA',
];

const clients = [
  'Condominio Aurora',
  'Condominio San Marco',
  'Rossi Impianti',
  'Bianchi Service',
  'Verdi Costruzioni',
  'Hotel Centrale',
  'Residence Sole',
  'Studio Tecnico Alfa',
  'Cliente banco',
  'Privato',
  'Officina Nord',
  'Centro Commerciale Est',
  'Palestra Olimpia',
  'Scuola Media Dante',
  'Comune - Manutenzione',
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

function dateInDay(dayIndex) {
  const date = new Date(YEAR, 0, 1);
  date.setDate(date.getDate() + dayIndex);
  date.setHours(randomInt(7, 18), randomInt(0, 59), 0, 0);
  return date.toISOString();
}

async function insertChunked(table, rows, label) {
  let inserted = [];

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.from(table).insert(chunk).select();

    if (error) {
      console.error(`❌ Errore inserimento ${label} in ${table}:`, error.message);
      console.error('Esempio riga:', chunk[0]);
      return inserted;
    }

    inserted = inserted.concat(data || []);
    console.log(`✅ ${label}: ${inserted.length}/${rows.length}`);
  }

  return inserted;
}

async function safeDelete(label, fn) {
  const { error } = await fn();

  if (error) {
    console.warn(`⚠️ Pulizia ${label} non completata: ${error.message}`);
  } else {
    console.log(`🧹 Pulizia ${label} completata`);
  }
}

async function main() {
  console.log('🚀 Seed realistico azienda 17 operai');
  console.log(`Anno: ${YEAR}`);
  console.log(`Interventi/giorno: ${INTERVENTIONS_PER_DAY}`);
  console.log(`Pezzi/intervento: ${MIN_PIECES_PER_INTERVENTION}-${MAX_PIECES_PER_INTERVENTION}`);
  console.log(`Materiali: ${MATERIALS_COUNT}`);
  console.log('');

  console.log('🧹 Pulizia dati test precedenti...');
  await safeDelete('notifiche TEST', () => supabase.from('notifiche').delete().ilike('messaggio', `%${PREFIX}%`));
  await safeDelete('movimenti TEST', () => supabase.from('movimenti').delete().ilike('motivo', `%${PREFIX}%`));
  await safeDelete('storico_prezzi TEST', () => supabase.from('storico_prezzi').delete().ilike('codice', `${PREFIX}%`));
  await safeDelete('fatture_importate TEST', () => supabase.from('fatture_importate').delete().ilike('nome_file', `${PREFIX}%`));
  await safeDelete('materiali TEST', () => supabase.from('materiali').delete().ilike('codice', `${PREFIX}%`));
  await safeDelete('categorie TEST', () => supabase.from('categorie').delete().ilike('nome', `${PREFIX}%`));

  console.log('');
  console.log('📁 Creo categorie...');
  const categorie = await insertChunked(
    'categorie',
    categoryNames.map((name) => ({
      nome: `${PREFIX}${name}`,
      descrizione: `Categoria test realistica ${name}`,
    })),
    'categorie'
  );

  if (!categorie.length) {
    console.error('❌ Categorie non create. Mi fermo.');
    process.exit(1);
  }

  console.log('');
  console.log('📦 Creo materiali...');
  const materialiRows = Array.from({ length: MATERIALS_COUNT }, (_, index) => {
    const categoria = randomItem(categorie);
    const supplier = randomItem(suppliers);
    const code = `${PREFIX}${String(80000000 + index + 1)}`;
    const qty = randomInt(0, 140);
    const min = randomInt(5, 28);
    const price = randomPrice(2, 850);

    return {
      codice: code,
      descrizione: `${randomItem(materialNames)} TEST ${index + 1}`,
      marca: randomItem(['Ariston', 'Baxi', 'Immergas', 'Vaillant', 'Riello', 'Caleffi', 'Gewiss', 'Generico']),
      quantita: qty,
      categoria_id: categoria.id,
      unita_misura: randomItem(['pz', 'mt', 'kg', 'cf']),
      soglia_minima: min,
      stato_disponibilita: qty <= 0 ? 'esaurito' : qty <= min ? 'sotto_soglia' : 'disponibile',
      posizione_scaffale: `Scaffale ${randomInt(1, 28)} - Ripiano ${randomInt(1, 8)}`,
      fornitore: supplier,
      note: `${PREFIX}Dato generato per stress test aziendale`,
      prezzo_netto: price,
    };
  });

  const materiali = await insertChunked('materiali', materialiRows, 'materiali');

  if (!materiali.length) {
    console.error('❌ Materiali non creati. Mi fermo.');
    process.exit(1);
  }

  console.log('');
  console.log('🔁 Creo movimenti: 40 interventi/giorno × 4-7 pezzi...');
  const movimentiRows = [];
  const storicoPrezziRows = [];
  const invoiceRows = [];

  for (let day = 0; day < 365; day++) {
    for (let intervention = 0; intervention < INTERVENTIONS_PER_DAY; intervention++) {
      const worker = workers[(day + intervention) % workers.length];
      const client = randomItem(clients);
      const interventionId = `${PREFIX}INT_${YEAR}_${String(day + 1).padStart(3, '0')}_${String(intervention + 1).padStart(2, '0')}`;
      const lines = randomInt(MIN_PIECES_PER_INTERVENTION, MAX_PIECES_PER_INTERVENTION);

      for (let line = 0; line < lines; line++) {
        const material = randomItem(materiali);
        const qta = randomInt(1, 4);
        const previousQty = randomInt(0, 160);
        const newQty = Math.max(0, previousQty - qta);
        const date = dateInDay(day);

        movimentiRows.push({
          materiale_id: material.id,
          tipo_movimento: 'uscita',
          quantita: qta,
          motivo: `${PREFIX}Scarico intervento ${interventionId}`,
          note: `${PREFIX}Uscita materiale per intervento giornaliero`,
          utente_id: null,
          data_movimento: date,
          cliente_nome: client,
          autorizzato_da: randomItem(['Roberto Lococo', 'Responsabile tecnico', 'Caposquadra']),
          operatore_nome: worker,
          previous_qty: previousQty,
          new_qty: newQty,
          fornitore: material.fornitore || randomItem(suppliers),
        });
      }
    }

    const dailyEntries = randomInt(MIN_DAILY_ENTRY_ROWS, MAX_DAILY_ENTRY_ROWS);

    for (let i = 0; i < dailyEntries; i++) {
      const material = randomItem(materiali);
      const qta = randomInt(3, 35);
      const previousQty = randomInt(0, 120);
      const newQty = previousQty + qta;
      const date = dateInDay(day);
      const netPrice = randomPrice(2, 850);
      const supplier = material.fornitore || randomItem(suppliers);
      const document = `${PREFIX}FATTURA_${YEAR}_${String(day + 1).padStart(3, '0')}_${String(i + 1).padStart(3, '0')}.pdf`;

      movimentiRows.push({
        materiale_id: material.id,
        tipo_movimento: 'entrata',
        quantita: qta,
        motivo: `${PREFIX}Carico fornitore / fattura`,
        note: `${PREFIX}Carico giornaliero da fattura`,
        utente_id: null,
        data_movimento: date,
        cliente_nome: null,
        autorizzato_da: null,
        operatore_nome: randomItem(['Magazziniere', 'Terminale', 'Roberto Lococo']),
        previous_qty: previousQty,
        new_qty: newQty,
        fornitore: supplier,
      });

      storicoPrezziRows.push({
        codice: material.codice,
        descrizione: material.descrizione,
        fornitore: supplier,
        quantita: qta,
        prezzo_netto: netPrice,
        origine: 'fattura',
        documento: document,
        created_at: date,
      });
    }

    if (day % 2 === 0 || Math.random() > 0.45) {
      const supplier = randomItem(suppliers);
      const date = dateInDay(day);

      invoiceRows.push({
        nome_file: `${PREFIX}FATTURA_${YEAR}_${String(day + 1).padStart(3, '0')}_${String(invoiceRows.length + 1).padStart(4, '0')}.pdf`,
        nome_file_originale: `Fattura ${supplier} giorno ${day + 1}.pdf`,
        percorso_file: `${PREFIX.toLowerCase()}fatture/fattura_${invoiceRows.length + 1}.pdf`,
        bucket: 'fatture',
        dimensione_file: randomInt(140000, 3200000),
        tipo_file: 'application/pdf',
        fornitore: supplier,
        utente_id: null,
        utente_nome: 'Terminale',
        stato_importazione: 'completata',
        numero_materiali_rilevati: randomInt(5, 28),
        numero_materiali_creati: randomInt(0, 8),
        numero_materiali_aggiornati: randomInt(4, 25),
        eventuali_errori: '',
        created_at: date,
        updated_at: date,
      });
    }
  }

  console.log('');
  console.log(`📊 Movimenti generati: ${movimentiRows.length}`);
  console.log(`💶 Righe economiche generate: ${storicoPrezziRows.length}`);
  console.log(`📄 Fatture generate: ${invoiceRows.length}`);

  console.log('');
  console.log('🔁 Inserisco movimenti...');
  const movimenti = await insertChunked('movimenti', movimentiRows, 'movimenti');

  console.log('');
  console.log('💶 Inserisco storico prezzi...');
  const storico = await insertChunked('storico_prezzi', storicoPrezziRows, 'storico prezzi');

  console.log('');
  console.log('📄 Inserisco fatture importate...');
  const fatture = await insertChunked('fatture_importate', invoiceRows, 'fatture importate');

  console.log('');
  console.log('🔔 Creo notifiche...');
  const materialiCritici = materiali
    .filter((m) => Number(m.quantita || 0) <= Number(m.soglia_minima || 0))
    .slice(0, 350);

  const notificheRows = materialiCritici.map((material) => ({
    materiale_id: material.id,
    tipo: 'warning',
    messaggio: `${PREFIX}${material.codice} - ${material.descrizione}: quantità sotto soglia`,
    letta: false,
  }));

  const notifiche = await insertChunked('notifiche', notificheRows, 'notifiche');

  console.log('');
  console.log('🎉 Seed aziendale completato.');
  console.log(`Categorie: ${categorie.length}`);
  console.log(`Materiali: ${materiali.length}`);
  console.log(`Movimenti: ${movimenti.length}`);
  console.log(`Storico prezzi: ${storico.length}`);
  console.log(`Fatture importate: ${fatture.length}`);
  console.log(`Notifiche: ${notifiche.length}`);
  console.log('');
  console.log('Domani testiamo: dashboard, inventario, storico, filtri, export Excel, rendicontazione e performance mobile.');
}

main().catch((err) => {
  console.error('❌ Errore generale seed:', err);
  process.exit(1);
});

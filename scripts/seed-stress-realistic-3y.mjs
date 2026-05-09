import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadDotEnv() {
  for (const envFile of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), envFile);
    if (!fs.existsSync(envPath)) continue;

    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadDotEnv();

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY_RUN = !APPLY;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Mancano SUPABASE_URL / SUPABASE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TAG = 'STRESS-3Y-REAL';
const PASSWORD = 'StressTest2026!';
const now = new Date();
const start = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));

const suppliers = [
  'TermoNord S.r.l.',
  'IdroService Italia',
  'EdilPro Supply',
  'ElettroLinea Group',
  'Ferramenta Centrale',
  'HVAC Components',
  'Sicurezza & DPI',
  'Ricambi Express',
  'Magazzini Industriali',
  'TecnoForniture',
  'Caleffi Distribuzione',
  'Viega Partner Italia',
  'Bticino Professional',
  'Fischer Edilizia',
  'Wurth Cantieri',
  'Bosch Professional',
  'Makita Tools',
  'Gewiss Impianti',
  'ClimaService Parts',
  'Cantieri Supply Toscana',
];

const categories = [
  ['Idraulica Stress', 'Tubi, raccordi, valvole e componenti idraulici'],
  ['Elettrico Stress', 'Cavi, quadri, placche e componenti elettrici'],
  ['Edilizia Stress', 'Malte, cementi, fissaggi e materiali edili'],
  ['Ferramenta Stress', 'Viti, bulloni, staffe, utensili e minuteria'],
  ['Climatizzazione Stress', 'Componenti HVAC, filtri e accessori impianto'],
  ['Sicurezza Stress', 'DPI, cartellonistica e dispositivi di protezione'],
  ['Consumo Stress', 'Materiali di consumo, sigillanti e nastri'],
  ['Ricambi Tecnici Stress', 'Ricambi per manutenzioni e assistenza tecnica'],
  ['Utensileria Stress', 'Utensili manuali ed elettroutensili'],
  ['Fissaggi Stress', 'Tasselli, ancoranti, barre e accessori fissaggio'],
];

const products = [
  ['Tubo multistrato', 'Idraulica Stress', 'IDR'],
  ['Raccordo pressfitting', 'Idraulica Stress', 'IDR'],
  ['Valvola a sfera', 'Idraulica Stress', 'IDR'],
  ['Curva rame', 'Idraulica Stress', 'IDR'],
  ['Cavo FG16', 'Elettrico Stress', 'ELT'],
  ['Interruttore magnetotermico', 'Elettrico Stress', 'ELT'],
  ['Scatola derivazione', 'Elettrico Stress', 'ELT'],
  ['Canalina PVC', 'Elettrico Stress', 'ELT'],
  ['Sacco malta premiscelata', 'Edilizia Stress', 'EDI'],
  ['Tassello nylon', 'Edilizia Stress', 'EDI'],
  ['Schiuma poliuretanica', 'Edilizia Stress', 'EDI'],
  ['Cemento rapido', 'Edilizia Stress', 'EDI'],
  ['Vite autofilettante', 'Ferramenta Stress', 'FER'],
  ['Bullone zincato', 'Ferramenta Stress', 'FER'],
  ['Staffa angolare', 'Ferramenta Stress', 'FER'],
  ['Rondella piana', 'Ferramenta Stress', 'FER'],
  ['Filtro split', 'Climatizzazione Stress', 'CLI'],
  ['Supporto unità esterna', 'Climatizzazione Stress', 'CLI'],
  ['Sifone condensa', 'Climatizzazione Stress', 'CLI'],
  ['Tubo scarico condensa', 'Climatizzazione Stress', 'CLI'],
  ['Guanti antitaglio', 'Sicurezza Stress', 'SIC'],
  ['Occhiali protettivi', 'Sicurezza Stress', 'SIC'],
  ['Nastro segnaletico', 'Sicurezza Stress', 'SIC'],
  ['Casco cantiere', 'Sicurezza Stress', 'SIC'],
  ['Nastro isolante', 'Consumo Stress', 'CON'],
  ['Silicone neutro', 'Consumo Stress', 'CON'],
  ['Cartuccia sigillante', 'Consumo Stress', 'CON'],
  ['Spray lubrificante', 'Consumo Stress', 'CON'],
  ['Pressostato ricambio', 'Ricambi Tecnici Stress', 'RIC'],
  ['Sonda temperatura', 'Ricambi Tecnici Stress', 'RIC'],
  ['Scheda controllo', 'Ricambi Tecnici Stress', 'RIC'],
  ['Relè comando', 'Ricambi Tecnici Stress', 'RIC'],
  ['Trapano SDS', 'Utensileria Stress', 'UTE'],
  ['Disco diamantato', 'Utensileria Stress', 'UTE'],
  ['Punta muro', 'Utensileria Stress', 'UTE'],
  ['Chiave regolabile', 'Utensileria Stress', 'UTE'],
  ['Ancorante chimico', 'Fissaggi Stress', 'FIS'],
  ['Barra filettata', 'Fissaggi Stress', 'FIS'],
  ['Tassello acciaio', 'Fissaggi Stress', 'FIS'],
  ['Collare fissaggio', 'Fissaggi Stress', 'FIS'],
];

const users = [
  ['Marco Bianchi', 'datore'],
  ['Giulia Conti', 'segretaria'],
  ['Laura Ferri', 'segretaria'],
  ['Paolo Ricci', 'magazziniere'],
  ['Davide Greco', 'magazziniere'],
  ['Luca Romano', 'operaio'],
  ['Matteo Russo', 'operaio'],
  ['Andrea Galli', 'operaio'],
  ['Francesco Villa', 'operaio'],
  ['Simone Riva', 'operaio'],
  ['Alessandro Neri', 'operaio'],
  ['Gabriele Moretti', 'operaio'],
  ['Stefano Martini', 'operaio'],
  ['Roberto Serra', 'operaio'],
  ['Nicola Costa', 'operaio'],
  ['Emanuele Longo', 'operaio'],
  ['Federico Fontana', 'operaio'],
  ['Michele Barbieri', 'operaio'],
  ['Sara Mancini', 'segretaria'],
  ['Elena Rizzo', 'segretaria'],
];

const clients = [
  'Condominio Aurora',
  'Cantiere Rossi',
  'Hotel Centrale',
  'Residenza Verdi',
  'Stabilimento Nord',
  'Impianto Alfa',
  'Centro Direzionale Tirreno',
  'Villa San Marco',
  'Cantiere Porto Livorno',
  'Manutenzione Programmata ASL',
  'Officina Meccanica Delta',
  'Residence Mare Blu',
];

const operationReasons = [
  'Installazione impianto',
  'Manutenzione ordinaria',
  'Intervento urgente',
  'Rifornimento squadra',
  'Ripristino materiale',
  'Allestimento cantiere',
  'Chiusura commessa',
  'Controllo tecnico',
  'Sostituzione componente',
  'Verifica impianto',
];

function rand(seed) {
  const x = Math.sin(seed * 999.91) * 10000;
  return x - Math.floor(x);
}

function pick(arr, seed) {
  return arr[Math.floor(rand(seed) * arr.length) % arr.length];
}

function isoFromWeek(weekIndex, dayOffset = 0, hour = 9, minute = 0) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + weekIndex * 7 + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateIsoFromIndex(index, hour = 9, minute = 0) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + index);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function slugName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function statusFor(qty, min) {
  if (qty <= 0) return 'esaurito';
  if (qty <= min) return 'sotto_soglia';
  return 'disponibile';
}

async function insertMany(table, rows, chunkSize = 500) {
  if (!rows.length) return;

  if (DRY_RUN) {
    console.log(`DRY RUN: ${table}: ${rows.length} righe`);
    return;
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);

    if (error) {
      console.error(`❌ Errore insert ${table}:`, error);
      throw error;
    }
  }

  console.log(`✅ Inserite ${rows.length} righe in ${table}`);
}

async function upsertMany(table, rows, onConflict, chunkSize = 500) {
  if (!rows.length) return;

  if (DRY_RUN) {
    console.log(`DRY RUN: ${table}: ${rows.length} righe`);
    return;
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });

    if (error) {
      console.error(`❌ Errore upsert ${table}:`, error);
      throw error;
    }
  }

  console.log(`✅ Upsert ${rows.length} righe in ${table}`);
}

async function main() {
  console.log(DRY_RUN ? '🧪 DRY RUN stress realistico 3 anni' : '🚀 Inserimento stress realistico 3 anni');

  const categoryRows = categories.map(([nome, descrizione], index) => ({
    nome,
    descrizione: `${descrizione} (${TAG})`,
  }));

  await upsertMany('categorie', categoryRows, 'nome');

  if (!APPLY) {
    console.log('ℹ️ Dry-run categorie completato. Per inserire davvero usa --apply');
  }

  const { data: dbCategories, error: catErr } = await supabase
    .from('categorie')
    .select('*')
    .like('descrizione', `%${TAG}%`);

  if (!DRY_RUN && catErr) throw catErr;

  const categoryIdByName = Object.fromEntries((dbCategories || []).map((c) => [c.nome, c.id]));

  const userRows = users.map(([name, role], index) => ({
    nome: name,
    username: `stress.${slugName(name)}`,
    email: `stress.${slugName(name)}@magazzino.test`,
    password: PASSWORD,
    ruolo: role,
    attivo: true,
  }));

  await upsertMany('utenti', userRows, 'username');

  const materialRows = [];
  for (let i = 0; i < 420; i++) {
    const [baseName, categoryName, prefix] = products[i % products.length];
    const supplier = suppliers[i % suppliers.length];
    const min = 4 + Math.floor(rand(i + 22) * 28);
    const qty = i % 53 === 0 ? 0 : i % 31 === 0 ? min : 12 + Math.floor(rand(i + 75) * 220);
    const price = 1.8 + rand(i + 105) * 260;

    materialRows.push({
      codice: `${TAG}-${prefix}-${String(i + 1).padStart(5, '0')}`,
      descrizione: `${baseName} ${String((i % 24) + 1).padStart(2, '0')} - uso reale cantiere`,
      marca: pick(['Wurth', 'Fischer', 'Gewiss', 'Viega', 'Bticino', 'Caleffi', 'Makita', 'Bosch', 'Beta', 'Usag'], i + 9),
      quantita: qty,
      categoria_id: categoryIdByName[categoryName] || null,
      unita_misura: pick(['pz', 'm', 'kg', 'cf', 'lt', 'rot'], i + 11),
      soglia_minima: min,
      stato_disponibilita: statusFor(qty, min),
      posizione_scaffale: `S${String((i % 18) + 1).padStart(2, '0')}-R${(i % 9) + 1}`,
      fornitore: supplier,
      note: `${TAG} - materiale realistico stress test`,
      prezzo_netto: Number(price.toFixed(2)),
    });
  }

  await upsertMany('materiali', materialRows, 'codice');

  if (DRY_RUN) {
    console.log('ℹ️ Dry-run completato. Per inserire davvero usa --apply');
    return;
  }

  const { data: dbMaterials, error: matErr } = await supabase
    .from('materiali')
    .select('*')
    .like('codice', `${TAG}-%`);

  if (matErr) throw matErr;

  const { data: dbUsers, error: userErr } = await supabase
    .from('utenti')
    .select('*')
    .like('username', 'stress.%');

  if (userErr) throw userErr;

  const invoices = [];
  const priceHistory = [];
  const movements = [];
  const notifications = [];
  const logs = [];
  const proposals = [];

  const weeks = 156;

  // 2 fatture ogni settimana per 3 anni = 312 fatture.
  for (let week = 0; week < weeks; week++) {
    for (let f = 0; f < 2; f++) {
      const supplier = suppliers[(week + f * 7) % suppliers.length];
      const secretary = dbUsers.find((u) => ['segretaria'].includes(u.ruolo)) || dbUsers[0];

      invoices.push({
        nome_file: `${TAG}_fattura_${String(week + 1).padStart(3, '0')}_${f + 1}.pdf`,
        nome_file_originale: `Fattura ${supplier} settimana ${week + 1} n.${f + 1}.pdf`,
        percorso_file: `stress-real/${String(week + 1).padStart(3, '0')}/fattura-${f + 1}.pdf`,
        bucket: 'fatture',
        dimensione_file: 180000 + Math.floor(rand(week + f + 40) * 1300000),
        tipo_file: 'application/pdf',
        utente_id: secretary?.id || null,
        utente_nome: secretary?.nome || 'Segreteria',
        stato_importazione: week % 17 === 0 && f === 1 ? 'completata_con_errori' : 'completata',
        numero_materiali_rilevati: 6 + Math.floor(rand(week + f + 1) * 30),
        numero_materiali_creati: week % 9 === 0 ? 1 : 0,
        numero_materiali_aggiornati: 4 + Math.floor(rand(week + f + 2) * 24),
        eventuali_errori: week % 17 === 0 && f === 1 ? 'Una voce controllata manualmente.' : null,
        fornitore: supplier,
        created_at: isoFromWeek(week, f * 2 + 1, 9 + f, 20),
      });
    }
  }

  // Storico prezzi: 6 rilevazioni per materiale distribuite nei 3 anni.
  dbMaterials.forEach((m, materialIndex) => {
    const base = Number(m.prezzo_netto || 10);

    for (let k = 0; k < 6; k++) {
      const drift = 1 + k * 0.035;
      const seasonal = 1 + (rand(materialIndex * 7 + k * 19) - 0.5) * 0.18;
      const net = Math.max(0.5, base * drift * seasonal);
      const quantity = 2 + Math.floor(rand(materialIndex + k + 55) * 80);
      const dayIndex = Math.floor((1095 / 6) * k) + Math.floor(rand(materialIndex + k) * 60);

      priceHistory.push({
        materiale_id: m.id,
        codice: m.codice,
        descrizione: m.descrizione,
        fornitore: m.fornitore || suppliers[materialIndex % suppliers.length],
        prezzo_netto: Number(net.toFixed(2)),
        quantita: quantity,
        origine: k % 2 === 0 ? 'fattura' : 'aggiornamento manuale',
        documento: `${TAG}-PREZZI-${String(materialIndex + 1).padStart(4, '0')}-${k + 1}`,
        utente_nome: pick(users, materialIndex + k)?.[0] || 'Sistema',
        data_registrazione: dateIsoFromIndex(dayIndex, 10, 15),
        created_at: dateIsoFromIndex(dayIndex, 10, 15),
      });
    }
  });

  // 20 utenti, 10 operazioni a utente, circa 10 movimenti a operazione = 2000 movimenti.
  dbUsers.slice(0, 20).forEach((person, userIndex) => {
    for (let operation = 0; operation < 10; operation++) {
      const client = pick(clients, userIndex * 71 + operation);
      const reason = pick(operationReasons, userIndex * 97 + operation);
      const dayIndex = Math.floor(rand(userIndex * 100 + operation * 13) * 1080);
      const operatorName = person.nome || person.username;
      const role = String(person.ruolo || '').toLowerCase();

      for (let movementIndex = 0; movementIndex < 10; movementIndex++) {
        const material = dbMaterials[
          (userIndex * 149 + operation * 31 + movementIndex * 11) % dbMaterials.length
        ];

        let type = 'uscita';
        if (['segretaria', 'magazziniere'].includes(role)) {
          type = movementIndex % 3 === 0 ? 'entrata' : movementIndex % 7 === 0 ? 'reintegro' : 'uscita';
        } else if (role === 'datore') {
          type = movementIndex % 5 === 0 ? 'rettifica' : 'uscita';
        } else {
          type = movementIndex % 6 === 0 ? 'reintegro' : movementIndex % 5 === 0 ? 'entrata' : 'uscita';
        }

        const qty =
          type === 'uscita'
            ? 1 + Math.floor(rand(userIndex + operation + movementIndex + 100) * 9)
            : 3 + Math.floor(rand(userIndex + operation + movementIndex + 200) * 34);

        movements.push({
          materiale_id: material.id,
          tipo_movimento: type,
          quantita: qty,
          motivo:
            type === 'uscita'
              ? `${reason} - uscita materiale`
              : type === 'entrata'
                ? `Carico da fornitore - ${material.fornitore || 'fornitore'}`
                : type === 'reintegro'
                  ? `${reason} - reintegro rientro materiale`
                  : `${reason} - rettifica inventariale`,
          note: `${TAG} - operazione reale ${operation + 1}/10 - movimento ${movementIndex + 1}/10`,
          utente_id: person.id,
          data_movimento: dateIsoFromIndex(
            dayIndex + movementIndex,
            7 + ((operation + movementIndex) % 10),
            (movementIndex * 6 + userIndex) % 60
          ),
          cliente_nome: type === 'uscita' ? client : null,
          autorizzato_da: type === 'uscita' ? 'Responsabile tecnico' : null,
          operatore_nome: operatorName,
          previous_qty: null,
          new_qty: null,
          fornitore: type === 'uscita' ? null : material.fornitore,
        });
      }

      logs.push({
        utente_id: person.id,
        entita: 'operazione',
        entita_id: null,
        azione: `${TAG} operazione completata`,
        descrizione: `${operatorName} ha completato ${reason} presso ${client}.`,
        created_at: dateIsoFromIndex(dayIndex + 1, 18, 0),
      });
    }
  });

  dbMaterials
    .filter((m) => Number(m.quantita || 0) <= Number(m.soglia_minima || 0))
    .slice(0, 80)
    .forEach((m, i) => {
      notifications.push({
        materiale_id: m.id,
        tipo: Number(m.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
        messaggio: `${TAG} - materiale ${m.codice} ${Number(m.quantita || 0) <= 0 ? 'esaurito' : 'sotto soglia'}`,
        letta: i % 4 === 0,
        created_at: dateIsoFromIndex(1030 + (i % 50), 9, 15),
      });
    });

  for (let i = 0; i < 120; i++) {
    const person = dbUsers[i % dbUsers.length];

    logs.push({
      utente_id: person?.id || null,
      entita: i % 3 === 0 ? 'materiali' : i % 3 === 1 ? 'fatture_importate' : 'movimenti',
      entita_id: null,
      azione: `${TAG} attività amministrativa`,
      descrizione: `Controllo operativo n.${i + 1}: verifica magazzino, fatture e movimenti.`,
      created_at: dateIsoFromIndex(Math.floor(rand(i + 700) * 1080), 11, 20),
    });
  }

  for (let i = 0; i < 24; i++) {
    const supplier = suppliers[i % suppliers.length];
    proposals.push({
      numero: `${TAG}-PO-${String(i + 1).padStart(4, '0')}`,
      fornitore: supplier,
      stato: i % 5 === 0 ? 'completata' : i % 4 === 0 ? 'inviata' : 'aperta',
      note: `${TAG} proposta riordino realistica`,
      utente_id: dbUsers[i % dbUsers.length]?.id || null,
      utente_nome: dbUsers[i % dbUsers.length]?.nome || 'Sistema',
      totale_righe: 0,
      totale_quantita: 0,
      updated_at: dateIsoFromIndex(900 + i * 5, 14, 0),
      created_at: dateIsoFromIndex(900 + i * 5, 14, 0),
    });
  }

  await insertMany('fatture_importate', invoices);
  await insertMany('storico_prezzi', priceHistory, 1000);
  await insertMany('movimenti', movements, 1000);
  await insertMany('notifiche', notifications);
  await insertMany('log_modifiche', logs);
  await insertMany('proposte_ordine', proposals);

  const { data: dbProposals, error: propErr } = await supabase
    .from('proposte_ordine')
    .select('*')
    .like('numero', `${TAG}-%`);

  if (propErr) throw propErr;

  const proposalRows = [];

  for (const proposal of dbProposals || []) {
    const subset =
      dbMaterials.filter((m) => m.fornitore === proposal.fornitore).slice(0, 10) ||
      dbMaterials.slice(0, 10);

    let totalQty = 0;

    subset.forEach((m, idx) => {
      const suggested = Math.max(Number(m.soglia_minima || 5) * 2, 12 + idx);
      totalQty += suggested;

      proposalRows.push({
        proposta_id: proposal.id,
        materiale_id: m.id,
        codice: m.codice,
        descrizione: m.descrizione,
        marca: m.marca,
        categoria_id: m.categoria_id,
        unita_misura: m.unita_misura,
        quantita_attuale: m.quantita,
        soglia_minima: m.soglia_minima,
        quantita_consigliata: suggested,
        fornitore: proposal.fornitore,
        posizione: m.posizione_scaffale,
        note: `${TAG} riga proposta realistica`,
      });
    });

    await supabase
      .from('proposte_ordine')
      .update({ totale_quantita: totalQty, totale_righe: subset.length })
      .eq('id', proposal.id);
  }

  await insertMany('righe_proposta_ordine', proposalRows);

  console.log('🎉 Dataset stress realistico completato.');
  console.log({
    tag: TAG,
    utenti: userRows.length,
    fornitori: suppliers.length,
    categorie: categoryRows.length,
    materiali: materialRows.length,
    fatture: invoices.length,
    storicoPrezzi: priceHistory.length,
    movimenti: movements.length,
    notifiche: notifications.length,
    log: logs.length,
    proposte: proposals.length,
    righeProposte: proposalRows.length,
    passwordUtentiStress: PASSWORD,
  });
}

main().catch((error) => {
  console.error('❌ Seed fallito:', error);
  process.exit(1);
});

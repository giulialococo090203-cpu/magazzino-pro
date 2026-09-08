import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);

  for (const line of lines) {
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

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY_RUN = args.has('--dry-run') || !APPLY;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Mancano SUPABASE_URL / SUPABASE_KEY. Controlla .env o variabili ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO = 'DEMO-3Y';
const OPERATOR = 'Demo WorkSpace';
const years = [2024, 2025, 2026];

const categories = [
  ['11111111-1111-4111-8111-111111111001', 'Idraulica Demo', 'Tubi, raccordi, valvole e componenti idraulici'],
  ['11111111-1111-4111-8111-111111111002', 'Elettrico Demo', 'Cavi, interruttori, quadri e materiale elettrico'],
  ['11111111-1111-4111-8111-111111111003', 'Edilizia Demo', 'Malte, cementi, fissaggi e materiali edili'],
  ['11111111-1111-4111-8111-111111111004', 'Ferramenta Demo', 'Viti, bulloni, staffe, utensili e minuteria'],
  ['11111111-1111-4111-8111-111111111005', 'Climatizzazione Demo', 'Componenti HVAC, filtri e accessori impianto'],
  ['11111111-1111-4111-8111-111111111006', 'Sicurezza Demo', 'DPI, cartellonistica e dispositivi di protezione'],
  ['11111111-1111-4111-8111-111111111007', 'Consumo Demo', 'Materiale di consumo operativo e ricambi rapidi'],
  ['11111111-1111-4111-8111-111111111008', 'Ricambi Tecnici Demo', 'Ricambi per manutenzioni e assistenza tecnica'],
];

const suppliers = [
  'TermoNord S.r.l.',
  'EdilPro Supply',
  'IdroService Italia',
  'ElettroLinea Group',
  'Ferramenta Centrale',
  'HVAC Components',
  'Sicurezza & DPI',
  'Ricambi Express',
  'Magazzini Industriali',
  'TecnoForniture',
];

const productNames = [
  ['Tubo multistrato', 'Idraulica Demo', 'IDR'],
  ['Raccordo pressfitting', 'Idraulica Demo', 'IDR'],
  ['Valvola a sfera', 'Idraulica Demo', 'IDR'],
  ['Cavo FG16', 'Elettrico Demo', 'ELT'],
  ['Interruttore magnetotermico', 'Elettrico Demo', 'ELT'],
  ['Scatola derivazione', 'Elettrico Demo', 'ELT'],
  ['Sacco malta premiscelata', 'Edilizia Demo', 'EDI'],
  ['Tassello nylon', 'Edilizia Demo', 'EDI'],
  ['Schiuma poliuretanica', 'Edilizia Demo', 'EDI'],
  ['Vite autofilettante', 'Ferramenta Demo', 'FER'],
  ['Bullone zincato', 'Ferramenta Demo', 'FER'],
  ['Staffa angolare', 'Ferramenta Demo', 'FER'],
  ['Filtro split', 'Climatizzazione Demo', 'CLI'],
  ['Gas refrigerante accessorio', 'Climatizzazione Demo', 'CLI'],
  ['Supporto unità esterna', 'Climatizzazione Demo', 'CLI'],
  ['Guanti antitaglio', 'Sicurezza Demo', 'SIC'],
  ['Occhiali protettivi', 'Sicurezza Demo', 'SIC'],
  ['Nastro segnaletico', 'Sicurezza Demo', 'SIC'],
  ['Nastro isolante', 'Consumo Demo', 'CON'],
  ['Silicone neutro', 'Consumo Demo', 'CON'],
  ['Cartuccia sigillante', 'Consumo Demo', 'CON'],
  ['Pressostato ricambio', 'Ricambi Tecnici Demo', 'RIC'],
  ['Sonda temperatura', 'Ricambi Tecnici Demo', 'RIC'],
  ['Scheda controllo', 'Ricambi Tecnici Demo', 'RIC'],
];

const categoryCodeByName = Object.fromEntries(categories.map(([code, name]) => [name, code]));

function rand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick(arr, seed) {
  return arr[Math.floor(rand(seed) * arr.length) % arr.length];
}

function dateIso(year, month, day, hour = 9, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
}

function statusFor(qty, min) {
  if (qty <= 0) return 'esaurito';
  if (qty <= min) return 'sotto_soglia';
  return 'disponibile';
}

async function insertMany(table, rows, chunkSize = 500) {
  if (rows.length === 0) return;
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
  if (rows.length === 0) return;
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
  console.log(DRY_RUN ? '🧪 DRY RUN dati demo 3 anni' : '🚀 APPLICO dati demo 3 anni');

  const categoryRows = categories.map(([id, nome, descrizione]) => ({
    id,
    nome,
    descrizione: `${descrizione} (${DEMO})`,
  }));

  const materialRows = [];
  for (let i = 0; i < 240; i++) {
    const base = productNames[i % productNames.length];
    const [, categoryName, prefix] = base;
    const code = `${DEMO}-${prefix}-${String(i + 1).padStart(4, '0')}`;
    const min = 5 + Math.floor(rand(i + 21) * 25);
    const qty = 2 + Math.floor(rand(i + 73) * 180);

    materialRows.push({
      codice: code,
      descrizione: `${base[0]} ${String((i % 18) + 1).padStart(2, '0')} - serie demo`,
      marca: pick(['Wurth', 'Fischer', 'Gewiss', 'Viega', 'Bticino', 'Caleffi', 'Makita', 'Bosch'], i + 11),
      quantita: qty,
      categoria_id: categoryCodeByName[categoryName],
      unita_misura: pick(['pz', 'm', 'kg', 'cf', 'lt'], i + 13),
      soglia_minima: min,
      stato_disponibilita: statusFor(qty, min),
      posizione_scaffale: `A${(i % 12) + 1}-S${(i % 8) + 1}`,
      fornitore: pick(suppliers, i + 17),
      note: `${DEMO} - materiale dimostrativo per test triennale`,
      prezzo_netto: Number((2 + rand(i + 19) * 240).toFixed(2)),
    });
  }

  await upsertMany('categorie', categoryRows, 'id');
  await upsertMany('materiali', materialRows, 'codice');

  if (!APPLY) {
    console.log('ℹ️ Dry-run completato. Per inserire davvero usa --apply');
    return;
  }

  const { data: dbMaterials, error: matErr } = await supabase
    .from('materiali')
    .select('*')
    .like('codice', `${DEMO}-%`);

  if (matErr) throw matErr;

  const movements = [];
  const invoices = [];
  const notifications = [];
  const logs = [];

  const workers = Array.from({ length: 20 }, (_, i) => ({
    name: `Operaio Demo ${String(i + 1).padStart(2, '0')}`,
    role: 'operaio',
  }));

  const secretaries = Array.from({ length: 4 }, (_, i) => ({
    name: `Segretaria Demo ${String(i + 1).padStart(2, '0')}`,
    role: 'segretaria',
  }));

  const staff = [...workers, ...secretaries];

  const clients = [
    'Cantiere Rossi',
    'Condominio Aurora',
    'Impianto Alfa',
    'Hotel Centrale',
    'Stabilimento Nord',
    'Residenza Verdi',
    'Cliente Demo Industriale',
    'Manutenzione Programmata',
  ];

  const operationTypes = [
    'Installazione impianto',
    'Manutenzione ordinaria',
    'Intervento urgente',
    'Ripristino materiale',
    'Allestimento cantiere',
    'Controllo tecnico',
    'Rifornimento squadra',
    'Chiusura commessa',
  ];

  // Fatture realistiche: circa 6 al mese per 3 anni = 216 fatture.
  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      for (let f = 0; f < 6; f++) {
        const monthlySupplier = pick(suppliers, year + month + f * 17);
        const secretary = secretaries[(year + month + f) % secretaries.length];

        invoices.push({
          nome_file: `${DEMO}_fattura_${year}_${String(month).padStart(2, '0')}_${String(f + 1).padStart(2, '0')}.pdf`,
          nome_file_originale: `Fattura demo ${monthlySupplier} ${year}-${String(month).padStart(2, '0')}-${String(f + 1).padStart(2, '0')}.pdf`,
          percorso_file: `demo/${year}/${String(month).padStart(2, '0')}/fattura-demo-${f + 1}.pdf`,
          bucket: 'fatture',
          dimensione_file: 125000 + Math.floor(rand(year + month + f) * 900000),
          tipo_file: 'application/pdf',
          utente_id: null,
          utente_nome: secretary.name,
          stato_importazione: f % 13 === 0 ? 'completata_con_errori' : 'completata',
          numero_materiali_rilevati: 8 + Math.floor(rand(year + month + f + 2) * 24),
          numero_materiali_creati: f % 5 === 0 ? 1 + Math.floor(rand(year + month + f + 3) * 4) : 0,
          numero_materiali_aggiornati: 6 + Math.floor(rand(year + month + f + 4) * 18),
          eventuali_errori: f % 13 === 0 ? 'Una riga verificata manualmente dalla segreteria.' : null,
          fornitore: monthlySupplier,
          created_at: dateIso(year, month, 3 + ((f * 4) % 24), 9 + (f % 6), 20),
        });
      }
    }
  }

  // Test aziendale: 24 persone totali, 15 operazioni ciascuna, 10 movimenti per operazione.
  // Totale previsto: 24 * 15 * 10 = 3600 movimenti.
  staff.forEach((person, personIndex) => {
    for (let operation = 0; operation < 15; operation++) {
      const year = years[(personIndex + operation) % years.length];
      const month = ((personIndex * 2 + operation) % 12) + 1;
      const day = 2 + ((personIndex + operation * 3) % 25);
      const client = pick(clients, personIndex * 101 + operation);
      const operationType = pick(operationTypes, personIndex * 37 + operation);

      for (let movementIndex = 0; movementIndex < 10; movementIndex++) {
        const material = dbMaterials[
          (personIndex * 211 + operation * 31 + movementIndex * 7) % dbMaterials.length
        ];

        let type = 'uscita';

        if (person.role === 'segretaria') {
          type = movementIndex % 4 === 0 ? 'entrata' : movementIndex % 7 === 0 ? 'reintegro' : 'uscita';
        } else {
          type = movementIndex % 6 === 0 ? 'reintegro' : movementIndex % 5 === 0 ? 'entrata' : 'uscita';
        }

        const qty =
          type === 'uscita'
            ? 1 + Math.floor(rand(personIndex + operation + movementIndex + 100) * 10)
            : 4 + Math.floor(rand(personIndex + operation + movementIndex + 200) * 32);

        movements.push({
          materiale_id: material.id,
          tipo_movimento: type,
          quantita: qty,
          motivo:
            type === 'uscita'
              ? `${operationType} - prelievo materiale`
              : type === 'reintegro'
                ? `${operationType} - reintegro operativo`
                : `${operationType} - carico da fornitura`,
          note: `${DEMO} - azienda 20 operai + segreteria - operazione ${operation + 1}/15 - movimento ${movementIndex + 1}/10`,
          utente_id: null,
          data_movimento: dateIso(
            year,
            month,
            day,
            7 + ((operation + movementIndex) % 10),
            (movementIndex * 6 + personIndex) % 60
          ),
          cliente_nome: type === 'uscita' ? client : null,
          autorizzato_da: type === 'uscita' ? 'Responsabile tecnico demo' : null,
          operatore_nome: person.name,
          previous_qty: null,
          new_qty: null,
          fornitore: type === 'uscita' ? null : material.fornitore,
        });
      }

      logs.push({
        utente_id: null,
        entita: 'operazione',
        entita_id: null,
        azione: `${DEMO} operazione aziendale`,
        descrizione: `${person.name} ha completato operazione demo ${operation + 1}/15: ${operationType} presso ${client}.`,
        created_at: dateIso(year, month, day, 18, 0),
      });
    }
  });

  // Log aggiuntivi di segreteria: caricamento fatture, verifiche, controlli.
  secretaries.forEach((person, personIndex) => {
    for (let i = 0; i < 36; i++) {
      const year = years[i % years.length];
      const month = (i % 12) + 1;

      logs.push({
        utente_id: null,
        entita: i % 2 === 0 ? 'fatture_importate' : 'magazzino',
        entita_id: null,
        azione: `${DEMO} attività segreteria`,
        descrizione: `${person.name} ha verificato documenti, fatture e movimenti nel periodo ${year}-${String(month).padStart(2, '0')}.`,
        created_at: dateIso(year, month, 10 + (personIndex % 10), 12, 30),
      });
    }
  });

  dbMaterials.slice(0, 36).forEach((m, i) => {
    notifications.push({
      materiale_id: m.id,
      tipo: i % 2 === 0 ? 'sotto_soglia' : 'riordino',
      messaggio: `${DEMO} - controllo scorta per ${m.codice}`,
      letta: i % 3 === 0,
      created_at: dateIso(2026, (i % 12) + 1, 12, 9, 15),
    });
  });

  for (let i = 0; i < 90; i++) {
    logs.push({
      utente_id: null,
      entita: i % 2 === 0 ? 'materiali' : 'movimenti',
      entita_id: null,
      azione: `${DEMO} attività operativa`,
      descrizione: `Operazione dimostrativa ${i + 1} per storico amministrativo triennale.`,
      created_at: dateIso(2024 + (i % 3), (i % 12) + 1, 8 + (i % 18), 11, 20),
    });
  }

  await insertMany('fatture_importate', invoices);
  await insertMany('movimenti', movements);
  await insertMany('notifiche', notifications);
  await insertMany('log_modifiche', logs);

  const proposals = [];
  const proposalRows = [];
  for (let i = 0; i < 18; i++) {
    const supplier = suppliers[i % suppliers.length];
    proposals.push({
      numero: `${DEMO}-PO-${2024 + (i % 3)}-${String(i + 1).padStart(3, '0')}`,
      fornitore: supplier,
      stato: i % 4 === 0 ? 'chiusa' : 'aperta',
      note: `${DEMO} proposta riordino dimostrativa`,
      utente_id: null,
      utente_nome: OPERATOR,
      totale_righe: 8,
      totale_quantita: 0,
      updated_at: dateIso(2024 + (i % 3), (i % 12) + 1, 18, 14, 0),
      created_at: dateIso(2024 + (i % 3), (i % 12) + 1, 18, 14, 0),
    });
  }

  await insertMany('proposte_ordine', proposals);

  const { data: dbProposals, error: propErr } = await supabase
    .from('proposte_ordine')
    .select('*')
    .like('numero', `${DEMO}-%`);

  if (propErr) throw propErr;

  for (const proposal of dbProposals) {
    const subset = dbMaterials.filter((m) => m.fornitore === proposal.fornitore).slice(0, 8);
    const chosen = subset.length ? subset : dbMaterials.slice(0, 8);

    let totalQty = 0;
    chosen.forEach((m, idx) => {
      const suggested = Math.max(Number(m.soglia_minima || 5) * 2, 10 + idx);
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
        note: `${DEMO} riga proposta`,
      });
    });

    await supabase
      .from('proposte_ordine')
      .update({ totale_quantita: totalQty, totale_righe: chosen.length })
      .eq('id', proposal.id);
  }

  await insertMany('righe_proposta_ordine', proposalRows);

  console.log('ℹ️ Inventario fisico demo saltato: tabella protetta da RLS.');

  console.log('🎉 Dataset demo triennale completato.');
  console.log({
    categorie: categoryRows.length,
    materiali: materialRows.length,
    fatture: invoices.length,
    movimenti: movements.length,
    notifiche: notifications.length,
    log: logs.length,
    proposte: proposals.length,
    righeProposte: proposalRows.length,
    sessioniInventario: 0,
    righeInventario: 0,
  });
}

main().catch((error) => {
  console.error('❌ Seed fallito:', error);
  process.exit(1);
});

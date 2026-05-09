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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TAG = 'STRESS-MASSIVE';
const TOTAL_TO_ADD = Number(process.argv[2] || 5000);
const CHUNK_SIZE = 500;

const brands = [
  'Fischer',
  'Wurth',
  'Viega',
  'Bticino',
  'Gewiss',
  'Caleffi',
  'Bosch',
  'Makita',
  'Fantini Cosmi',
  'Honeywell',
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
  'Makita Tools',
  'Caleffi Partner',
  'Bticino Distribuzione',
  'Viega Italia',
  'Wurth Forniture',
  'Bosch Professional',
  'Fischer Edilizia',
  'Honeywell Control',
  'Fantini Cosmi Service',
  'Centro Ricambi Nord',
];

const productBases = [
  ['IDR', 'Tubo multistrato'],
  ['IDR', 'Raccordo ottone'],
  ['IDR', 'Valvola a sfera'],
  ['ELT', 'Cavo FG16'],
  ['ELT', 'Interruttore magnetotermico'],
  ['ELT', 'Scatola derivazione'],
  ['CLI', 'Filtro split'],
  ['CLI', 'Supporto unità esterna'],
  ['CLI', 'Termostato sicurezza'],
  ['FER', 'Bullone zincato'],
  ['FER', 'Vite autofilettante'],
  ['FER', 'Staffa angolare'],
  ['CON', 'Silicone neutro'],
  ['CON', 'Cartuccia sigillante'],
  ['RIC', 'Pressostato ricambio'],
  ['RIC', 'Sonda temperatura'],
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function statusFor(qty, min) {
  if (qty <= 0) return 'esaurito';
  if (qty <= min) return 'sotto_soglia';
  return 'disponibile';
}

async function insertMany(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const { error } = await supabase.from(table).insert(chunk);

    if (error) {
      console.error(`❌ Errore insert ${table}, chunk ${i}-${i + chunk.length}:`, error);
      throw error;
    }

    console.log(`✅ Inseriti ${i + chunk.length}/${rows.length}`);
  }
}

async function main() {
  console.log(`🚀 Aggiungo ${TOTAL_TO_ADD} materiali extra per stress test...`);

  const { data: categories, error: catError } = await supabase
    .from('categorie')
    .select('id,nome')
    .order('nome');

  if (catError) throw catError;

  if (!categories || categories.length === 0) {
    throw new Error('Nessuna categoria trovata. Prima devi avere categorie nel DB.');
  }

  const { count: existingCount, error: countError } = await supabase
    .from('materiali')
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;

  const startIndex = Number(existingCount || 0) + 1;

  const rows = [];

  for (let i = 0; i < TOTAL_TO_ADD; i++) {
    const n = startIndex + i;
    const [prefix, baseName] = pick(productBases, i);
    const category = pick(categories, i);
    const qty = i % 37 === 0 ? 0 : 3 + ((i * 17) % 420);
    const min = 5 + ((i * 11) % 80);

    rows.push({
      codice: `${TAG}-${prefix}-${String(n).padStart(6, '0')}`,
      descrizione: `${baseName} MASSIVE ${String(n).padStart(6, '0')} - stress limite materiali`,
      marca: pick(brands, i),
      quantita: qty,
      categoria_id: category.id,
      unita_misura: pick(['pz', 'm', 'kg', 'cf', 'lt'], i),
      soglia_minima: min,
      stato_disponibilita: statusFor(qty, min),
      posizione_scaffale: `M${String((i % 80) + 1).padStart(2, '0')}-R${(i % 12) + 1}`,
      fornitore: pick(suppliers, i),
      note: `${TAG} - materiale extra per test limite Supabase`,
      prezzo_netto: Number((1.5 + ((i * 13) % 900) / 3).toFixed(2)),
    });
  }

  await insertMany('materiali', rows);

  const { count: finalCount, error: finalError } = await supabase
    .from('materiali')
    .select('*', { count: 'exact', head: true });

  if (finalError) throw finalError;

  console.log('🎉 Inserimento completato.');
  console.log(`Materiali prima: ${existingCount}`);
  console.log(`Materiali aggiunti: ${TOTAL_TO_ADD}`);
  console.log(`Materiali totali ora: ${finalCount}`);
}

main().catch((error) => {
  console.error('❌ Inserimento materiali massivi fallito:', error);
  process.exit(1);
});

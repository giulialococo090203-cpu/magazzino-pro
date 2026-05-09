import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;

  const raw = fs.readFileSync(path, 'utf8');

  for (const line of raw.split('\n')) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;

    const idx = clean.indexOf('=');
    if (idx === -1) continue;

    const key = clean.slice(0, idx).trim();
    const value = clean.slice(idx + 1).trim().replace(/^["']|["']$/g, '');

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variabili Supabase mancanti.');
  process.exit(1);
}

if (process.env.RESET_CONFIRM !== 'YES') {
  console.error('❌ Reset bloccato per sicurezza.');
  console.error('Esegui così: RESET_CONFIRM=YES node scripts/reset-app-virgin.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tablesInDeleteOrder = [
  'righe_inventario',
  'sessioni_inventario',
  'righe_proposta_ordine',
  'proposte_ordine',
  'storico_prezzi',
  'fatture_importate',
  'log_modifiche',
  'notifiche',
  'movimenti',
  'materiali',
  'categorie',
];

async function countTable(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) return `ERRORE - ${error.message}`;
  return count ?? 0;
}

async function deleteTable(table) {
  const before = await countTable(table);

  const { error } = await supabase
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
    return false;
  }

  const after = await countTable(table);
  console.log(`✅ ${table}: ${before} → ${after}`);
  return true;
}

async function clearStorageBucket(bucketName) {
  console.log(`\n🧹 Pulizia bucket storage: ${bucketName}`);

  const { data, error } = await supabase.storage.from(bucketName).list('', {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    console.warn(`⚠️ Bucket ${bucketName} non pulito: ${error.message}`);
    return;
  }

  const files = (data || [])
    .filter((item) => item?.name)
    .map((item) => item.name);

  if (files.length === 0) {
    console.log(`✅ Bucket ${bucketName}: nessun file`);
    return;
  }

  const { error: removeError } = await supabase.storage.from(bucketName).remove(files);

  if (removeError) {
    console.warn(`⚠️ Errore pulizia bucket ${bucketName}: ${removeError.message}`);
  } else {
    console.log(`✅ Bucket ${bucketName}: eliminati ${files.length} file`);
  }
}

console.log('🚨 RESET APP VERGINE');
console.log('👤 Utenti mantenuti');
console.log('');

console.log('===== CONTEGGI PRIMA =====');
for (const table of [...tablesInDeleteOrder, 'utenti']) {
  console.log(`${table}: ${await countTable(table)}`);
}

console.log('\n===== CANCELLAZIONE DATI =====');
for (const table of tablesInDeleteOrder) {
  await deleteTable(table);
}

if (process.env.CLEAR_STORAGE !== 'NO') {
  await clearStorageBucket('fatture');
}

console.log('\n===== CONTEGGI DOPO =====');
for (const table of [...tablesInDeleteOrder, 'utenti']) {
  console.log(`${table}: ${await countTable(table)}`);
}

console.log('\n✅ Reset completato.');

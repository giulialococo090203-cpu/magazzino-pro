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

async function countTable(table, filterColumn = null, filterValue = null) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });

  if (filterColumn && filterValue) {
    query = query.ilike(filterColumn, filterValue);
  }

  const { count, error } = await query;

  if (error) {
    return { table, count: null, error: error.message };
  }

  return { table, count, error: null };
}

const checks = [
  ['categorie', 'nome', 'TEST_2026_%'],
  ['materiali', 'codice', 'TEST_2026_%'],
  ['movimenti', 'motivo', '%TEST_2026_%'],
  ['storico_prezzi', 'codice', 'TEST_2026_%'],
  ['fatture_importate', 'nome_file', 'TEST_2026_%'],
  ['notifiche', 'messaggio', '%TEST_2026_%'],
];

console.log('📊 Conteggio dati TEST_2026_ già presenti...\n');

for (const [table, col, value] of checks) {
  const result = await countTable(table, col, value);

  if (result.error) {
    console.log(`⚠️ ${table}: ${result.error}`);
  } else {
    console.log(`${table}: ${result.count}`);
  }
}

console.log('\n📊 Conteggio totale tabelle principali...\n');

for (const table of ['categorie', 'materiali', 'movimenti', 'storico_prezzi', 'fatture_importate', 'notifiche', 'utenti']) {
  const result = await countTable(table);

  if (result.error) {
    console.log(`⚠️ ${table}: ${result.error}`);
  } else {
    console.log(`${table}: ${result.count}`);
  }
}

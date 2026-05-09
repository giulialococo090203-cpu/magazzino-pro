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

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variabili Supabase mancanti. Controlla .env / .env.local');
  console.error('Servono VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY oppure equivalenti.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
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
  'utenti',
];

for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`${table}: ERRORE - ${error.message}`);
  } else {
    console.log(`${table}: ${count}`);
  }
}

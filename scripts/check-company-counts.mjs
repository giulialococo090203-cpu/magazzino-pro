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
  console.error('❌ Mancano credenziali Supabase.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const companyId = process.argv[2] || 'cl_thermoservice';

const tables = [
  'categorie',
  'materiali',
  'movimenti',
  'notifiche',
  'log_modifiche',
  'fatture_importate',
  'storico_prezzi',
  'proposte_ordine',
  'righe_proposta_ordine',
  'sessioni_inventario',
  'righe_inventario',
  'utenti',
  'impostazioni',
];

async function main() {
  console.log(`🏢 Conteggi azienda: ${companyId}`);

  const { data: aziende, error: aziendeError } = await supabase
    .from('aziende')
    .select('*')
    .eq('id', companyId);

  if (aziendeError) throw aziendeError;

  console.table(aziende);

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('azienda_id', companyId);

    if (error) {
      console.log(`${table}: ERRORE - ${error.message}`);
    } else {
      console.log(`${table}: ${count}`);
    }
  }
}

main().catch((error) => {
  console.error('❌ Verifica fallita:', error);
  process.exit(1);
});

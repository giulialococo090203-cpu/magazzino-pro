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
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Mancano SUPABASE_URL / SUPABASE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TAG = 'STRESS-3Y-REAL';

async function remove(table, queryBuilder) {
  const { error } = await queryBuilder;

  if (error) {
    console.warn(`⚠️ Non pulito ${table}: ${error.message}`);
    return;
  }

  console.log(`✅ Pulito ${table}`);
}

async function main() {
  console.log('🧹 Pulizia dataset stress realistico...');

  await remove(
    'righe_proposta_ordine',
    supabase.from('righe_proposta_ordine').delete().like('note', `${TAG}%`)
  );

  await remove(
    'proposte_ordine',
    supabase.from('proposte_ordine').delete().like('numero', `${TAG}-%`)
  );

  await remove(
    'storico_prezzi',
    supabase.from('storico_prezzi').delete().like('documento', `${TAG}%`)
  );

  await remove(
    'notifiche',
    supabase.from('notifiche').delete().like('messaggio', `${TAG}%`)
  );

  await remove(
    'log_modifiche',
    supabase.from('log_modifiche').delete().like('azione', `${TAG}%`)
  );

  await remove(
    'movimenti',
    supabase.from('movimenti').delete().like('note', `${TAG}%`)
  );

  await remove(
    'fatture_importate',
    supabase.from('fatture_importate').delete().like('nome_file', `${TAG}%`)
  );

  await remove(
    'materiali',
    supabase.from('materiali').delete().like('codice', `${TAG}-%`)
  );

  await remove(
    'categorie',
    supabase.from('categorie').delete().like('descrizione', `%${TAG}%`)
  );

  await remove(
    'utenti',
    supabase.from('utenti').delete().like('username', 'stress.%')
  );

  console.log('✅ Pulizia completata.');
}

main().catch((error) => {
  console.error('❌ Pulizia fallita:', error);
  process.exit(1);
});

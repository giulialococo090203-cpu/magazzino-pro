import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function readEnvFile(path = '.env') {
  if (!fs.existsSync(path)) return {};
  const raw = fs.readFileSync(path, 'utf8');
  const env = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }

  return env;
}

const env = { ...readEnvFile('.env'), ...process.env };
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function inspect(table) {
  const { data, error } = await supabase.from(table).select('*').limit(3);

  if (error) {
    console.log(`\n${table}: ERRORE -> ${error.message}`);
    return;
  }

  console.log(`\n=== ${table} ===`);
  console.log('Righe:', data?.length || 0);

  if (data && data.length > 0) {
    console.log('Colonne:', Object.keys(data[0]).join(', '));
    console.log(JSON.stringify(data, null, 2));
  }
}

await inspect('aziende');
await inspect('companies');
await inspect('utenti');
await inspect('materiali');
await inspect('categorie');

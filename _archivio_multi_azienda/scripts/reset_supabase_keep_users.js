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

async function emptyTableByCreatedAt(table) {
  const { error } = await supabase
    .from(table)
    .delete()
    .gte('created_at', '1900-01-01');

  if (error) {
    console.error(`❌ Errore svuotando ${table}:`, error.message);
    return false;
  }

  console.log(`✅ Svuotata tabella: ${table}`);
  return true;
}

async function emptyImpostazioni() {
  // La tabella impostazioni non ha id. Proviamo prima con chiave/key.
  const attempts = [
    ['key', ''],
    ['chiave', ''],
    ['nome', ''],
    ['created_at', '1900-01-01'],
  ];

  for (const [column, value] of attempts) {
    const query = supabase.from('impostazioni').delete();

    const { error } =
      column === 'created_at'
        ? await query.gte(column, value)
        : await query.neq(column, value);

    if (!error) {
      console.log(`✅ Svuotata tabella: impostazioni`);
      return true;
    }
  }

  console.error('❌ Errore svuotando impostazioni: struttura colonne non riconosciuta');
  return false;
}

console.log('⚠️ Reset Supabase mantenendo utenti.');
console.log('NON verrà toccata la tabella: utenti');

await emptyTableByCreatedAt('notifiche');
await emptyTableByCreatedAt('movimenti');
await emptyTableByCreatedAt('materiali');
await emptyTableByCreatedAt('categorie');
await emptyImpostazioni();

console.log('✅ Reset completato. Tabella utenti NON toccata.');

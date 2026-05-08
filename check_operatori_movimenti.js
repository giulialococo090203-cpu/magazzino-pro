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

const supabase = createClient(
  readEnv('VITE_SUPABASE_URL'),
  readEnv('VITE_SUPABASE_ANON_KEY')
);

const { data, error } = await supabase
  .from('movimenti')
  .select('operatore_nome')
  .ilike('motivo', '%TEST_2026_%')
  .not('operatore_nome', 'is', null)
  .limit(5000);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const names = [...new Set(data.map((row) => row.operatore_nome).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'it'));

console.log(names.join('\n'));

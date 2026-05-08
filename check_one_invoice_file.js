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

const { data: invoice, error } = await supabase
  .from('fatture_importate')
  .select('id, nome_file, nome_file_originale, percorso_file, bucket')
  .ilike('nome_file', 'TEST_2026_%')
  .neq('percorso_file', 'test_2026_fatture/fattura_246.pdf')
  .limit(1)
  .single();

if (error) {
  console.error('Errore lettura fattura:', error.message);
  process.exit(1);
}

console.log('Fattura trovata:');
console.log(invoice);

const bucket = invoice.bucket || 'fatture';
const path = invoice.percorso_file;

const { data, error: downloadError } = await supabase.storage
  .from(bucket)
  .download(path);

if (downloadError) {
  console.error('❌ Download test fallito:', downloadError.message);
  process.exit(1);
}

console.log('✅ Download test riuscito.');
console.log('Bucket:', bucket);
console.log('Path:', path);
console.log('Dimensione file:', data.size);

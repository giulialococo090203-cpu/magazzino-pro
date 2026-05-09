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

if (process.env.CLEAR_STORAGE_CONFIRM !== 'YES') {
  console.error('Bloccato per sicurezza.');
  console.error('Esegui: CLEAR_STORAGE_CONFIRM=YES node scripts/clear-storage-all.mjs');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function listRecursive(bucket, prefix = '') {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    console.warn(`${bucket}: ${error.message}`);
    return [];
  }

  const files = [];

  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.metadata) {
      files.push(fullPath);
    } else {
      files.push(...await listRecursive(bucket, fullPath));
    }
  }

  return files;
}

const { data: buckets, error } = await supabase.storage.listBuckets();

if (error) {
  console.error('Errore buckets:', error.message);
  process.exit(1);
}

for (const bucket of buckets || []) {
  console.log(`\nPulizia bucket: ${bucket.name}`);

  const files = await listRecursive(bucket.name);

  if (files.length === 0) {
    console.log('Nessun file.');
    continue;
  }

  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    const { error: removeError } = await supabase.storage.from(bucket.name).remove(chunk);

    if (removeError) {
      console.warn(`Errore eliminazione: ${removeError.message}`);
    } else {
      console.log(`Eliminati ${chunk.length} file`);
    }
  }
}

console.log('\nPulizia storage completata.');

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
    console.log(`${bucket}: ERRORE - ${error.message}`);
    return [];
  }

  const files = [];

  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.metadata) {
      files.push({
        path: fullPath,
        size: Number(item.metadata.size || 0),
      });
    } else {
      const nested = await listRecursive(bucket, fullPath);
      files.push(...nested);
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
  const files = await listRecursive(bucket.name);
  const total = files.reduce((sum, file) => sum + file.size, 0);

  console.log(`${bucket.name}: ${files.length} file · ${(total / 1024 / 1024).toFixed(2)} MB`);

  files.slice(0, 20).forEach((file) => {
    console.log(`  - ${file.path} · ${(file.size / 1024 / 1024).toFixed(2)} MB`);
  });

  if (files.length > 20) {
    console.log(`  ... altri ${files.length - 20} file`);
  }
}

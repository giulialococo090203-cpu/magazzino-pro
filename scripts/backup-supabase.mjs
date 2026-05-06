// ============================================================
// BACKUP SUPABASE - MagazzinoPro
// Esporta le tabelle principali in file JSON locali.
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
  console.error('Esempio uso:');
  console.error('VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." node scripts/backup-supabase.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = [
  'categorie',
  'materiali',
  'movimenti',
  'notifiche',
  'log_modifiche',
  'fatture_importate',
  'impostazioni',
  'proposte_ordine',
  'righe_proposta_ordine',
  'sessioni_inventario',
  'righe_inventario',
  'utenti',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function getBackupFolderName() {
  const now = new Date();

  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-');

  const time = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');

  return `${date}_${time}`;
}

async function readAllRows(tableName) {
  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to);

    if (error) {
      throw new Error(`${tableName}: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;

    from += pageSize;
  }

  return allRows;
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  const startedAt = new Date();
  const folderName = getBackupFolderName();
  const backupDir = path.join(process.cwd(), 'backups', folderName);

  await fs.mkdir(backupDir, { recursive: true });

  console.log('🚀 Backup Supabase avviato...');
  console.log(`📁 Cartella: ${backupDir}`);

  const manifest = {
    app: 'MagazzinoPro',
    type: 'supabase-manual-backup',
    startedAt: startedAt.toISOString(),
    completedAt: null,
    supabaseUrl: SUPABASE_URL,
    tables: [],
    errors: [],
  };

  for (const tableName of TABLES) {
    try {
      console.log(`⬇️  Esporto ${tableName}...`);

      const rows = await readAllRows(tableName);
      const filePath = path.join(backupDir, `${tableName}.json`);

      await writeJson(filePath, rows);

      manifest.tables.push({
        table: tableName,
        rows: rows.length,
        file: `${tableName}.json`,
        status: 'ok',
      });

      console.log(`✅ ${tableName}: ${rows.length} righe`);
    } catch (err) {
      const message = err?.message || String(err);

      manifest.tables.push({
        table: tableName,
        rows: 0,
        file: null,
        status: 'error',
        error: message,
      });

      manifest.errors.push({
        table: tableName,
        error: message,
      });

      console.warn(`⚠️  ${tableName}: ${message}`);
    }
  }

  manifest.completedAt = new Date().toISOString();

  await writeJson(path.join(backupDir, 'manifest.json'), manifest);

  console.log('');
  console.log('✅ Backup completato.');
  console.log(`📁 File salvati in: ${backupDir}`);

  if (manifest.errors.length > 0) {
    console.log('');
    console.log('⚠️ Alcune tabelle non sono state esportate:');
    manifest.errors.forEach((item) => {
      console.log(`- ${item.table}: ${item.error}`);
    });
  }
}

main().catch((err) => {
  console.error('❌ Backup fallito:', err);
  process.exit(1);
});

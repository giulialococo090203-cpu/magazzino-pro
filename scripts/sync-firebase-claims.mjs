import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const applyChanges = process.argv.includes('--apply');

function cleanValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

function loadEnvFile(filename) {
  const result = {};
  const filepath = path.join(root, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`File mancante: ${filename}`);
  }

  for (const rawLine of fs.readFileSync(filepath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);

    result[key] = cleanValue(value);
  }

  return result;
}

function normalizeRole(value) {
  const role = cleanValue(value).toLowerCase();

  const aliases = {
    segreteria: 'segretaria',
    proprietario: 'datore',
    titolare: 'datore',
    sviluppatore: 'programmatore',
    super_admin: 'programmatore',
    admin_tecnico: 'programmatore',
  };

  return aliases[role] || role || 'operaio';
}

function resolveEmail(row) {
  const email = cleanValue(row.email).toLowerCase();

  if (email.includes('@')) {
    return email;
  }

  const username = cleanValue(row.username).toLowerCase();

  return username.includes('@') ? username : '';
}

const env = loadEnvFile('.dev.vars');

const supabaseUrl = cleanValue(env.VITE_SUPABASE_URL);
const serviceRoleKey = cleanValue(env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in .dev.vars.'
  );
}

const serviceAccountPath = path.join(root, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error('firebase-service-account.json non trovato.');
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const firebaseAdminAuth = getAuth();

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: rows, error } = await supabase
  .from('utenti')
  .select('*')
  .order('azienda_id', { ascending: true });

if (error) {
  throw new Error(`Errore lettura utenti Supabase: ${error.message}`);
}

console.log(
  applyChanges
    ? '\n===== SINCRONIZZAZIONE REALE ====='
    : '\n===== CONTROLLO PRELIMINARE — NESSUNA MODIFICA ====='
);

let found = 0;
let updated = 0;
let missing = 0;
let skipped = 0;
let failed = 0;

for (const row of rows || []) {
  const email = resolveEmail(row);
  const companyId = cleanValue(row.azienda_id);
  const appRole = normalizeRole(row.ruolo || row.role);
  const active = row.attivo !== false;

  if (!email || !companyId) {
    skipped += 1;
    console.log(
      `SALTO | ${row.nome || row.username || row.id} | email o azienda_id mancante`
    );
    continue;
  }

  try {
    const firebaseUser = await firebaseAdminAuth.getUserByEmail(email);
    found += 1;

    const newClaims = {
      ...(firebaseUser.customClaims || {}),
      role: 'authenticated',
      azienda_id: companyId,
      app_role: appRole,
      active,
    };

    console.log(
      `${applyChanges ? 'APPLICO' : 'PRONTO'} | ${email} | ` +
      `${companyId} | ${appRole} | attivo=${active}`
    );

    if (!applyChanges) {
      continue;
    }

    await firebaseAdminAuth.setCustomUserClaims(
      firebaseUser.uid,
      newClaims
    );

    if (row.auth_uid !== firebaseUser.uid) {
      const { error: updateError } = await supabase
        .from('utenti')
        .update({ auth_uid: firebaseUser.uid })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(
          `claim applicati, ma auth_uid non aggiornato: ${updateError.message}`
        );
      }
    }

    updated += 1;
  } catch (firebaseError) {
    if (firebaseError?.code === 'auth/user-not-found') {
      missing += 1;
      console.log(`MANCANTE IN FIREBASE | ${email}`);
      continue;
    }

    failed += 1;
    console.error(
      `ERRORE | ${email} | ${firebaseError?.message || firebaseError}`
    );
  }
}

console.log('\n===== RIEPILOGO =====');
console.log(`Profili Supabase: ${rows?.length || 0}`);
console.log(`Account Firebase trovati: ${found}`);
console.log(`Account Firebase mancanti: ${missing}`);
console.log(`Profili saltati: ${skipped}`);
console.log(`Errori: ${failed}`);

if (applyChanges) {
  console.log(`Account aggiornati: ${updated}`);
} else {
  console.log('\nNessun account è stato modificato.');
  console.log(
    'Dopo aver controllato l’elenco, esegui lo script con --apply.'
  );
}

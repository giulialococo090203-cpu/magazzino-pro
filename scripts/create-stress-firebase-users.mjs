import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';

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

const ADMIN_CREATE_USER_URL =
  'https://pdf-parser-vercel-wheat.vercel.app/api/admin/create-user';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ Mancano ADMIN_EMAIL e ADMIN_PASSWORD.');
  console.error('Uso: ADMIN_EMAIL="..." ADMIN_PASSWORD="..." node scripts/create-stress-firebase-users.mjs');
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Mancano SUPABASE_URL / SUPABASE_KEY.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: 'AIzaSyBDmq1YC4RdYja7SFBw_sJrr0-MP2stdmU',
  authDomain: 'magazzino-pro-d3c08.firebaseapp.com',
  projectId: 'magazzino-pro-d3c08',
  storageBucket: 'magazzino-pro-d3c08.firebasestorage.app',
  messagingSenderId: '577122205532',
  appId: '1:577122205532:web:523dc9429bdbccfeb64b99',
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeRole(role = '') {
  const value = String(role || '').trim().toLowerCase();

  if (value === 'admin') return 'datore';
  if (value === 'segreteria') return 'segretaria';

  return value || 'operaio';
}

async function main() {
  console.log('🔐 Login Firebase come admin/datore...');

  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    ADMIN_EMAIL,
    ADMIN_PASSWORD
  );

  const token = await credential.user.getIdToken(true);

  console.log('✅ Token admin ottenuto.');
  console.log('📦 Leggo utenti stress da Supabase...');

  const { data: users, error } = await supabase
    .from('utenti')
    .select('nome, username, email, ruolo, password, attivo, permessi')
    .like('username', 'stress.%')
    .order('nome');

  if (error) throw error;

  if (!users?.length) {
    console.log('⚠️ Nessun utente stress trovato in Supabase.');
    return;
  }

  console.log(`👥 Utenti stress trovati: ${users.length}`);

  let created = 0;
  let skippedOrUpdated = 0;
  let failed = 0;

  for (const user of users) {
    const email = String(user.email || user.username || '').trim();
    const password = String(user.password || 'StressTest2026!').trim();
    const fullName = String(user.nome || user.username || email).trim();
    const role = normalizeRole(user.ruolo);

    try {
      const response = await fetch(ADMIN_CREATE_USER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          active: user.attivo !== undefined ? Boolean(user.attivo) : true,
          permissions:
            user.permessi && typeof user.permessi === 'object'
              ? user.permessi
              : {},
          companyId: 'cl_thermoservice',
        }),
      });

      const responseText = await response.text();

      let payload = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload?.detail ||
          payload?.message ||
          responseText ||
          `Errore HTTP ${response.status}`;

        throw new Error(message);
      }

      const uid = payload?.uid || payload?.user?.uid || 'uid non restituito';

      console.log(`✅ ${email} creato/aggiornato in Firebase · ${role} · ${uid}`);

      if (payload?.created === false || payload?.updated === true) {
        skippedOrUpdated += 1;
      } else {
        created += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`❌ ${email}: ${err.message || err}`);
    }
  }

  console.log('');
  console.log('🎉 Operazione completata.');
  console.log({
    trovati: users.length,
    creati: created,
    aggiornati_o_gia_presenti: skippedOrUpdated,
    falliti: failed,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('❌ Creazione utenti Firebase fallita:', error);
  process.exit(1);
});

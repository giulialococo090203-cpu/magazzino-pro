// ============================================================
// WorkSpace - RIPRISTINO DEL RUOLO "authenticated" SU FIREBASE
// ------------------------------------------------------------
// PERCHE' SERVE
//   Supabase accetta il token di Firebase, ma per capire che chi
//   sta chiedendo i dati e' un utente vero (e non un visitatore
//   anonimo) legge nel token un'informazione chiamata "role".
//   Firebase non la mette da sola: va scritta sull'utente.
//
//   Se manca, il token resta valido ma Supabase risponde come se
//   non ci fosse nessuno: nessun errore, semplicemente elenchi
//   vuoti. E' esattamente il motivo per cui la giacenza appariva
//   a zero dall'account programmatore.
//
// COSA FA
//   Scorre tutti gli utenti Firebase e, a chi non ce l'ha, scrive
//   role = "authenticated" lasciando intatto tutto il resto.
//
// COME SI USA (dal Terminale, dentro la cartella del progetto)
//   node scripts/ripristina-ruolo-firebase.mjs          -> solo controllo
//   node scripts/ripristina-ruolo-firebase.mjs --apply  -> applica
//
//   Serve il file firebase-service-account.json nella cartella.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const root = process.cwd();
const applica = process.argv.includes('--apply');

const RUOLO_RICHIESTO = 'authenticated';

function caricaCredenziali() {
  const percorso = path.join(root, 'firebase-service-account.json');

  if (!fs.existsSync(percorso)) {
    throw new Error(
      'Non trovo firebase-service-account.json. Lancia il comando dalla cartella del progetto.'
    );
  }

  return JSON.parse(fs.readFileSync(percorso, 'utf8'));
}

async function main() {
  const credenziali = caricaCredenziali();

  if (!getApps().length) {
    initializeApp({ credential: cert(credenziali) });
  }

  const auth = getAuth();

  const daSistemare = [];
  const gia = [];

  let pagina = await auth.listUsers(1000);

  while (true) {
    for (const utente of pagina.users) {
      const claims = utente.customClaims || {};

      if (claims.role === RUOLO_RICHIESTO) {
        gia.push(utente.email || utente.uid);
      } else {
        daSistemare.push(utente);
      }
    }

    if (!pagina.pageToken) break;

    pagina = await auth.listUsers(1000, pagina.pageToken);
  }

  console.log(`Utenti Firebase totali:      ${gia.length + daSistemare.length}`);
  console.log(`Gia' a posto:                ${gia.length}`);
  console.log(`Senza il ruolo:              ${daSistemare.length}`);

  if (daSistemare.length) {
    console.log('\nUtenti senza il ruolo "authenticated":');

    for (const utente of daSistemare) {
      console.log(`  - ${utente.email || '(senza email)'}  [${utente.uid}]`);
    }
  }

  if (!applica) {
    console.log(
      daSistemare.length
        ? '\nControllo soltanto. Rilancia con --apply per sistemarli.'
        : '\nNiente da fare: sono tutti a posto.'
    );
    return;
  }

  let sistemati = 0;
  let errori = 0;

  for (const utente of daSistemare) {
    try {
      await auth.setCustomUserClaims(utente.uid, {
        ...(utente.customClaims || {}),
        role: RUOLO_RICHIESTO,
      });

      sistemati += 1;
    } catch (errore) {
      errori += 1;
      console.error(`  ! ${utente.email || utente.uid}: ${errore.message}`);
    }
  }

  console.log(`\nSistemati: ${sistemati}${errori ? ` - errori: ${errori}` : ''}`);
  console.log(
    'I token gia\' emessi si aggiornano da soli entro un\'ora: per vedere subito il risultato, esci e rientra nell\'app.'
  );
}

main().catch((errore) => {
  console.error('\nErrore:', errore.message);
  process.exitCode = 1;
});

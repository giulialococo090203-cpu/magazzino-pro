// ============================================================
// ACCESSO AMMINISTRATIVO A FIREBASE DAL SERVER
// ------------------------------------------------------------
// Alcune operazioni su Firebase (per esempio scrivere il ruolo di
// un utente) non si possono fare con la chiave pubblica: servono
// le credenziali di servizio del progetto.
//
// Questo file si occupa solo di quello: prende il file JSON delle
// credenziali - messo nella variabile FIREBASE_SERVICE_ACCOUNT -
// e lo scambia con un permesso temporaneo di Google.
//
// Se la variabile non c'e', le funzioni qui sotto lo dicono con un
// messaggio chiaro invece di fallire in modo oscuro.
// ============================================================

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

function base64url(bytes) {
  let binary = '';

  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlText(text) {
  return base64url(new TextEncoder().encode(text));
}

function pemToArrayBuffer(pem) {
  const clean = String(pem)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export function leggiServiceAccount(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT || env.GOOGLE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error(
      'Credenziali Firebase non configurate sul server: aggiungi la variabile FIREBASE_SERVICE_ACCOUNT.'
    );
  }

  let account = null;

  try {
    account = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT non e’ un JSON valido.');
  }

  if (!account?.client_email || !account?.private_key || !account?.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT incompleto.');
  }

  return account;
}

/** Permesso temporaneo di Google (vale un'ora). */
export async function ottieniAccessToken(env) {
  const account = leggiServiceAccount(env);

  const adesso = Math.floor(Date.now() / 1000);

  const header = base64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));

  const payload = base64urlText(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: adesso,
      exp: adesso + 3600,
    })
  );

  const chiave = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    chiave,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  const assertion = `${header}.${payload}.${base64url(firma)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payloadRisposta = await response.json();

  if (!response.ok || !payloadRisposta?.access_token) {
    throw new Error(
      payloadRisposta?.error_description ||
        'Google ha rifiutato le credenziali di servizio.'
    );
  }

  return { accessToken: payloadRisposta.access_token, projectId: account.project_id };
}

/**
 * Scrive il ruolo "authenticated" su tutti gli account Firebase che
 * non ce l'hanno. Senza quel ruolo Supabase tratta l'utente come un
 * visitatore anonimo e gli elenchi risultano vuoti.
 */
export async function ripristinaRuoloAuthenticated(env) {
  const { accessToken, projectId } = await ottieniAccessToken(env);

  const base = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;

  const intestazioni = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const utenti = [];
  let pageToken = '';

  do {
    const url = `${base}/accounts:batchGet?maxResults=1000${
      pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : ''
    }`;

    const response = await fetch(url, { headers: intestazioni });
    const dati = await response.json();

    if (!response.ok) {
      throw new Error(dati?.error?.message || 'Elenco utenti Firebase non leggibile.');
    }

    utenti.push(...(dati.users || []));
    pageToken = dati.nextPageToken || '';
  } while (pageToken);

  const daSistemare = utenti.filter((utente) => {
    let claims = {};

    try {
      claims = utente.customAttributes ? JSON.parse(utente.customAttributes) : {};
    } catch {
      claims = {};
    }

    return claims.role !== 'authenticated';
  });

  let sistemati = 0;
  const errori = [];

  for (const utente of daSistemare) {
    let claims = {};

    try {
      claims = utente.customAttributes ? JSON.parse(utente.customAttributes) : {};
    } catch {
      claims = {};
    }

    const response = await fetch(`${base}/accounts:update`, {
      method: 'POST',
      headers: intestazioni,
      body: JSON.stringify({
        localId: utente.localId,
        customAttributes: JSON.stringify({ ...claims, role: 'authenticated' }),
      }),
    });

    if (response.ok) {
      sistemati += 1;
    } else {
      const dati = await response.json().catch(() => null);

      errori.push({
        email: utente.email || utente.localId,
        message: dati?.error?.message || 'Aggiornamento non riuscito.',
      });
    }
  }

  return {
    totale: utenti.length,
    giaCorretti: utenti.length - daSistemare.length,
    sistemati,
    errori,
  };
}

/** Scrive il ruolo su un singolo account appena creato. */
export async function impostaRuoloAuthenticated(env, localId) {
  const { accessToken, projectId } = await ottieniAccessToken(env);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId,
        customAttributes: JSON.stringify({ role: 'authenticated' }),
      }),
    }
  );

  if (!response.ok) {
    const dati = await response.json().catch(() => null);

    throw new Error(dati?.error?.message || 'Ruolo non assegnato al nuovo utente.');
  }

  return true;
}

// ============================================================
// /api/programmer/config
// ------------------------------------------------------------
// Endpoint riservato alla parte programmatore (supporto tecnico).
// Verifica il token Firebase e l'email autorizzata, poi esegue
// le operazioni di supporto usando la service role di Supabase.
// ============================================================

import { ripristinaRuoloAuthenticated } from '../_googleAuth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CONFIG_ID = 'app';

const TABLES_WITH_COMPANY = [
  'categorie',
  'materiali',
  'movimenti',
  'notifiche',
  'log_modifiche',
  'fatture_importate',
  'storico_prezzi',
  'proposte_ordine',
  'righe_proposta_ordine',
  'sessioni_inventario',
  'righe_inventario',
  'utenti',
  'impostazioni',
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getCompanyId(env) {
  return String(env.AZIENDA_ID || env.VITE_AZIENDA_ID || 'cl_thermoservice').trim();
}

function getProgrammerEmails(env) {
  return String(env.PROGRAMMER_EMAIL || env.PROGRAMMER_EMAILS || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a = '', b = '') {
  const left = String(a);
  const right = String(b);

  if (left.length !== right.length) return false;

  let result = 0;

  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return result === 0;
}

async function supabaseRequest(env, path, options = {}) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || text || `Errore Supabase (${response.status}).`
    );
  }

  return data;
}

async function verifyProgrammer(env, token) {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY non configurata nel backend.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );

  const payload = await response.json();

  if (!response.ok || !payload?.users?.[0]) {
    throw new Error('Token non valido o scaduto.');
  }

  const firebaseUser = payload.users[0];
  const userEmail = normalizeEmail(firebaseUser.email);
  const allowed = getProgrammerEmails(env);

  if (allowed.length === 0) {
    throw new Error('PROGRAMMER_EMAIL non configurata nel backend.');
  }

  if (!userEmail || !allowed.includes(userEmail)) {
    throw new Error('Area riservata al programmatore.');
  }

  return firebaseUser;
}

async function readConfigRow(env) {
  const rows = await supabaseRequest(
    env,
    `configurazione_app?id=eq.${CONFIG_ID}&select=*`
  );

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function writeConfigRow(env, patch) {
  const existing = await readConfigRow(env);

  const body = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const rows = await supabaseRequest(
      env,
      `configurazione_app?id=eq.${CONFIG_ID}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    );

    return Array.isArray(rows) ? rows[0] : rows;
  }

  const rows = await supabaseRequest(env, 'configurazione_app', {
    method: 'POST',
    body: JSON.stringify({ id: CONFIG_ID, ...body }),
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

function publicConfig(row) {
  return {
    hasAccessCode: Boolean(row?.codice_accesso_hash),
    accessCodeUpdatedAt: row?.codice_aggiornato_at || null,
    maintenance: Boolean(row?.manutenzione_attiva),
    maintenanceMessage: row?.manutenzione_messaggio || '',
    maintenanceSince: row?.manutenzione_da || null,
    updatedAt: row?.updated_at || null,
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        { ok: false, message: 'Configurazione Supabase backend mancante.' },
        500
      );
    }

    const token = String(request.headers.get('Authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      return jsonResponse({ ok: false, message: 'Token autorizzazione mancante.' }, 401);
    }

    const firebaseUser = await verifyProgrammer(env, token);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'get').trim();
    const companyId = getCompanyId(env);

    // ----------------------------------------------------
    if (action === 'ping') {
      return jsonResponse({ ok: true, email: firebaseUser.email });
    }

    // ----------------------------------------------------
    if (action === 'get') {
      const row = await readConfigRow(env);
      return jsonResponse({ ok: true, config: publicConfig(row) });
    }

    // ----------------------------------------------------
    if (action === 'unlock') {
      const code = String(body?.code || '').trim();

      if (!code) {
        return jsonResponse({ ok: false, message: 'Codice d’accesso mancante.' }, 400);
      }

      const row = await readConfigRow(env);

      if (!row?.codice_accesso_hash) {
        // Primo avvio: nessun codice impostato, lo imposta questo primo accesso.
        const hash = await sha256Hex(code);

        await writeConfigRow(env, {
          codice_accesso_hash: hash,
          codice_aggiornato_at: new Date().toISOString(),
        });

        return jsonResponse({
          ok: true,
          initialized: true,
          message: 'Codice d’accesso impostato per la prima volta.',
        });
      }

      const hash = await sha256Hex(code);

      if (!timingSafeEqual(hash, row.codice_accesso_hash)) {
        return jsonResponse({ ok: false, message: 'Codice d’accesso non corretto.' }, 403);
      }

      return jsonResponse({ ok: true });
    }

    // ----------------------------------------------------
    if (action === 'set-code') {
      const code = String(body?.code || '').trim();

      if (code.length < 6) {
        return jsonResponse(
          { ok: false, message: 'Il codice d’accesso deve avere almeno 6 caratteri.' },
          400
        );
      }

      const hash = await sha256Hex(code);

      const row = await writeConfigRow(env, {
        codice_accesso_hash: hash,
        codice_aggiornato_at: new Date().toISOString(),
      });

      return jsonResponse({ ok: true, config: publicConfig(row) });
    }

    // ----------------------------------------------------
    if (action === 'maintenance') {
      const active = Boolean(body?.active);

      const row = await writeConfigRow(env, {
        manutenzione_attiva: active,
        manutenzione_messaggio: String(body?.message || '').trim() || null,
        manutenzione_da: active ? new Date().toISOString() : null,
      });

      return jsonResponse({ ok: true, config: publicConfig(row) });
    }

    // ----------------------------------------------------
    if (action === 'list-users') {
      const rows = await supabaseRequest(
        env,
        `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
          '&select=id,nome,email,username,ruolo,attivo,created_at&order=nome'
      );

      return jsonResponse({ ok: true, users: Array.isArray(rows) ? rows : [] });
    }

    // ----------------------------------------------------
    if (action === 'set-user-active') {
      const userId = String(body?.userId || '').trim();

      if (!userId) {
        return jsonResponse({ ok: false, message: 'ID utente mancante.' }, 400);
      }

      const rows = await supabaseRequest(
        env,
        `utenti?id=eq.${encodeURIComponent(userId)}` +
          `&azienda_id=eq.${encodeURIComponent(companyId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ attivo: Boolean(body?.active) }),
        }
      );

      const user = Array.isArray(rows) ? rows[0] : rows;

      if (!user) {
        return jsonResponse({ ok: false, message: 'Utente non trovato.' }, 404);
      }

      return jsonResponse({ ok: true, user });
    }

    // ----------------------------------------------------
    if (action === 'send-password-reset') {
      const email = normalizeEmail(body?.email);

      if (!email) {
        return jsonResponse({ ok: false, message: 'Email mancante.' }, 400);
      }

      const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY;

      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            ok: false,
            message:
              payload?.error?.message || 'Invio email di reimpostazione non riuscito.',
          },
          400
        );
      }

      return jsonResponse({ ok: true, email });
    }

    // ----------------------------------------------------
    if (action === 'repair-orphans') {
      const repaired = [];

      for (const table of TABLES_WITH_COMPANY) {
        try {
          const rows = await supabaseRequest(
            env,
            `${table}?azienda_id=is.null&select=id`,
            {
              method: 'PATCH',
              body: JSON.stringify({ azienda_id: companyId }),
            }
          );

          repaired.push({
            table,
            updated: Array.isArray(rows) ? rows.length : 0,
          });
        } catch (error) {
          repaired.push({
            table,
            updated: 0,
            error: error?.message || 'Errore aggiornamento.',
          });
        }
      }

      return jsonResponse({ ok: true, repaired });
    }

    if (action === 'check-pdf-service') {
      const parserUrl = env.VITE_PDF_PARSER_URL || env.PDF_PARSER_URL;

      if (!parserUrl) {
        return jsonResponse({
          ok: false,
          detail: 'Indirizzo del servizio non configurato (VITE_PDF_PARSER_URL).',
        });
      }

      try {
        const risposta = await fetch(parserUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ping: true }),
        });

        // Il servizio risponde male a una chiamata vuota: va benissimo.
        // Quello che conta e' che risponda.
        return jsonResponse({
          ok: risposta.status < 500,
          detail: `Servizio raggiungibile (risposta HTTP ${risposta.status}).`,
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          detail: error?.message || 'Servizio non raggiungibile.',
        });
      }
    }

    if (action === 'repair-firebase-roles') {
      const esito = await ripristinaRuoloAuthenticated(env);

      return jsonResponse({ ok: true, ...esito });
    }

    return jsonResponse({ ok: false, message: `Azione non riconosciuta: ${action}` }, 400);
  } catch (error) {
    console.error('Errore /api/programmer/config:', error);

    return jsonResponse(
      { ok: false, message: error?.message || 'Errore area programmatore.' },
      500
    );
  }
}

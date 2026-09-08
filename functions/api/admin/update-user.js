// ============================================================
// /api/admin/update-user
// ------------------------------------------------------------
// Aggiorna un utente dell'azienda. Passa dal server perche' la
// tabella "utenti" non e' scrivibile direttamente dal browser.
// Autorizzato al datore dell'azienda e al programmatore.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'admin' || role === 'controllo') return 'datore';
  if (role === 'segreteria') return 'segretaria';
  if (role === 'operatore') return 'magazziniere';

  return role;
}

function getCompanyId(env) {
  return String(env.AZIENDA_ID || env.VITE_AZIENDA_ID || 'cl_thermoservice').trim();
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

async function verifyFirebaseUser(env, token) {
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

  return payload.users[0];
}

async function assertCanManageUsers(env, firebaseUser, companyId) {
  const userEmail = normalizeEmail(firebaseUser?.email);

  const programmerEmails = String(env.PROGRAMMER_EMAIL || env.PROGRAMMER_EMAILS || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  if (programmerEmails.includes(userEmail)) return;

  const rows = await supabaseRequest(
    env,
    `utenti?azienda_id=eq.${encodeURIComponent(companyId)}` +
      `&email=eq.${encodeURIComponent(userEmail)}` +
      '&attivo=eq.true&select=id,ruolo'
  );

  const caller = Array.isArray(rows) ? rows[0] : null;
  const role = normalizeRole(caller?.ruolo);

  if (!caller || !['datore', 'sviluppatore', 'super_admin', 'admin_tecnico'].includes(role)) {
    throw new Error('Operazione non autorizzata.');
  }
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

    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || body?.id || '').trim();
    const updates = body?.updates && typeof body.updates === 'object' ? body.updates : {};

    if (!userId) {
      return jsonResponse({ ok: false, message: 'ID utente mancante.' }, 400);
    }

    const companyId = getCompanyId(env);
    const firebaseCaller = await verifyFirebaseUser(env, token);

    await assertCanManageUsers(env, firebaseCaller, companyId);

    // Solo i campi consentiti: azienda e password non si toccano da qui.
    const row = {};

    if (updates.fullName !== undefined || updates.nome !== undefined) {
      row.nome = String(updates.fullName ?? updates.nome ?? '').trim();
    }

    if (updates.username !== undefined) {
      row.username = String(updates.username || '').trim();
    }

    if (updates.email !== undefined) {
      row.email = normalizeEmail(updates.email) || null;
    }

    if (updates.role !== undefined || updates.ruolo !== undefined) {
      row.ruolo = normalizeRole(updates.role ?? updates.ruolo) || 'operaio';
    }

    if (updates.active !== undefined || updates.attivo !== undefined) {
      row.attivo = Boolean(updates.active ?? updates.attivo);
    }

    if (updates.permissions !== undefined || updates.permessi !== undefined) {
      const permissions = updates.permissions ?? updates.permessi;
      row.permessi = permissions && typeof permissions === 'object' ? permissions : {};
    }

    if (Object.keys(row).length === 0) {
      return jsonResponse({ ok: false, message: 'Nessun campo da aggiornare.' }, 400);
    }

    const saved = await supabaseRequest(
      env,
      `utenti?id=eq.${encodeURIComponent(userId)}` +
        `&azienda_id=eq.${encodeURIComponent(companyId)}`,
      { method: 'PATCH', body: JSON.stringify(row) }
    );

    const user = Array.isArray(saved) ? saved[0] : saved;

    if (!user) {
      return jsonResponse({ ok: false, message: 'Utente non trovato.' }, 404);
    }

    return jsonResponse({ ok: true, user });
  } catch (error) {
    console.error('Errore update-user:', error);

    return jsonResponse(
      { ok: false, message: error?.message || 'Errore aggiornamento utente.' },
      500
    );
  }
}

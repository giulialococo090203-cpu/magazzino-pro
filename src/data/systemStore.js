// ============================================================
// SYSTEMSTORE.JS - Parte programmatore / supporto tecnico
// ------------------------------------------------------------
// Gestisce:
//  - stato pubblico dell'app (manutenzione)
//  - codice d'accesso alla parte programmatore
//  - diagnostica completa dello stato dell'app
//  - andamento dell'app nel tempo
//  - interventi di sblocco su utenti e dati
// ============================================================

import { supabase } from '../supabaseClient';
import { firebaseAuth } from '../firebaseClient';
import { AZIENDA_ID } from '../config/azienda';

const PROGRAMMER_API_URL =
  import.meta.env.VITE_PROGRAMMER_API_URL || '/api/programmer/config';

const UNLOCK_KEY = 'wm_programmer_unlocked';
const PUBLIC_STATUS_VIEW = 'stato_app_pubblico';

/** Tabelle monitorate dalla diagnostica. */
export const MONITORED_TABLES = [
  { table: 'categorie', label: 'Categorie', critical: true },
  { table: 'materiali', label: 'Materiali', critical: true },
  { table: 'movimenti', label: 'Movimenti', critical: true },
  { table: 'fatture_importate', label: 'Fatture importate', critical: false },
  { table: 'notifiche', label: 'Notifiche', critical: false },
  { table: 'log_modifiche', label: 'Registro modifiche', critical: false },
  { table: 'storico_prezzi', label: 'Storico prezzi', critical: false },
  { table: 'proposte_ordine', label: 'Proposte ordine', critical: false },
  { table: 'sessioni_inventario', label: 'Sessioni inventario', critical: false },
  // "impostazioni" non ha la colonna id: la chiave primaria e' chiave+azienda.
  { table: 'impostazioni', label: 'Impostazioni', critical: false, colonna: 'chiave' },
];

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function callProgrammerApi(action, payload = {}) {
  const currentFirebaseUser = firebaseAuth.currentUser;

  if (!currentFirebaseUser) {
    throw new Error('Sessione scaduta. Esci e accedi di nuovo.');
  }

  const token = await currentFirebaseUser.getIdToken(true);

  const response = await fetch(PROGRAMMER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  if (response.status === 404) {
    throw new Error(
      'Funzioni server non attive: avvia l’app con "npm run dev:api" invece di "npm run dev", ' +
      'oppure usa il sito pubblicato.'
    );
  }

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.message ||
        data?.detail ||
        text ||
        `Errore richiesta programmatore (${response.status}).`
    );
  }

  return data;
}

export const systemStore = {
  // --------------------------------------------------------
  // STATO PUBBLICO (manutenzione)
  // --------------------------------------------------------

  async getPublicStatus() {
    try {
      const { data, error } = await supabase
        .from(PUBLIC_STATUS_VIEW)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      return {
        maintenance: Boolean(data?.manutenzione_attiva),
        message: data?.manutenzione_messaggio || '',
        since: data?.manutenzione_da || null,
        available: true,
      };
    } catch (error) {
      // Se la vista non esiste ancora l'app deve continuare a funzionare.
      console.warn('Stato app non leggibile:', error);

      return {
        maintenance: false,
        message: '',
        since: null,
        available: false,
      };
    }
  },

  // --------------------------------------------------------
  // CODICE D'ACCESSO PROGRAMMATORE
  // --------------------------------------------------------

  isUnlocked() {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  },

  lock() {
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch {
      // ignora
    }
  },

  async unlock(code) {
    const cleanCode = String(code || '').trim();

    if (!cleanCode) {
      throw new Error('Inserisci il codice d’accesso.');
    }

    const result = await callProgrammerApi('unlock', { code: cleanCode });

    try {
      sessionStorage.setItem(UNLOCK_KEY, '1');
    } catch {
      // ignora
    }

    return result;
  },

  async getConfig() {
    const result = await callProgrammerApi('get');
    return result?.config || {};
  },

  async setAccessCode(code) {
    const cleanCode = String(code || '').trim();

    if (cleanCode.length < 6) {
      throw new Error('Il codice d’accesso deve avere almeno 6 caratteri.');
    }

    return callProgrammerApi('set-code', { code: cleanCode });
  },

  // --------------------------------------------------------
  // MANUTENZIONE
  // --------------------------------------------------------

  async setMaintenance(active, message = '') {
    return callProgrammerApi('maintenance', {
      active: Boolean(active),
      message: String(message || '').trim(),
    });
  },

  // --------------------------------------------------------
  // INTERVENTI DI SUPPORTO SU UTENTI
  // --------------------------------------------------------

  async listUsers() {
    const result = await callProgrammerApi('list-users');
    return Array.isArray(result?.users) ? result.users : [];
  },

  async setUserActive(userId, active) {
    return callProgrammerApi('set-user-active', {
      userId,
      active: Boolean(active),
    });
  },

  async sendPasswordReset(email) {
    return callProgrammerApi('send-password-reset', { email });
  },

  /**
   * Crea (o ripristina) l'account datore dell'azienda.
   * Utile se l'unico account amministrativo diventa inutilizzabile.
   */
  async createOwner({ fullName, email, password }) {
    const currentFirebaseUser = firebaseAuth.currentUser;

    if (!currentFirebaseUser) {
      throw new Error('Sessione scaduta. Esci e accedi di nuovo.');
    }

    const token = await currentFirebaseUser.getIdToken(true);

    const response = await fetch('/api/admin/create-company-owner', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId: AZIENDA_ID,
        fullName: String(fullName || '').trim(),
        email: String(email || '').trim(),
        password: String(password || '').trim(),
      }),
    });

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || 'Creazione datore non riuscita.');
    }

    return data;
  },

  // --------------------------------------------------------
  // DIAGNOSTICA
  // --------------------------------------------------------

  /**
   * Verifica una per una le parti critiche dell'app e restituisce
   * l'esito di ogni controllo con tempi di risposta e conteggi.
   */
  async runDiagnostics() {
    const checks = [];
    const counts = {};

    // 1. Autenticazione Firebase
    const authStart = now();
    checks.push({
      key: 'firebase_auth',
      label: 'Autenticazione (Firebase)',
      ok: Boolean(firebaseAuth.currentUser),
      ms: Math.round(now() - authStart),
      detail: firebaseAuth.currentUser
        ? `Sessione attiva: ${firebaseAuth.currentUser.email || firebaseAuth.currentUser.uid}`
        : 'Nessuna sessione Firebase attiva.',
    });

    // 1-bis. Identita' vista dal database
    //
    // Supabase capisce chi sta chiedendo i dati leggendo il token di
    // Firebase. Se nel token manca l'informazione "role" la richiesta
    // viene trattata come anonima: nessun errore, ma tutti gli elenchi
    // tornano vuoti. Questo controllo lo rende visibile subito.
    const identitaStart = now();

    try {
      const { data, error } = await supabase.rpc('identita_sessione');

      if (error) throw error;

      const identita = data || {};
      const riconosciuta = identita.ruolo_database === 'authenticated';

      checks.push({
        key: 'identita_database',
        label: 'Identita riconosciuta dal database',
        ok: riconosciuta,
        critical: true,
        ms: Math.round(now() - identitaStart),
        detail: riconosciuta
          ? `Riconosciuto come ${identita.email_token || 'utente'}${
              identita.e_programmatore ? ' (programmatore)' : ''
            }.`
          : 'Il database ti tratta come visitatore anonimo: il token Firebase non porta il ruolo "authenticated", percio\u2019 gli elenchi risultano vuoti. Si risolve con: node scripts/ripristina-ruolo-firebase.mjs --apply',
      });
    } catch (error) {
      checks.push({
        key: 'identita_database',
        label: 'Identita riconosciuta dal database',
        ok: false,
        critical: true,
        ms: Math.round(now() - identitaStart),
        detail:
          error?.message ||
          'Controllo non disponibile: manca la migration 20260908_identita_sessione.sql.',
      });
    }

    // 2. Tabelle dati
    for (const item of MONITORED_TABLES) {
      const start = now();

      try {
        const query = supabase
          .from(item.table)
          .select(item.colonna || 'id', { count: 'exact', head: true });

        const { count, error } = await query.eq('azienda_id', AZIENDA_ID);

        if (error) throw error;

        counts[item.table] = Number(count || 0);

        checks.push({
          key: `table_${item.table}`,
          label: item.label,
          ok: true,
          critical: item.critical,
          ms: Math.round(now() - start),
          detail: `${Number(count || 0).toLocaleString('it-IT')} record`,
        });
      } catch (error) {
        counts[item.table] = null;

        checks.push({
          key: `table_${item.table}`,
          label: item.label,
          ok: false,
          critical: item.critical,
          ms: Math.round(now() - start),
          detail: error?.message || 'Tabella non raggiungibile.',
        });
      }
    }

    // 3. Utenti (la tabella non e' leggibile dal browser: si passa dall'API)
    const utentiStart = now();

    try {
      const utenti = await this.listUsers();
      const attivi = utenti.filter((utente) => utente.attivo !== false).length;

      counts.utenti = utenti.length;

      checks.push({
        key: 'utenti',
        label: 'Utenti',
        ok: true,
        critical: true,
        ms: Math.round(now() - utentiStart),
        detail: `${utenti.length} utenti (${attivi} attivi)`,
      });
    } catch (error) {
      counts.utenti = null;

      checks.push({
        key: 'utenti',
        label: 'Utenti',
        ok: false,
        critical: true,
        ms: Math.round(now() - utentiStart),
        detail: error?.message || 'Elenco utenti non raggiungibile.',
      });
    }

    // 4. Storage fatture
    const storageStart = now();

    try {
      const { error } = await supabase.storage.from('fatture').list('', { limit: 1 });

      if (error) throw error;

      checks.push({
        key: 'storage',
        label: 'Archivio file fatture',
        ok: true,
        ms: Math.round(now() - storageStart),
        detail: 'Bucket raggiungibile.',
      });
    } catch (error) {
      checks.push({
        key: 'storage',
        label: 'Archivio file fatture',
        ok: false,
        ms: Math.round(now() - storageStart),
        detail: error?.message || 'Bucket non raggiungibile.',
      });
    }

    // 5. Servizio di lettura PDF (parser fatture)
    // Il servizio di lettura PDF vive su un altro dominio e non accetta
    // chiamate diverse da quelle dell'importazione fatture: interrogato
    // dal browser risponde sempre "Load failed" anche quando funziona.
    // Il controllo lo fa quindi il server, dove il blocco non esiste.
    const parserStart = now();

    try {
      // L'indirizzo del servizio lo conosce l'app: lo passiamo al
      // server, cosi' il controllo funziona anche se online non e'
      // stata configurata la stessa variabile.
      const esito = await callProgrammerApi('check-pdf-service', {
        url: import.meta.env.VITE_PDF_PARSER_URL || '',
      });

      checks.push({
        key: 'pdf_parser',
        label: 'Servizio lettura PDF',
        ok: Boolean(esito?.ok),
        ms: Math.round(now() - parserStart),
        detail: esito?.detail || 'Servizio raggiungibile.',
      });
    } catch (error) {
      checks.push({
        key: 'pdf_parser',
        label: 'Servizio lettura PDF',
        ok: false,
        ms: Math.round(now() - parserStart),
        detail: error?.message || 'Servizio non raggiungibile.',
      });
    }

    // 6. API programmatore
    const apiStart = now();

    try {
      await callProgrammerApi('ping');

      checks.push({
        key: 'programmer_api',
        label: 'API supporto programmatore',
        ok: true,
        ms: Math.round(now() - apiStart),
        detail: 'Endpoint attivo e autorizzato.',
      });
    } catch (error) {
      checks.push({
        key: 'programmer_api',
        label: 'API supporto programmatore',
        ok: false,
        ms: Math.round(now() - apiStart),
        detail: error?.message || 'Endpoint non raggiungibile.',
      });
    }

    const failing = checks.filter((check) => !check.ok);
    const criticalFailing = failing.filter((check) => check.critical);

    return {
      generatedAt: new Date().toISOString(),
      checks,
      counts,
      status:
        criticalFailing.length > 0
          ? 'critico'
          : failing.length > 0
            ? 'attenzione'
            : 'ok',
    };
  },

  /**
   * Andamento dell'app negli ultimi mesi: movimenti, fatture,
   * materiali sotto soglia, utenti attivi, ultime attività.
   */
  async getAppTrend(months = 6) {
    const periods = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);

      periods.push({
        label: start.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }

    const rows = [];

    for (const period of periods) {
      const [movements, invoices] = await Promise.all([
        supabase
          .from('movimenti')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .gte('data_movimento', period.start)
          .lt('data_movimento', period.end),
        supabase
          .from('fatture_importate')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .gte('created_at', period.start)
          .lt('created_at', period.end),
      ]);

      rows.push({
        label: period.label,
        movements: Number(movements?.count || 0),
        invoices: Number(invoices?.count || 0),
      });
    }

    const utenti = await this.listUsers().catch(() => []);

    const [lowStock, unreadNotifications, lastMovement, lastLogs] =
      await Promise.all([
        supabase
          .from('materiali')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .neq('stato_disponibilita', 'disponibile'),
        supabase
          .from('notifiche')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .eq('letta', false),
        supabase
          .from('movimenti')
          .select('data_movimento, tipo_movimento, operatore_nome')
          .eq('azienda_id', AZIENDA_ID)
          .order('data_movimento', { ascending: false })
          .limit(1),
        supabase
          .from('log_modifiche')
          .select('*')
          .eq('azienda_id', AZIENDA_ID)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

    return {
      months: rows,
      lowStock: Number(lowStock?.count || 0),
      unreadNotifications: Number(unreadNotifications?.count || 0),
      activeUsers: utenti.filter((utente) => utente.attivo !== false).length,
      totalUsers: utenti.length,
      lastMovement: lastMovement?.data?.[0] || null,
      lastLogs: Array.isArray(lastLogs?.data) ? lastLogs.data : [],
    };
  },

  /**
   * Controlli di integrità sui dati: record incoerenti che possono
   * "rompere" l'app (movimenti orfani, materiali senza categoria, ecc.).
   */
  async checkDataIntegrity() {
    const issues = [];

    const safeCount = async (label, description, builder) => {
      try {
        const { count, error } = await builder();

        if (error) throw error;

        if (Number(count || 0) > 0) {
          issues.push({
            label,
            description,
            count: Number(count || 0),
            ok: false,
          });
        } else {
          issues.push({ label, description, count: 0, ok: true });
        }
      } catch (error) {
        issues.push({
          label,
          description: error?.message || 'Controllo non eseguibile.',
          count: null,
          ok: false,
        });
      }
    };

    await safeCount(
      'Record senza azienda',
      'Materiali salvati senza riferimento all’azienda',
      () =>
        supabase
          .from('materiali')
          .select('id', { count: 'exact', head: true })
          .is('azienda_id', null)
    );

    await safeCount(
      'Movimenti senza azienda',
      'Movimenti salvati senza riferimento all’azienda',
      () =>
        supabase
          .from('movimenti')
          .select('id', { count: 'exact', head: true })
          .is('azienda_id', null)
    );

    await safeCount(
      'Materiali senza categoria',
      'Materiali che non hanno una categoria associata',
      () =>
        supabase
          .from('materiali')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .is('categoria_id', null)
    );

    await safeCount(
      'Quantità negative',
      'Materiali con giacenza negativa (dato incoerente)',
      () =>
        supabase
          .from('materiali')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', AZIENDA_ID)
          .lt('quantita', 0)
    );

    try {
      const utenti = await this.listUsers();
      const bloccati = utenti.filter((utente) => utente.attivo === false).length;

      issues.push({
        label: 'Utenti disattivati',
        description: 'Utenti che al momento non possono accedere',
        count: bloccati,
        ok: bloccati === 0,
      });
    } catch (error) {
      issues.push({
        label: 'Utenti disattivati',
        description: error?.message || 'Controllo non eseguibile.',
        count: null,
        ok: false,
      });
    }

    return issues;
  },

  /**
   * Assegna all'azienda unica tutti i record rimasti senza azienda_id.
   */
  async repairOrphanRecords() {
    return callProgrammerApi('repair-orphans');
  },

  /**
   * Riconsegna a tutti gli account Firebase il ruolo "authenticated".
   *
   * Senza quel ruolo il token resta valido ma Supabase risponde come a
   * un visitatore anonimo: l'utente entra nell'app e trova tutto vuoto.
   */
  async repairFirebaseRoles() {
    return callProgrammerApi('repair-firebase-roles');
  },
};

export default systemStore;

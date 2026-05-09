// ============================================================
// STORE.JS - Data Management Layer (Supabase Integration)
// ============================================================

import { supabase } from '../supabaseClient';
import { INITIAL_UNITS } from './initialData';

const ADMIN_CREATE_USER_URL =
  import.meta.env.VITE_ADMIN_CREATE_USER_URL ||
  'https://pdf-parser-vercel-wheat.vercel.app/api/admin/create-user';

const ADMIN_DELETE_USER_URL =
  import.meta.env.VITE_ADMIN_DELETE_USER_URL ||
  'https://pdf-parser-vercel-wheat.vercel.app/api/admin/delete-user';
import { authStore } from './authStore';
import { firebaseAuth } from '../firebaseClient';

// --- Auth Helper ---
const hashPassword = async (password) => {
  if (!password) return null;

  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// --- Utils ---
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'admin') return 'datore';
  if (normalized === 'controllo') return 'datore';
  if (normalized === 'segreteria') return 'segretaria';
  if (normalized === 'operatore') return 'magazziniere';

  return normalized;
};

function sanitizeStorageFileName(fileName = '') {
  const parts = String(fileName || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('.');

  const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';

  const baseName = parts
    .join('.')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 90);

  return `${baseName || 'documento'}${extension ? `.${extension}` : ''}`;
}

function buildInvoiceStoragePath(fileName = '') {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const safeName = sanitizeStorageFileName(fileName);

  return `fatture/${year}/${month}/${timestamp}-${safeName}`;
}

function chunkArray(array = [], size = 100) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}


function isValidSupabaseUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function notifySupabaseUsageChanged() {
  try {
    window.dispatchEvent(new CustomEvent('wm_supabase_usage_refresh'));
    localStorage.setItem('wm_supabase_usage_refresh_at', String(Date.now()));
  } catch {
    // Non bloccare mai le operazioni se il browser non permette l’evento.
  }
}


async function createFirebaseUserFromAdmin(user) {
  const currentFirebaseUser = firebaseAuth.currentUser;

  if (!currentFirebaseUser) {
    throw new Error('Sessione Firebase non valida. Esci e accedi di nuovo come datore.');
  }

  const token = await currentFirebaseUser.getIdToken(true);

  const currentAppUser = authStore.getCurrentUser();
  const companyId =
    user.companyId ||
    user.company_id ||
    currentAppUser?.companyId ||
    currentAppUser?.company_id ||
    'cl_thermoservice';

  const response = await fetch(ADMIN_CREATE_USER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: String(user.email || user.username || '').trim(),
      password: String(user.password || '').trim(),
      fullName: String(user.fullName || user.nome || user.username || '').trim(),
      role: normalizeRole(user.role || user.ruolo || 'operaio'),
      active: user.active !== undefined ? Boolean(user.active) : true,
      permissions:
        user.permissions && typeof user.permissions === 'object'
          ? user.permissions
          : {},
      companyId,
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
      `Errore creazione utente Firebase (${response.status}).`;

    throw new Error(message);
  }

  return payload;
}


async function deleteFirebaseUserFromAdmin(user) {
  const currentFirebaseUser = firebaseAuth.currentUser;

  if (!currentFirebaseUser) {
    throw new Error('Sessione Firebase non valida. Esci e accedi di nuovo come datore.');
  }

  const token = await currentFirebaseUser.getIdToken(true);

  const currentAppUser = authStore.getCurrentUser();
  const companyId =
    user?.companyId ||
    user?.company_id ||
    currentAppUser?.companyId ||
    currentAppUser?.company_id ||
    'cl_thermoservice';

  const response = await fetch(ADMIN_DELETE_USER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: user?.authUid || user?.uid || '',
      email: user?.email || user?.username || '',
      companyId,
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
      `Errore eliminazione utente Firebase (${response.status}).`;

    throw new Error(message);
  }

  return payload;
}

// --- Field Mappings DB Snake Case <-> App Camel Case ---

const mapCategory = {
  toModel: (row) => ({
    id: row.id,
    name: row.nome,
    description: row.descrizione,
    createdAt: row.created_at,
  }),

  toRow: (model) =>
    clean({
      nome: model.name,
      descrizione: model.description,
    }),
};

const mapMaterial = {
  toModel: (row) => ({
    id: row.id,
    code: row.codice,
    description: row.descrizione,
    brand: row.marca,
    quantity: row.quantita,
    category: row.categoria_id,
    unit: row.unita_misura,
    minThreshold: row.soglia_minima,
    status: row.stato_disponibilita,
    location: row.posizione_scaffale,
    supplier: row.fornitore,
    notes: row.note,
    netPrice: Number(row.prezzo_netto || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  toRow: (model) =>
    clean({
      codice: model.code,
      descrizione: model.description,
      marca: model.brand,
      quantita: model.quantity,
      categoria_id: model.category,
      unita_misura: model.unit,
      soglia_minima: model.minThreshold,
      stato_disponibilita: model.status,
      posizione_scaffale: model.location,
      fornitore: model.supplier,
      note: model.notes,
      prezzo_netto: model.netPrice,
    }),
};

const mapMovement = {
  toModel: (row) => ({
    id: row.id,
    materialId: row.materiale_id,
    materialCode: row.materiali?.codice,
    materialDescription: row.materiali?.descrizione,
    categoryId: row.materiali?.categoria_id,
    type: row.tipo_movimento,
    quantity: row.quantita,
    userId: row.utente_id,
    userName: row.utenti?.nome || row.operatore_nome || '',
    reason: row.motivo,
    notes: row.note,
    date: row.data_movimento,
    createdAt: row.created_at,
    clientName: row.cliente_nome || '',
    authorizedBy: row.autorizzato_da || '',
    operatorName: row.operatore_nome || row.utenti?.nome || '',
    previousQty: row.previous_qty ?? null,
    newQty: row.new_qty ?? null,
    supplier: row.fornitore || '',
    fornitore: row.fornitore || '',
  }),

  toRow: (model) =>
    clean({
      materiale_id: model.materialId,
      tipo_movimento: model.type,
      quantita: model.quantity,
      motivo: model.reason,
      note: model.notes,

      // Firebase Auth usa UID testuali, Supabase qui si aspetta UUID.
      // Se non è un UUID valido, salvo null in utente_id e tengo il nome in operatore_nome.
      utente_id:
        typeof model.userId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model.userId)
          ? model.userId
          : null,

      data_movimento: model.date || new Date().toISOString(),
      cliente_nome: model.clientName || null,
      autorizzato_da: model.authorizedBy || null,
      operatore_nome:
        model.operatorName ||
        model.userName ||
        model.fullName ||
        null,
      previous_qty: model.previousQty ?? null,
      new_qty: model.newQty ?? null,
      fornitore: model.supplier || model.fornitore || null,
    }),
};

const mapUser = {
  toModel: (row) => ({
    id: row.id,
    username: row.username,
    fullName: row.nome,
    email: row.email || '',
    role: normalizeRole(row.ruolo),
    active: row.attivo,
    permissions:
      row.permessi && typeof row.permessi === 'object'
        ? row.permessi
        : {},
    createdAt: row.created_at,
  }),

  toRow: (model) =>
    clean({
      username: model.username,
      nome: model.fullName,
      email: model.email || null,
      ruolo: normalizeRole(model.role),
      attivo: model.active,
      password: model.password,
      permessi: model.permissions,
    }),
};

const mapNotification = {
  toModel: (row) => ({
    id: row.id,
    materialId: row.materiale_id,
    materialCode: row.materiali?.codice,
    materialDescription: row.materiali?.descrizione,
    type: row.tipo,
    message: row.messaggio,
    read: row.letta,
    createdAt: row.created_at,
    currentQty: row.materiali?.quantita,
    threshold: row.materiali?.soglia_minima,
  }),

  toRow: (model) =>
    clean({
      materiale_id: model.materialId,
      tipo: model.type,
      messaggio: model.message,
      letta: model.read,
    }),
};

const mapLog = {
  toModel: (row) => ({
    id: row.id,
    userId: row.utente_id,
    userName: row.utenti?.nome || 'Sistema',
    entity: row.entita,
    entityId: row.entita_id,
    action: row.azione,
    details: row.descrizione,
    date: row.created_at,
  }),

  toRow: (model) =>
    clean({
      // Firebase Auth usa UID testuali, Supabase log_modifiche.utente_id vuole UUID.
      // Se non è UUID valido, lo salvo null e tengo comunque il nome utente nella descrizione/azione.
      utente_id:
        typeof model.userId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model.userId)
          ? model.userId
          : null,

      entita: model.entity,
      entita_id: model.entityId,
      azione: model.action,
      descrizione: model.details,
    }),
};

const mapImportedInvoice = {
  toModel: (row) => ({
    id: row.id,
    fileName: row.nome_file,
    originalFileName: row.nome_file_originale,
    filePath: row.percorso_file,
    bucket: row.bucket || 'fatture',
    fileSize: Number(row.dimensione_file || 0),
    fileType: row.tipo_file || '',
    userId: row.utente_id,
    userName: row.utente_nome || '',
    status: row.stato_importazione,
    detectedItems: Number(row.numero_materiali_rilevati || 0),
    createdItems: Number(row.numero_materiali_creati || 0),
    updatedItems: Number(row.numero_materiali_aggiornati || 0),
    errors: row.eventuali_errori || '',
    supplier: row.fornitore || '',
    fornitore: row.fornitore || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  toRow: (model) =>
    clean({
      nome_file: model.fileName,
      nome_file_originale: model.originalFileName,
      percorso_file: model.filePath,
      bucket: model.bucket || 'fatture',
      dimensione_file: model.fileSize,
      tipo_file: model.fileType,
      fornitore: model.supplier || model.fornitore || null,

      // Firebase Auth usa UID testuali.
      // Supabase fatture_importate.utente_id accetta solo UUID.
      // Se non è UUID valido, salvo null e mantengo il nome in utente_nome.
      utente_id: isValidSupabaseUuid(model.userId) ? model.userId : null,
      utente_nome: model.userName || null,

      stato_importazione: model.status,
      numero_materiali_rilevati: model.detectedItems,
      numero_materiali_creati: model.createdItems,
      numero_materiali_aggiornati: model.updatedItems,
      eventuali_errori: model.errors,
    }),
};

const mapReorderProposalRow = {
  toModel: (row) => ({
    id: row.id,
    proposalId: row.proposta_id,
    materialId: row.materiale_id,
    code: row.codice,
    description: row.descrizione,
    brand: row.marca || '',
    category: row.categoria_id,
    unit: row.unita_misura || '',
    currentQty: Number(row.quantita_attuale || 0),
    minThreshold: Number(row.soglia_minima || 0),
    suggestedQty: Number(row.quantita_consigliata || 0),
    supplier: row.fornitore || 'Senza fornitore',
    location: row.posizione || '',
    notes: row.note || '',
    createdAt: row.created_at,
  }),

  toRow: (model) =>
    clean({
      proposta_id: model.proposalId,
      materiale_id: model.materialId,
      codice: model.code,
      descrizione: model.description,
      marca: model.brand || null,
      categoria_id: model.category || null,
      unita_misura: model.unit || null,
      quantita_attuale: model.currentQty || 0,
      soglia_minima: model.minThreshold || 0,
      quantita_consigliata: model.suggestedQty || 0,
      fornitore: model.supplier || 'Senza fornitore',
      posizione: model.location || null,
      note: model.notes || null,
    }),
};

const mapReorderProposal = {
  toModel: (row) => ({
    id: row.id,
    number: row.numero,
    supplier: row.fornitore || 'Senza fornitore',
    status: row.stato || 'aperta',
    notes: row.note || '',
    userId: row.utente_id,
    userName: row.utente_nome || '',
    totalRows: Number(row.totale_righe || 0),
    totalQuantity: Number(row.totale_quantita || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rows: Array.isArray(row.righe_proposta_ordine)
      ? row.righe_proposta_ordine.map(mapReorderProposalRow.toModel)
      : [],
  }),

  toRow: (model) =>
    clean({
      numero: model.number,
      fornitore: model.supplier || 'Senza fornitore',
      stato: model.status || 'aperta',
      note: model.notes || null,
      // Firebase Auth usa UID testuali, Supabase fatture_importate.utente_id vuole UUID.
      // Se non è UUID valido, salvo null e tengo comunque il nome in utente_nome.
      utente_id:
        typeof model.userId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model.userId)
          ? model.userId
          : null,
      utente_nome: model.userName || null,
      totale_righe: model.totalRows || 0,
      totale_quantita: model.totalQuantity || 0,
      updated_at: model.updatedAt || new Date().toISOString(),
    }),
};

const mapInventoryRow = {
  toModel: (row) => ({
    id: row.id,
    sessionId: row.sessione_id,
    materialId: row.materiale_id,
    code: row.codice,
    description: row.descrizione,
    brand: row.marca || '',
    category: row.categoria_id || '',
    unit: row.unita_misura || '',
    theoreticalQty: Number(row.quantita_teorica || 0),
    countedQty:
      row.quantita_contata === null || row.quantita_contata === undefined
        ? ''
        : Number(row.quantita_contata),
    difference: Number(row.differenza || 0),
    location: row.posizione || '',
    notes: row.note || '',
    counted: Boolean(row.contato),
    rectified: Boolean(row.rettificato),
    movementId: row.movimento_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  toRow: (model) =>
    clean({
      sessione_id: model.sessionId,
      materiale_id: model.materialId,
      codice: model.code,
      descrizione: model.description,
      marca: model.brand || null,
      categoria_id: model.category || null,
      unita_misura: model.unit || null,
      quantita_teorica: model.theoreticalQty || 0,
      quantita_contata:
        model.countedQty === '' || model.countedQty === null || model.countedQty === undefined
          ? null
          : Number(model.countedQty),
      differenza: Number(model.difference || 0),
      posizione: model.location || null,
      note: model.notes || null,
      contato: Boolean(model.counted),
      rettificato: Boolean(model.rectified),
      movimento_id: model.movementId || null,
      updated_at: model.updatedAt || new Date().toISOString(),
    }),
};

const mapInventorySession = {
  toModel: (row) => ({
    id: row.id,
    number: row.numero,
    title: row.titolo,
    status: row.stato || 'aperta',
    category: row.categoria_id || '',
    notes: row.note || '',
    userId: row.utente_id,
    userName: row.utente_nome || '',
    totalRows: Number(row.totale_righe || 0),
    countedRows: Number(row.righe_contate || 0),
    differences: Number(row.differenze || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    rows: Array.isArray(row.righe_inventario)
      ? row.righe_inventario.map(mapInventoryRow.toModel)
      : [],
  }),

  toRow: (model) =>
    clean({
      numero: model.number,
      titolo: model.title,
      stato: model.status || 'aperta',
      categoria_id: model.category || null,
      note: model.notes || null,
      // Firebase Auth usa UID testuali, Supabase fatture_importate.utente_id vuole UUID.
      // Se non è UUID valido, salvo null e tengo comunque il nome in utente_nome.
      utente_id:
        typeof model.userId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model.userId)
          ? model.userId
          : null,
      utente_nome: model.userName || null,
      totale_righe: model.totalRows || 0,
      righe_contate: model.countedRows || 0,
      differenze: model.differences || 0,
      updated_at: model.updatedAt || new Date().toISOString(),
      closed_at: model.closedAt || null,
    }),
};

// ============================================================
// STORES
// ============================================================

export const categoryStore = {
  async getAll() {
    const { data, error } = await supabase
      .from('categorie')
      .select('*')
      .order('nome');

    if (error) throw error;

    return data.map(mapCategory.toModel);
  },

  async create(category) {
    const { data, error } = await supabase
      .from('categorie')
      .insert(mapCategory.toRow(category))
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapCategory.toModel(data);
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('categorie')
      .update(mapCategory.toRow(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapCategory.toModel(data);
  },

  async delete(id) {
    const { error } = await supabase.from('categorie').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },
};

export const unitStore = {
  getAll() {
    const data = localStorage.getItem('wm_units');
    return data ? JSON.parse(data) : INITIAL_UNITS;
  },

  create(unit) {
    const curr = this.getAll();
    const next = [...curr, { id: Date.now(), ...unit }];

    localStorage.setItem('wm_units', JSON.stringify(next));

    return next[next.length - 1];
  },

  delete(id) {
    const next = this.getAll().filter((u) => u.id !== id);
    localStorage.setItem('wm_units', JSON.stringify(next));
  },
};

export const materialStore = {
  getStatus(material) {
    if (Number(material.quantity || 0) <= 0) return 'esaurito';

    if (Number(material.quantity || 0) <= Number(material.minThreshold || 0)) {
      return 'sotto_soglia';
    }

    return 'disponibile';
  },

  async getAll() {
    const { data, error } = await supabase
      .from('materiali')
      .select('*')
      .order('codice');

    if (error) throw error;

    return data.map(mapMaterial.toModel);
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('materiali')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return mapMaterial.toModel(data);
  },

  async getByCode(code) {
    const { data, error } = await supabase
      .from('materiali')
      .select('*')
      .eq('codice', code)
      .maybeSingle();

    if (error) throw error;

    return data ? mapMaterial.toModel(data) : null;
  },

  async create(material) {
    const row = mapMaterial.toRow(material);
    row.stato_disponibilita = this.getStatus(material);

    const { data, error } = await supabase
      .from('materiali')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    const model = mapMaterial.toModel(data);

    await this._checkThreshold(model);

    notifySupabaseUsageChanged();

    return model;
  },

  async update(id, updates) {
    if (updates.quantity !== undefined || updates.minThreshold !== undefined) {
      const mat = await this.getById(id);
      const merged = { ...mat, ...updates };
      updates.status = this.getStatus(merged);
    }

    const { data, error } = await supabase
      .from('materiali')
      .update(mapMaterial.toRow(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const model = mapMaterial.toModel(data);

    await this._checkThreshold(model);

    notifySupabaseUsageChanged();

    return model;
  },

  async delete(id) {
    const { error } = await supabase.from('materiali').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async deleteMany(ids = []) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];

    if (cleanIds.length === 0) {
      return { deleted: 0 };
    }

    for (const chunk of chunkArray(cleanIds, 100)) {
      const { error } = await supabase.from('materiali').delete().in('id', chunk);

      if (error) throw error;
    }

    notifySupabaseUsageChanged();

    return { deleted: cleanIds.length };
  },

  async deleteAll() {
    await supabase
      .from('notifiche')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('movimenti')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { error } = await supabase
      .from('materiali')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async _checkThreshold(material) {
    if (
      Number(material.quantity || 0) <= Number(material.minThreshold || 0) &&
      Number(material.minThreshold || 0) > 0
    ) {
      await notificationStore.create({
        materialId: material.id,
        type: 'sotto_soglia',
        read: false,
        message:
          Number(material.quantity || 0) <= 0
            ? `${material.code} - ${material.description}: ESAURITO (soglia: ${material.minThreshold})`
            : `${material.code} - ${material.description}: quantità (${material.quantity}) sotto soglia minima (${material.minThreshold})`,
      });
    }
  },
};

export const movementStore = {
  async _fetchAllMovements(buildQuery, { maxRows = 0 } = {}) {
    const pageSize = maxRows > 0 ? Math.min(1000, maxRows) : 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      const query = buildQuery()
        .order('data_movimento', { ascending: false })
        .range(from, from + pageSize - 1);

      const { data, error } = await query;

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      allRows = allRows.concat(rows);

      if (maxRows > 0 && allRows.length >= maxRows) {
        allRows = allRows.slice(0, maxRows);
        break;
      }

      if (rows.length < pageSize) break;

      from += pageSize;
    }

    return allRows.map(mapMovement.toModel);
  },

  async getAll() {
    return this._fetchAllMovements(() =>
      supabase
        .from('movimenti')
        .select(
          '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
        )
    );
  },

  async getByMaterial(materialId) {
    const { data, error } = await supabase
      .from('movimenti')
      .select(
        '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
      )
      .eq('materiale_id', materialId)
      .order('data_movimento', { ascending: false });

    if (error) throw error;

    return data.map(mapMovement.toModel);
  },

  async create(movement) {
    const mat = await materialStore.getById(movement.materialId);
    const previousQty = Number(mat.quantity || 0);

    let newQty = previousQty;

    if (movement.type === 'entrata' || movement.type === 'reintegro') {
      newQty = previousQty + Number(movement.quantity);
    } else if (movement.type === 'uscita') {
      newQty = previousQty - Number(movement.quantity);

      if (newQty < 0) {
        throw new Error('Quantità insufficiente');
      }
    } else if (movement.type === 'rettifica') {
      newQty = Number(movement.quantity);
    }

    await materialStore.update(mat.id, { quantity: newQty });

    const payload = mapMovement.toRow({
      ...movement,
      previousQty,
      newQty,
      operatorName: movement.operatorName || movement.userName || '',
    });

    const { data, error } = await supabase
      .from('movimenti')
      .insert(payload)
      .select(
        '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
      )
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapMovement.toModel(data);
  },

  async getRecent(limit = 10) {
    const { data, error } = await supabase
      .from('movimenti')
      .select('*, materiali(codice, descrizione, categoria_id), utenti(nome, username)')
      .order('data_movimento', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(mapMovement.toModel);
  },

  async getFiltered({ dateFrom, dateTo, userId, categoryId, materialId, type, limit = 0 } = {}) {
    let query = supabase
      .from('movimenti')
      .select(
        '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
      );

    if (dateFrom) query = query.gte('data_movimento', dateFrom);
    if (dateTo) query = query.lte('data_movimento', `${dateTo}T23:59:59`);
    if (userId) query = query.eq('utente_id', userId);
    if (materialId) query = query.eq('materiale_id', materialId);
    if (type) query = query.eq('tipo_movimento', type);

    let result = await this._fetchAllMovements(() => query, { maxRows: limit });

    if (categoryId) result = result.filter((m) => m.categoryId === categoryId);

    return result;
  },

  async deleteAll() {
    const { error } = await supabase
      .from('movimenti')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async getMostMoved(limit = 10, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recent = await this.getFiltered({
      dateFrom: cutoff.toISOString().slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
    });

    const counts = {};

    recent.forEach((m) => {
      const key = m.materialId || m.materialCode || m.materialDescription || 'N/A';

      if (!counts[key]) {
        counts[key] = {
          materialId: m.materialId || key,
          code: m.materialCode || 'N/A',
          description: m.materialDescription || 'N/A',
          totalMoved: 0,
        };
      }

      counts[key].totalMoved += Math.abs(Number(m.quantity || 0));
    });

    return Object.values(counts)
      .sort((a, b) => Number(b.totalMoved || 0) - Number(a.totalMoved || 0))
      .slice(0, limit);
  },

  async getEntriesVsExits(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await supabase
      .from('movimenti')
      .select('*')
      .gte('data_movimento', cutoff.toISOString());

    if (error) throw error;

    const stats = {};

    data.forEach((m) => {
      const day = m.data_movimento.substring(0, 10);

      if (!stats[day]) {
        stats[day] = { entries: 0, exits: 0 };
      }

      if (m.tipo_movimento === 'entrata' || m.tipo_movimento === 'reintegro') {
        stats[day].entries += Number(m.quantita || 0);
      }

      if (m.tipo_movimento === 'uscita') {
        stats[day].exits += Number(m.quantita || 0);
      }
    });

    return Object.entries(stats)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, vals]) => ({ date, ...vals }));
  },
};

export const userStore = {
  async getAll() {
    const { data, error } = await supabase
      .from('utenti')
      .select('*')
      .order('nome');

    if (error) throw error;

    return data.map(mapUser.toModel);
  },

  async authenticate(email, password) {
    return authStore.authenticate(email, password);
  },

  getCurrentUser() {
    return authStore.getCurrentUser();
  },

  setCurrentUser(user) {
    authStore.setCurrentUser(user);
  },

  logout() {
    authStore.logout();
  },

  async create(user) {
    if (!user?.email && !user?.username) {
      throw new Error('Email obbligatoria per creare un utente.');
    }

    if (!user?.password) {
      throw new Error('Password obbligatoria per creare un nuovo utente.');
    }

    // 1. Crea o aggiorna l'utente in Firebase Auth + Firestore tramite backend Vercel.
    const created = await createFirebaseUserFromAdmin(user);

    // 2. Mantiene una copia compatibile nella vecchia tabella Supabase "utenti",
    // così la schermata Gestione Utenti continua a mostrare subito il nuovo utente.
    const compatibilityUser = {
      ...user,
      username: user.username || created.email,
      fullName: user.fullName || created.fullName,
      email: created.email,
      role: normalizeRole(user.role || created.role),
      active: user.active !== undefined ? Boolean(user.active) : true,
      permissions:
        user.permissions && typeof user.permissions === 'object'
          ? user.permissions
          : {},
    };

    const row = mapUser.toRow(compatibilityUser);

    if (row.password) {
      row.password = await hashPassword(row.password);
    }

    let supabaseUser = null;

    try {
      const { data: existing, error: existingError } = await supabase
        .from('utenti')
        .select('id')
        .eq('username', row.username)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { data, error } = await supabase
          .from('utenti')
          .update({
            ...row,
            attivo: row.attivo ?? true,
            permessi: row.permessi ?? {},
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        supabaseUser = data;
      } else {
        const { data, error } = await supabase
          .from('utenti')
          .insert({
            ...row,
            attivo: row.attivo ?? true,
            permessi: row.permessi ?? {},
          })
          .select()
          .single();

        if (error) throw error;
        supabaseUser = data;
      }
    } catch (error) {
      console.warn('Utente creato in Firebase, ma copia Supabase non salvata:', error);
    }

    notifySupabaseUsageChanged();

    if (supabaseUser) {
      return mapUser.toModel(supabaseUser);
    }

    return {
      id: created.uid,
      uid: created.uid,
      authUid: created.uid,
      companyId: created.companyId,
      company_id: created.companyId,
      username: compatibilityUser.username,
      email: created.email,
      fullName: created.fullName,
      role: normalizeRole(created.role),
      active: true,
      permissions: compatibilityUser.permissions,
      createdAt: new Date().toISOString(),
    };
  },

  async update(id, updates) {
    const row = mapUser.toRow(updates);

    if (row.password) {
      row.password = await hashPassword(row.password);
    }

    const { data, error } = await supabase
      .from('utenti')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const updatedUser = mapUser.toModel(data);

    const currentUser = this.getCurrentUser();
    if (currentUser?.id === updatedUser.id) {
      this.setCurrentUser(updatedUser);
    }

    notifySupabaseUsageChanged();

    return updatedUser;
  },

  async delete(id) {
    const { data: existingUser, error: readError } = await supabase
      .from('utenti')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (readError) throw readError;

    if (existingUser) {
      try {
        await deleteFirebaseUserFromAdmin(mapUser.toModel(existingUser));
      } catch (error) {
        console.warn('Utente non eliminato da Firebase/Auth oppure già assente:', error);
      }
    }

    const { error } = await supabase.from('utenti').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },
};

export const notificationStore = {
  async getAll() {
    const { data, error } = await supabase
      .from('notifiche')
      .select('*, materiali(codice, descrizione, quantita, soglia_minima)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(mapNotification.toModel);
  },

  async getUnread() {
    const { data, error } = await supabase
      .from('notifiche')
      .select('*, materiali(codice, descrizione, quantita, soglia_minima)')
      .eq('letta', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return data.map(mapNotification.toModel);
  },

  async create(notification) {
    const { data: existing } = await supabase
      .from('notifiche')
      .select('id')
      .eq('materiale_id', notification.materialId)
      .eq('tipo', notification.type)
      .eq('letta', false);

    if (existing && existing.length > 0) return null;

    const { data, error } = await supabase
      .from('notifiche')
      .insert(mapNotification.toRow(notification))
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return data;
  },

  async markRead(id) {
    if (!id) {
      throw new Error('ID notifica mancante.');
    }

    const { error } = await supabase
      .from('notifiche')
      .update({ letta: true })
      .eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async markAllRead() {
    const { error } = await supabase
      .from('notifiche')
      .update({ letta: true })
      .eq('letta', false);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async delete(id) {
    if (!id) {
      throw new Error('ID notifica mancante.');
    }

    const { error } = await supabase.from('notifiche').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();

    return {
      deleted: 1,
    };
  },

  async deleteRead() {
    const { data: readRows, error: readError } = await supabase
      .from('notifiche')
      .select('id')
      .eq('letta', true);

    if (readError) throw readError;

    const ids = (readRows || []).map((row) => row.id).filter(Boolean);

    if (ids.length === 0) {
      return {
        deleted: 0,
      };
    }

    for (const chunk of chunkArray(ids, 100)) {
      const { error } = await supabase.from('notifiche').delete().in('id', chunk);

      if (error) throw error;
    }

    notifySupabaseUsageChanged();

    return {
      deleted: ids.length,
    };
  },

  async deleteAll() {
    const { data: rows, error: readError } = await supabase
      .from('notifiche')
      .select('id');

    if (readError) throw readError;

    const ids = (rows || []).map((row) => row.id).filter(Boolean);

    if (ids.length === 0) {
      return {
        deleted: 0,
      };
    }

    for (const chunk of chunkArray(ids, 100)) {
      const { error } = await supabase.from('notifiche').delete().in('id', chunk);

      if (error) throw error;
    }

    notifySupabaseUsageChanged();

    return {
      deleted: ids.length,
    };
  },
};

export const adminLogStore = {
  async getAll(limit = 500) {
    const { data, error } = await supabase
      .from('log_modifiche')
      .select('*, utenti(nome)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(mapLog.toModel);
  },

  async create(log) {
    const { error } = await supabase
      .from('log_modifiche')
      .insert(mapLog.toRow(log));

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async getRecent(limit = 100) {
    const { data, error } = await supabase
      .from('log_modifiche')
      .select('*, utenti(nome)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(mapLog.toModel);
  },

  async deleteAll() {
    const { error } = await supabase
      .from('log_modifiche')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;

    notifySupabaseUsageChanged();
  },
};

export const invoiceImportStore = {
  bucketName: 'fatture',

  async findDuplicateFile(file) {
    if (!file) return null;

    const normalizeInvoiceName = (value = '') =>
      String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const currentName = normalizeInvoiceName(file.name);
    const currentSize = Number(file.size || 0);

    const { data, error } = await supabase
      .from('fatture_importate')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    const duplicate = rows.find((row) => {
      const originalName = normalizeInvoiceName(row.nome_file_originale);
      const storedName = normalizeInvoiceName(row.nome_file);
      const storedSize = Number(row.dimensione_file || 0);

      const sameOriginalName = originalName && originalName === currentName;
      const sameStoredName = storedName && storedName === currentName;
      const sameSize = currentSize > 0 && storedSize > 0 && currentSize === storedSize;

      // Stessa fattura probabile:
      // - stesso nome originale
      // - oppure stesso nome salvato
      // - oppure stesso nome e stessa dimensione
      return sameOriginalName || sameStoredName || ((sameOriginalName || sameStoredName) && sameSize);
    });

    return duplicate ? mapImportedInvoice.toModel(duplicate) : null;
  },

  async uploadOriginalFile(file, user) {
    if (!file) {
      throw new Error('Nessun file da salvare.');
    }

    const filePath = buildInvoiceStoragePath(file.name);

    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('fatture_importate')
      .insert(
        mapImportedInvoice.toRow({
          fileName: sanitizeStorageFileName(file.name),
          originalFileName: file.name,
          filePath,
          bucket: this.bucketName,
          fileSize: file.size || 0,
          fileType: file.type || '',
          userId: user?.id || null,
          userName: user?.fullName || user?.username || '',
          status: 'caricata',
          detectedItems: 0,
          createdItems: 0,
          updatedItems: 0,
          errors: null,
        })
      )
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapImportedInvoice.toModel(data);
  },

  async update(id, updates) {
    if (!id) return null;

    const { data, error } = await supabase
      .from('fatture_importate')
      .update(mapImportedInvoice.toRow(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapImportedInvoice.toModel(data);
  },

  async markAnalyzed(id, detectedItems = 0) {
    return this.update(id, {
      status: 'analizzata',
      detectedItems,
    });
  },

  async markCompleted(
    id,
    {
      detectedItems = 0,
      createdItems = 0,
      updatedItems = 0,
      errors = [],
      supplier = '',
      fornitore = '',
    } = {}
  ) {
    return this.update(id, {
      status: errors.length > 0 ? 'completata_con_errori' : 'completata',
      detectedItems,
      createdItems,
      updatedItems,
      errors: errors.length > 0 ? errors.join('\n') : null,
      supplier: supplier || fornitore || '',
    });
  },

  async markError(id, errorMessage) {
    return this.update(id, {
      status: 'errore',
      errors: errorMessage || 'Errore sconosciuto',
    });
  },

  async getAll(limit = 300) {
    const { data, error } = await supabase
      .from('fatture_importate')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(mapImportedInvoice.toModel);
  },

  async getById(id) {
    if (!id) {
      throw new Error('ID fattura mancante.');
    }

    const { data, error } = await supabase
      .from('fatture_importate')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return mapImportedInvoice.toModel(data);
  },

  async getByIds(ids = []) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];

    if (cleanIds.length === 0) return [];

    const { data, error } = await supabase
      .from('fatture_importate')
      .select('*')
      .in('id', cleanIds);

    if (error) throw error;

    return data.map(mapImportedInvoice.toModel);
  },

  async getSignedUrl(filePath, expiresIn = 60 * 10) {
    if (!filePath) {
      throw new Error('Percorso file mancante.');
    }

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;

    return data?.signedUrl || '';
  },

  async deleteWithFile(id) {
    if (!id) {
      throw new Error('ID fattura mancante.');
    }

    const result = await this.deleteManyWithFiles([id]);

    return {
      invoiceDeleted: result.invoicesDeleted === 1,
      fileDeleted: result.filesDeleted > 0,
      fileErrors: result.fileErrors,
      invoice: result.invoices?.[0] || null,
    };
  },

  async deleteManyWithFiles(ids = []) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];

    if (cleanIds.length === 0) {
      return {
        invoices: [],
        invoicesDeleted: 0,
        filesRequested: 0,
        filesDeleted: 0,
        fileErrors: [],
      };
    }

    const invoices = await this.getByIds(cleanIds);

    if (invoices.length === 0) {
      return {
        invoices: [],
        invoicesDeleted: 0,
        filesRequested: 0,
        filesDeleted: 0,
        fileErrors: [],
      };
    }

    const filesByBucket = invoices.reduce((groups, invoice) => {
      if (!invoice.filePath) return groups;

      const bucket = invoice.bucket || this.bucketName;

      if (!groups[bucket]) groups[bucket] = new Set();
      groups[bucket].add(invoice.filePath);

      return groups;
    }, {});

    let filesDeleted = 0;
    const fileErrors = [];

    for (const [bucket, pathSet] of Object.entries(filesByBucket)) {
      const paths = [...pathSet];

      for (const chunk of chunkArray(paths, 100)) {
        const { data, error } = await supabase.storage.from(bucket).remove(chunk);

        if (error) {
          fileErrors.push(`${bucket}: ${error.message}`);
        } else {
          filesDeleted += Array.isArray(data) ? data.length : chunk.length;
        }
      }
    }

    if (fileErrors.length > 0) {
      throw new Error(
        `Eliminazione file Storage non completata. Nessun record è stato cancellato dal database.\n${fileErrors.join('\n')}`
      );
    }

    const idsToDelete = invoices.map((invoice) => invoice.id);

    const { error: deleteRecordError } = await supabase
      .from('fatture_importate')
      .delete()
      .in('id', idsToDelete);

    if (deleteRecordError) throw deleteRecordError;

    notifySupabaseUsageChanged();

    return {
      invoices,
      invoicesDeleted: invoices.length,
      filesRequested: Object.values(filesByBucket).reduce((sum, set) => sum + set.size, 0),
      filesDeleted,
      fileErrors,
    };
  },

  async deleteAllWithFiles() {
    const invoices = await this.getAll();
    return this.deleteManyWithFiles(invoices.map((invoice) => invoice.id));
  },
};


export const priceHistoryStore = {
  async create(entry) {
    if (!entry?.materialId && !entry?.code) return null;

    const { data, error } = await supabase
      .from('storico_prezzi')
      .insert(
        clean({
          materiale_id: entry.materialId || null,
          codice: entry.code || '',
          descrizione: entry.description || '',
          fornitore: entry.supplier || entry.fornitore || '',
          prezzo_netto: Number(entry.netPrice || entry.price || 0),
          quantita: Number(entry.quantity || 0),
          origine: entry.origin || entry.origine || '',
          documento: entry.document || entry.documento || '',
          utente_nome: entry.userName || entry.utenteNome || '',
          data_registrazione: entry.date || new Date().toISOString(),
        })
      )
      .select()
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return {
      id: data.id,
      materialId: data.materiale_id,
      code: data.codice,
      description: data.descrizione,
      supplier: data.fornitore,
      netPrice: Number(data.prezzo_netto || 0),
      quantity: Number(data.quantita || 0),
      origin: data.origine,
      document: data.documento,
      userName: data.utente_nome,
      date: data.data_registrazione,
      createdAt: data.created_at,
    };
  },

  async getAll(limit = 1000) {
    const { data, error } = await supabase
      .from('storico_prezzi')
      .select('*')
      .order('data_registrazione', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      materialId: row.materiale_id,
      code: row.codice,
      description: row.descrizione,
      supplier: row.fornitore,
      netPrice: Number(row.prezzo_netto || 0),
      quantity: Number(row.quantita || 0),
      origin: row.origine,
      document: row.documento,
      userName: row.utente_nome,
      date: row.data_registrazione,
      createdAt: row.created_at,
    }));
  },

  async getByMaterialId(materialId) {
    if (!materialId) return [];

    const { data, error } = await supabase
      .from('storico_prezzi')
      .select('*')
      .eq('materiale_id', materialId)
      .order('data_registrazione', { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      materialId: row.materiale_id,
      code: row.codice,
      description: row.descrizione,
      supplier: row.fornitore,
      netPrice: Number(row.prezzo_netto || 0),
      quantity: Number(row.quantita || 0),
      origin: row.origine,
      document: row.documento,
      userName: row.utente_nome,
      date: row.data_registrazione,
      createdAt: row.created_at,
    }));
  },

  async delete(id) {
    if (!id) {
      throw new Error('ID storico prezzo mancante.');
    }

    const { error } = await supabase.from('storico_prezzi').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },

  async deleteMany(ids = []) {
    const cleanIds = [...new Set((ids || []).filter(Boolean))];

    if (cleanIds.length === 0) {
      return { deleted: 0 };
    }

    for (const chunk of chunkArray(cleanIds, 100)) {
      const { error } = await supabase.from('storico_prezzi').delete().in('id', chunk);

      if (error) throw error;
    }

    notifySupabaseUsageChanged();

    return { deleted: cleanIds.length };
  },

  async getByCode(code) {
    if (!code) return [];

    const { data, error } = await supabase
      .from('storico_prezzi')
      .select('*')
      .ilike('codice', code)
      .order('data_registrazione', { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      materialId: row.materiale_id,
      code: row.codice,
      description: row.descrizione,
      supplier: row.fornitore,
      netPrice: Number(row.prezzo_netto || 0),
      quantity: Number(row.quantita || 0),
      origin: row.origine,
      document: row.documento,
      userName: row.utente_nome,
      date: row.data_registrazione,
      createdAt: row.created_at,
    }));
  },
};


export const reorderProposalStore = {
  getSuggestedQty(material, multiplier = 2) {
    const current = Number(material.quantity || 0);
    const threshold = Number(material.minThreshold || 0);
    const safeMultiplier = Math.max(1, Number(multiplier || 2));
    const target = Math.max(threshold * safeMultiplier, threshold + 1);

    return Math.max(0, Math.ceil(target - current));
  },

  async getUnderThresholdMaterials({ categoryId = '', supplier = '' } = {}) {
    const materials = await materialStore.getAll();

    return materials
      .filter((m) => {
        const threshold = Number(m.minThreshold || 0);
        const quantity = Number(m.quantity || 0);
        const matchThreshold = threshold > 0 && quantity <= threshold;
        const matchCategory = !categoryId || m.category === categoryId;
        const matchSupplier =
          !supplier ||
          String(m.supplier || '').toLowerCase().includes(String(supplier).toLowerCase());

        return matchThreshold && matchCategory && matchSupplier;
      })
      .sort((a, b) => {
        const supplierA = String(a.supplier || 'Senza fornitore');
        const supplierB = String(b.supplier || 'Senza fornitore');
        const supplierCompare = supplierA.localeCompare(supplierB);

        if (supplierCompare !== 0) return supplierCompare;

        return String(a.code || '').localeCompare(String(b.code || ''));
      });
  },

  async getAll(limit = 300) {
    const { data, error } = await supabase
      .from('proposte_ordine')
      .select('*, righe_proposta_ordine(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(mapReorderProposal.toModel);
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('proposte_ordine')
      .select('*, righe_proposta_ordine(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return mapReorderProposal.toModel(data);
  },

  async createFromMaterials({ materials = [], user, notes = '', multiplier = 2 } = {}) {
    const validMaterials = (materials || []).filter(
      (m) => this.getSuggestedQty(m, multiplier) > 0
    );

    if (validMaterials.length === 0) {
      throw new Error('Nessun materiale sotto soglia da inserire in proposta.');
    }

    const supplierGroups = validMaterials.reduce((groups, material) => {
      const key = material.supplier?.trim() || 'Senza fornitore';

      if (!groups[key]) groups[key] = [];
      groups[key].push(material);

      return groups;
    }, {});

    const created = [];

    for (const [supplierName, groupMaterials] of Object.entries(supplierGroups)) {
      const totalQty = groupMaterials.reduce(
        (sum, material) => sum + this.getSuggestedQty(material, multiplier),
        0
      );

      const now = new Date();
      const number = `PO-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(
        Date.now()
      ).slice(-6)}`;

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposte_ordine')
        .insert(
          mapReorderProposal.toRow({
            number,
            supplier: supplierName,
            status: 'aperta',
            notes,
            userId: user?.id || null,
            userName: user?.fullName || user?.username || '',
            totalRows: groupMaterials.length,
            totalQuantity: totalQty,
          })
        )
        .select()
        .single();

      if (proposalError) throw proposalError;

      const proposal = mapReorderProposal.toModel(proposalData);

      const rows = groupMaterials.map((material) =>
        mapReorderProposalRow.toRow({
          proposalId: proposal.id,
          materialId: material.id,
          code: material.code,
          description: material.description,
          brand: material.brand,
          category: material.category,
          unit: material.unit,
          currentQty: material.quantity,
          minThreshold: material.minThreshold,
          suggestedQty: this.getSuggestedQty(material, multiplier),
          supplier: supplierName,
          location: material.location,
          notes: '',
        })
      );

      const { error: rowsError } = await supabase.from('righe_proposta_ordine').insert(rows);

      if (rowsError) throw rowsError;

      created.push(await this.getById(proposal.id));
    }

    notifySupabaseUsageChanged();

    return created;
  },

  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('proposte_ordine')
      .update({
        stato: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, righe_proposta_ordine(*)')
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapReorderProposal.toModel(data);
  },

  async delete(id) {
    const { error } = await supabase.from('proposte_ordine').delete().eq('id', id);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },
};

export const physicalInventoryStore = {
  async getAllSessions(limit = 100) {
    const { data, error } = await supabase
      .from('sessioni_inventario')
      .select('*, righe_inventario(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(mapInventorySession.toModel);
  },

  async getSessionById(id) {
    const { data, error } = await supabase
      .from('sessioni_inventario')
      .select('*, righe_inventario(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    const session = mapInventorySession.toModel(data);

    session.rows = session.rows.sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''))
    );

    return session;
  },

  async createSession({ title, category = '', notes = '', user } = {}) {
    const materials = await materialStore.getAll();
    const filteredMaterials = category
      ? materials.filter((m) => m.category === category)
      : materials;

    if (filteredMaterials.length === 0) {
      throw new Error('Nessun materiale disponibile per creare la sessione inventario.');
    }

    const now = new Date();
    const number = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(
      Date.now()
    ).slice(-6)}`;

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessioni_inventario')
      .insert(
        mapInventorySession.toRow({
          number,
          title: title || `Inventario ${now.toLocaleDateString('it-IT')}`,
          status: 'aperta',
          category: category || null,
          notes,
          userId: user?.id || null,
          userName: user?.fullName || user?.username || '',
          totalRows: filteredMaterials.length,
          countedRows: 0,
          differences: 0,
        })
      )
      .select()
      .single();

    if (sessionError) throw sessionError;

    const session = mapInventorySession.toModel(sessionData);

    const rows = filteredMaterials.map((material) =>
      mapInventoryRow.toRow({
        sessionId: session.id,
        materialId: material.id,
        code: material.code,
        description: material.description,
        brand: material.brand,
        category: material.category,
        unit: material.unit,
        theoreticalQty: material.quantity,
        countedQty: null,
        difference: 0,
        location: material.location,
        notes: '',
        counted: false,
        rectified: false,
      })
    );

    for (const chunk of chunkArray(rows, 100)) {
      const { error: rowsError } = await supabase.from('righe_inventario').insert(chunk);

      if (rowsError) throw rowsError;
    }

    notifySupabaseUsageChanged();

    return this.getSessionById(session.id);
  },

  async updateCount(rowId, countedQty, notes = '') {
    const { data: currentRow, error: readError } = await supabase
      .from('righe_inventario')
      .select('*')
      .eq('id', rowId)
      .single();

    if (readError) throw readError;

    const theoreticalQty = Number(currentRow.quantita_teorica || 0);
    const cleanCounted = Number(countedQty || 0);
    const difference = cleanCounted - theoreticalQty;

    const { data, error } = await supabase
      .from('righe_inventario')
      .update({
        quantita_contata: cleanCounted,
        differenza: difference,
        note: notes || null,
        contato: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowId)
      .select()
      .single();

    if (error) throw error;

    await this.recalculateSession(currentRow.sessione_id);

    notifySupabaseUsageChanged();

    return mapInventoryRow.toModel(data);
  },

  async recalculateSession(sessionId) {
    const { data: rows, error } = await supabase
      .from('righe_inventario')
      .select('*')
      .eq('sessione_id', sessionId);

    if (error) throw error;

    const countedRows = (rows || []).filter((row) => row.contato).length;
    const differences = (rows || []).filter(
      (row) => Number(row.differenza || 0) !== 0
    ).length;

    const { error: updateError } = await supabase
      .from('sessioni_inventario')
      .update({
        righe_contate: countedRows,
        differenze: differences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;
  },

  async applyRectifications(sessionId, user) {
    const session = await this.getSessionById(sessionId);
    const rowsToRectify = session.rows.filter(
      (row) => row.counted && !row.rectified && Number(row.difference || 0) !== 0
    );

    if (rowsToRectify.length === 0) {
      throw new Error('Nessuna differenza da rettificare.');
    }

    for (const row of rowsToRectify) {
      const movement = await movementStore.create({
        materialId: row.materialId,
        type: 'rettifica',
        quantity: Number(row.countedQty || 0),
        reason: 'inventario_fisico',
        notes: `Rettifica da inventario fisico ${session.number || session.title}. Teorica: ${
          row.theoreticalQty
        }, contata: ${row.countedQty}, differenza: ${row.difference}. ${row.notes || ''}`,
        userId: user?.id,
        userName: user?.fullName || user?.username || '',
        operatorName: user?.fullName || user?.username || 'Inventario fisico',
        clientName: '',
        authorizedBy: user?.fullName || user?.username || '',
      });

      const { error } = await supabase
        .from('righe_inventario')
        .update({
          rettificato: true,
          movimento_id: movement.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (error) throw error;
    }

    const { error: sessionError } = await supabase
      .from('sessioni_inventario')
      .update({
        stato: 'rettificata',
        updated_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionError) throw sessionError;

    notifySupabaseUsageChanged();

    return this.getSessionById(sessionId);
  },

  async closeSession(sessionId) {
    const { data, error } = await supabase
      .from('sessioni_inventario')
      .update({
        stato: 'chiusa',
        updated_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select('*, righe_inventario(*)')
      .single();

    if (error) throw error;

    notifySupabaseUsageChanged();

    return mapInventorySession.toModel(data);
  },

  async deleteSession(sessionId) {
    const { error } = await supabase
      .from('sessioni_inventario')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;

    notifySupabaseUsageChanged();
  },
};

export const statsStore = {
  async getDashboardStats() {
    const materials = await materialStore.getAll();
    const categories = await categoryStore.getAll();
    const notificationsAll = await notificationStore.getAll();
    const recentMovements = await movementStore.getRecent(8);

    const today = new Date().toISOString().substring(0, 10);

    const todayRows = await movementStore.getFiltered({
      dateFrom: today,
      dateTo: today,
    });

    const todayMovements = Array.isArray(todayRows) ? todayRows.length : 0;

    const belowThreshold = materials.filter(
      (m) =>
        Number(m.quantity || 0) <= Number(m.minThreshold || 0) &&
        Number(m.minThreshold || 0) > 0 &&
        Number(m.quantity || 0) > 0
    );

    const exhausted = materials.filter((m) => Number(m.quantity || 0) <= 0);
    const unreadNotifications = notificationsAll.filter((n) => !n.read).length;

    return {
      totalMaterials: materials.length,
      belowThresholdCount: belowThreshold.length,
      exhaustedCount: exhausted.length,
      totalCategories: categories.length,
      todayMovements,
      unreadNotifications,
      recentMovements,
      belowThreshold,
      exhausted,
      notifications: notificationsAll.slice(0, 5),
      categoryDistribution: this._getCategoryDistribution(materials, categories),
    };
  },

  _getCategoryDistribution(materials, categories) {
    const dist = {};

    materials.forEach((m) => {
      const catName =
        categories.find((c) => c.id === m.category)?.name ||
        m.category ||
        'Altro';

      dist[catName] = (dist[catName] || 0) + 1;
    });

    return Object.entries(dist).map(([name, count]) => ({ name, count }));
  },
};

// DEBUG PERFORMANCE STORE - temporaneo per beta test
if (typeof window !== 'undefined' && !window.__WM_STORE_PERF_PATCHED__) {
  window.__WM_STORE_PERF_PATCHED__ = true;

  const patchStorePerf = (storeName, storeObject) => {
    if (!storeObject || typeof storeObject !== 'object') return;

    Object.keys(storeObject).forEach((key) => {
      const original = storeObject[key];

      if (typeof original !== 'function') return;
      if (original.__perfWrapped) return;

      const wrapped = async function wrappedStoreCall(...args) {
        const label = `[STORE PERF] ${storeName}.${key}`;
        const start = performance.now();

        try {
          const result = await original.apply(this, args);
          const end = performance.now();
          const ms = Math.round(end - start);

          let count = '';
          if (Array.isArray(result)) count = ` | rows=${result.length}`;
          if (result && Array.isArray(result.data)) count = ` | rows=${result.data.length}`;

          if (ms >= 300) {
            console.warn(`${label} ${ms}ms${count}`, args);
          } else {
            console.info(`${label} ${ms}ms${count}`, args);
          }

          return result;
        } catch (error) {
          const end = performance.now();
          console.error(`${label} ERRORE ${Math.round(end - start)}ms`, error);
          throw error;
        }
      };

      wrapped.__perfWrapped = true;
      storeObject[key] = wrapped;
    });
  };

  setTimeout(() => {
    try {
      patchStorePerf('materialStore', materialStore);
      patchStorePerf('categoryStore', categoryStore);
      patchStorePerf('movementStore', movementStore);
      patchStorePerf('notificationStore', notificationStore);
      patchStorePerf('userStore', userStore);
      patchStorePerf('logStore', typeof logStore !== 'undefined' ? logStore : null);
      patchStorePerf('invoiceImportStore', typeof invoiceImportStore !== 'undefined' ? invoiceImportStore : null);
      patchStorePerf('reorderProposalStore', typeof reorderProposalStore !== 'undefined' ? reorderProposalStore : null);
      patchStorePerf('statsStore', typeof statsStore !== 'undefined' ? statsStore : null);
    } catch (error) {
      console.warn('[STORE PERF] patch non applicata completamente', error);
    }
  }, 0);
}

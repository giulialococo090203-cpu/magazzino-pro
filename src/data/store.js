// ============================================================
// STORE.JS - Data Management Layer (Supabase Integration)
// ============================================================

import { supabase } from '../supabaseClient';
import { INITIAL_UNITS } from './initialData';

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
  }),

  toRow: (model) =>
    clean({
      materiale_id: model.materialId,
      tipo_movimento: model.type,
      quantita: model.quantity,
      motivo: model.reason,
      note: model.notes,
      utente_id: model.userId,
      data_movimento: model.date || new Date().toISOString(),
      cliente_nome: model.clientName || null,
      autorizzato_da: model.authorizedBy || null,
      operatore_nome: model.operatorName || null,
      previous_qty: model.previousQty ?? null,
      new_qty: model.newQty ?? null,
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
      utente_id: model.userId,
      entita: model.entity,
      entita_id: model.entityId,
      azione: model.action,
      descrizione: model.details,
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

    return mapCategory.toModel(data);
  },

  async delete(id) {
    const { error } = await supabase.from('categorie').delete().eq('id', id);

    if (error) throw error;
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

    return model;
  },

  async delete(id) {
    const { error } = await supabase.from('materiali').delete().eq('id', id);

    if (error) throw error;
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
  async getAll() {
    const { data, error } = await supabase
      .from('movimenti')
      .select(
        '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
      )
      .order('data_movimento', { ascending: false });

    if (error) throw error;

    return data.map(mapMovement.toModel);
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

  async getFiltered({ dateFrom, dateTo, userId, categoryId, materialId, type } = {}) {
    let query = supabase
      .from('movimenti')
      .select(
        '*, materiali(codice, descrizione, categoria_id, quantita, soglia_minima), utenti(nome, username)'
      );

    if (dateFrom) query = query.gte('data_movimento', dateFrom);
    if (dateTo) query = query.lte('data_movimento', `${dateTo}T23:59:59`);
    if (userId) query = query.eq('utente_id', userId);
    if (type) query = query.eq('tipo_movimento', type);

    const { data, error } = await query.order('data_movimento', {
      ascending: false,
    });

    if (error) throw error;

    let result = data.map(mapMovement.toModel);

    if (categoryId) result = result.filter((m) => m.categoryId === categoryId);
    if (materialId) result = result.filter((m) => m.materialId === materialId);

    return result;
  },

  async getMostMoved(limit = 10) {
    const all = await this.getAll();
    const counts = {};

    all.forEach((m) => {
      counts[m.materialId] = (counts[m.materialId] || 0) + Number(m.quantity || 0);
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, total]) => {
        const mov = all.find((m) => m.materialId === id);

        return {
          materialId: id,
          code: mov?.materialCode || 'N/A',
          description: mov?.materialDescription || 'N/A',
          totalMoved: total,
        };
      });
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

  async authenticate(username, password) {
    const trimmedUsername = username.trim();
    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase
      .from('utenti')
      .select('*')
      .ilike('username', trimmedUsername)
      .eq('password', hashedPassword)
      .eq('attivo', true)
      .maybeSingle();

    if (error) {
      console.warn('Login fallito per:', trimmedUsername, error.message);
      return null;
    }

    if (!data) {
      console.warn('Login fallito per:', trimmedUsername, 'nessun utente trovato');
      return null;
    }

    const user = mapUser.toModel(data);

    localStorage.setItem('wm_current_user', JSON.stringify(user));

    return user;
  },

  getCurrentUser() {
    const data = localStorage.getItem('wm_current_user');
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem('wm_current_user');
      return;
    }

    localStorage.setItem('wm_current_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('wm_current_user');
  },

  async create(user) {
    const row = mapUser.toRow(user);

    if (row.password) {
      row.password = await hashPassword(row.password);
    }

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

    return mapUser.toModel(data);
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

    return updatedUser;
  },

  async delete(id) {
    const { error } = await supabase.from('utenti').delete().eq('id', id);

    if (error) throw error;
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
    const all = await this.getAll();

    return all.filter((n) => !n.read);
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

    return data;
  },

  async markRead(id) {
    const { error } = await supabase
      .from('notifiche')
      .update({ letta: true })
      .eq('id', id);

    if (error) throw error;
  },

  async markAllRead() {
    const { error } = await supabase
      .from('notifiche')
      .update({ letta: true })
      .eq('letta', false);

    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase.from('notifiche').delete().eq('id', id);

    if (error) throw error;
  },
};

export const adminLogStore = {
  async getAll() {
    const { data, error } = await supabase
      .from('log_modifiche')
      .select('*, utenti(nome)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(mapLog.toModel);
  },

  async create(log) {
    const { error } = await supabase
      .from('log_modifiche')
      .insert(mapLog.toRow(log));

    if (error) throw error;
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
};

export const statsStore = {
  async getDashboardStats() {
    const materials = await materialStore.getAll();
    const categories = await categoryStore.getAll();
    const notificationsAll = await notificationStore.getAll();
    const recentMovements = await movementStore.getRecent(8);
    const allMovements = await movementStore.getAll();

    const today = new Date().toISOString().substring(0, 10);
    const todayMovements = allMovements.filter(
      (m) => String(m.date || '').substring(0, 10) === today
    ).length;

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
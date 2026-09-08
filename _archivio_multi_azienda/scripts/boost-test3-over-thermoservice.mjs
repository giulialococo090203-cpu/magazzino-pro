import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const tenant = {
  id: 'cl_test3',
  name: 'Vivaio Agricolo Girasole',
  prefix: 'AGRI-SUPER',
  categoryPrefix: 'Mega Reparto Agricolo',
  words: [
    'Serra modulare professionale',
    'Centralina irrigazione smart',
    'Sensore umidità terreno',
    'Substrato drenante premium',
    'Concime organico pellettato',
    'Semi professionali orticole',
    'Nebulizzatore alta pressione',
    'Kit fertirrigazione vivaio',
    'Telo pacciamatura biodegradabile',
    'Vaso vivaio quadro grande',
    'Cassetta alveolare semina',
    'Tubo polietilene agricolo',
    'Elettrovalvola irrigazione',
    'Filtro acqua impianto goccia',
    'Pompa sommersa irrigazione',
    'Rete antigrandine rinforzata',
    'Telo ombreggiante serra',
    'Guanti antitaglio agricoli',
    'Forbice innesto professionale',
    'Sega potatura telescopica',
    'Terriccio agrumi professionale',
    'Fertilizzante olivo granulare',
    'Miscela prato sportivo',
    'Trappola feromoni insetti',
    'Disabituante naturale talpe',
    'Kit analisi pH terreno',
    'Sacco corteccia decorativa',
    'Lapillo vulcanico granulare',
    'Argilla espansa drenante',
    'Piantina ornamentale stagionale',
  ],
  brands: [
    'Compo',
    'Vigorplant',
    'Claber',
    'Stocker',
    'VerdeMax',
    'Cifo',
    'Flortis',
    'Geolia',
    'Fito',
    'Bayer Garden',
    'Netafim',
    'Rain Bird',
  ],
  suppliers: [
    'Agraria Toscana',
    'Vivaio Centro Verde',
    'Irrigazione Italia',
    'Semi & Natura',
    'Garden Tools Pro',
    'Fertil Green',
    'Floricoltura Tirreno',
    'Serre Italia',
    'Agro Service Bulk',
  ],
  locations: [
    'AGRI-Z1',
    'AGRI-Z2',
    'AGRI-Y1',
    'AGRI-Y2',
    'AGRI-X1',
    'AGRI-X2',
    'AGRI-W1',
    'AGRI-W2',
    'AGRI-V1',
    'AGRI-V2',
  ],
};

const TARGETS = {
  categorie: 60,
  materiali: 10000,
  movimenti: 50000,
  notifiche: 250,
};

function randomFrom(list, index) {
  return list[index % list.length];
}

function statusFor(qty, threshold) {
  if (Number(qty || 0) <= 0) return 'esaurito';
  if (Number(qty || 0) <= Number(threshold || 0)) return 'sotto_soglia';
  return 'disponibile';
}

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('azienda_id', tenant.id);

  if (error) throw error;
  return Number(count || 0);
}

async function assertCompanyExists() {
  const { data, error } = await supabase
    .from('aziende')
    .select('id, nome, codice, piano, max_utenti')
    .eq('id', tenant.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Azienda non trovata: ${tenant.id}`);

  console.log('🏢 Azienda trovata');
  console.table([data]);
}

async function ensureCategories() {
  const current = await countRows('categorie');
  const missing = Math.max(0, TARGETS.categorie - current);

  if (missing === 0) {
    console.log(`ℹ️ Categorie già al target: ${current}`);
  } else {
    const rows = [];

    for (let i = 1; i <= missing; i += 1) {
      rows.push({
        azienda_id: tenant.id,
        nome: `${tenant.categoryPrefix} ${String(current + i).padStart(2, '0')}`,
        descrizione: `Categoria super-carico TEST3 ${current + i}`,
      });
    }

    const { error } = await supabase.from('categorie').insert(rows);
    if (error) throw error;

    console.log(`✅ Categorie aggiunte: ${rows.length}`);
  }

  const { data, error } = await supabase
    .from('categorie')
    .select('id, nome')
    .eq('azienda_id', tenant.id)
    .order('nome');

  if (error) throw error;
  return data || [];
}

async function getExistingSuperCodes() {
  const { data, error } = await supabase
    .from('materiali')
    .select('codice')
    .eq('azienda_id', tenant.id)
    .like('codice', `${tenant.prefix}-%`);

  if (error) throw error;
  return new Set((data || []).map((row) => row.codice));
}

async function ensureMaterials(categories) {
  const current = await countRows('materiali');
  const missing = Math.max(0, TARGETS.materiali - current);

  if (missing === 0) {
    console.log(`ℹ️ Materiali già al target: ${current}`);
    return;
  }

  const existingCodes = await getExistingSuperCodes();
  const rows = [];
  let serial = 1;

  while (rows.length < missing) {
    const code = `${tenant.prefix}-${String(serial).padStart(5, '0')}`;
    serial += 1;

    if (existingCodes.has(code)) continue;

    const qty =
      serial % 37 === 0
        ? 0
        : serial % 19 === 0
          ? 1
          : (serial * 17) % 220 + 2;

    const threshold = serial % 19 === 0 ? 8 : (serial % 16) + 2;
    const category = categories[serial % categories.length];
    const price = Number((((serial * 3.47) % 320) + 0.75).toFixed(2));

    rows.push({
      azienda_id: tenant.id,
      codice: code,
      descrizione: `${randomFrom(tenant.words, serial)} super ${String(serial).padStart(5, '0')}`,
      marca: randomFrom(tenant.brands, serial),
      categoria_id: category.id,
      unita_misura: serial % 11 === 0 ? 'sacco' : serial % 7 === 0 ? 'conf' : serial % 5 === 0 ? 'kit' : 'pz',
      quantita: qty,
      soglia_minima: threshold,
      stato_disponibilita: statusFor(qty, threshold),
      posizione_scaffale: randomFrom(tenant.locations, serial),
      prezzo_netto: price,
      fornitore: randomFrom(tenant.suppliers, serial),
      note: `Dato extra sovraccarico ${tenant.name}`,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase.from('materiali').insert(chunk);
    if (error) throw error;

    console.log(`✅ Materiali extra inseriti: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

async function getMaterialsPaged() {
  const all = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('materiali')
      .select('id, codice, descrizione, quantita, soglia_minima')
      .eq('azienda_id', tenant.id)
      .order('codice')
      .range(from, from + pageSize - 1);

    if (error) throw error;

    all.push(...(data || []));

    if (!data || data.length < pageSize) break;
  }

  return all;
}

async function ensureMovements(materials) {
  const current = await countRows('movimenti');
  const missing = Math.max(0, TARGETS.movimenti - current);

  if (missing === 0) {
    console.log(`ℹ️ Movimenti già al target: ${current}`);
    return;
  }

  const rows = [];

  for (let i = 1; i <= missing; i += 1) {
    const material = materials[(current + i) % materials.length];
    const type = i % 2 === 0 ? 'entrata' : 'uscita';

    const date = new Date();
    date.setDate(date.getDate() - (i % 365));
    date.setHours((5 + i) % 22, (i * 17) % 60, 0, 0);

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo_movimento: type,
      quantita: (i % 15) + 1,
      motivo:
        type === 'entrata'
          ? `Carico super bulk ${tenant.name}`
          : `Scarico super bulk ${tenant.name}`,
      note: `${tenant.prefix} movimento super ${current + i}`,
      operatore_nome:
        i % 9 === 0
          ? 'Responsabile Vivaio'
          : i % 6 === 0
            ? 'Addetto Serra'
            : i % 4 === 0
              ? 'Magazziniere Agricolo'
              : 'Operatore Girasole',
      data_movimento: date.toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase.from('movimenti').insert(chunk);
    if (error) throw error;

    console.log(`✅ Movimenti extra inseriti: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

async function ensureNotifications(materials) {
  const current = await countRows('notifiche');
  const missing = Math.max(0, TARGETS.notifiche - current);

  if (missing === 0) {
    console.log(`ℹ️ Notifiche già al target: ${current}`);
    return;
  }

  const critical = materials.filter(
    (m) =>
      Number(m.quantita || 0) <= Number(m.soglia_minima || 0) &&
      Number(m.soglia_minima || 0) > 0
  );

  const source = critical.length > 0 ? critical : materials;
  const rows = [];

  for (let i = 0; i < missing; i += 1) {
    const material = source[(current + i) % source.length];

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo: Number(material.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
      messaggio: `${material.codice} - ${material.descrizione} notifica super-carico TEST3 #${current + i + 1}`,
      letta: i % 5 === 0,
    });
  }

  const { error } = await supabase.from('notifiche').insert(rows);
  if (error) throw error;

  console.log(`✅ Notifiche extra inserite: ${rows.length}`);
}

async function printComparison() {
  console.log('\n📊 CONFRONTO FINALE');

  for (const companyId of ['cl_thermoservice', 'cl_test3']) {
    const result = {};

    for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche', 'utenti']) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('azienda_id', companyId);

      result[table] = error ? `ERR: ${error.message}` : count;
    }

    console.log(`\n${companyId}`);
    console.table(result);
  }

  const { data, error } = await supabase
    .from('materiali')
    .select('codice, descrizione, quantita, fornitore, azienda_id')
    .eq('azienda_id', tenant.id)
    .order('codice')
    .limit(12);

  if (error) throw error;

  console.log('\n🔎 Campioni TEST3');
  console.table(data);
}

await assertCompanyExists();

const before = {
  categorie: await countRows('categorie'),
  materiali: await countRows('materiali'),
  movimenti: await countRows('movimenti'),
  notifiche: await countRows('notifiche'),
};

console.log('\n📌 TEST3 prima del boost');
console.table(before);

const categories = await ensureCategories();

await ensureMaterials(categories);

const materials = await getMaterialsPaged();

await ensureMovements(materials);
await ensureNotifications(materials);

await printComparison();

console.log('\n✅ TEST3 ora supera Thermoservice per carico dati.');

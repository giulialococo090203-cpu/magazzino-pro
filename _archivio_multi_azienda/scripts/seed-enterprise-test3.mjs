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
  code: 'TEST3',
  prefix: 'AGRI',
  categoryPrefix: 'Reparto Agricolo',
  words: [
    'Terriccio universale professionale',
    'Concime granulare per ortaggi',
    'Semi basilico genovese',
    'Semi pomodoro cuore di bue',
    'Tubo irrigazione gocciolante',
    'Raccordo rapido irrigazione',
    'Annaffiatoio zincato grande',
    'Forbice potatura professionale',
    'Guanti giardinaggio rinforzati',
    'Vaso terracotta diametro 24',
    'Sottovaso plastica verde',
    'Piantina lavanda officinale',
    'Piantina rosmarino prostrato',
    'Piantina salvia aromatica',
    'Bulbi tulipano misti',
    'Bulbi narciso giallo',
    'Pacciamatura corteccia pino',
    'Lapillo vulcanico drenante',
    'Retina ombreggiante agricola',
    'Telo antigelo piante',
    'Pompa irroratrice manuale',
    'Trappola cromotropica insetti',
    'Tutore bambù naturale',
    'Legaccio agricolo morbido',
    'Zappa manico legno',
    'Rastrello acciaio leggero',
    'Fertilizzante agrumi liquido',
    'Concime orchidee concentrato',
    'Disabituante lumache naturale',
    'Kit microirrigazione balcone',
  ],
  brands: [
    'Compo',
    'Vigorplant',
    'Bayer Garden',
    'Cifo',
    'Claber',
    'Stocker',
    'VerdeMax',
    'Fito',
    'Flortis',
    'Geolia',
  ],
  suppliers: [
    'Agraria Toscana',
    'Vivaio Centro Verde',
    'Irrigazione Italia',
    'Semi & Natura',
    'Garden Tools Pro',
    'Fertil Green',
    'Floricoltura Tirreno',
  ],
  locations: [
    'AGRI-A1',
    'AGRI-A2',
    'AGRI-B1',
    'AGRI-B2',
    'AGRI-C1',
    'AGRI-C2',
    'AGRI-D1',
    'AGRI-D2',
    'AGRI-E1',
    'AGRI-E2',
  ],
};

const TARGETS = {
  categorie: 30,
  materiali: 6200,
  movimenti: 30005,
  notifiche: 120,
};

function randomFrom(list, index) {
  return list[index % list.length];
}

function statusFor(qty, threshold) {
  if (Number(qty || 0) <= 0) return 'esaurito';
  if (Number(qty || 0) <= Number(threshold || 0)) return 'sotto_soglia';
  return 'disponibile';
}

async function countRows(table, companyId) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('azienda_id', companyId);

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

  if (!data) {
    throw new Error(`Azienda non trovata: ${tenant.id}`);
  }

  console.log('🏢 Azienda trovata');
  console.table([data]);
}

async function cleanTenantData() {
  console.log(`🧹 Pulizia dati aziendali per ${tenant.id}`);

  const tables = [
    'notifiche',
    'movimenti',
    'fatture_importate',
    'log_modifiche',
    'materiali',
    'categorie',
    'impostazioni',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('azienda_id', tenant.id);

    if (error) {
      console.warn(`⚠️ Pulizia ${table} non completata: ${error.message}`);
    }
  }
}

async function seedCategories() {
  const rows = [];

  for (let i = 1; i <= TARGETS.categorie; i += 1) {
    rows.push({
      azienda_id: tenant.id,
      nome: `${tenant.categoryPrefix} ${String(i).padStart(2, '0')}`,
      descrizione: `Categoria vivaio/agricoltura ${i}`,
    });
  }

  const { data, error } = await supabase
    .from('categorie')
    .insert(rows)
    .select('id, nome');

  if (error) throw error;

  console.log(`✅ Categorie inserite: ${data.length}`);
  return data || [];
}

async function seedMaterials(categories) {
  const rows = [];

  for (let i = 1; i <= TARGETS.materiali; i += 1) {
    const qty =
      i % 41 === 0
        ? 0
        : i % 17 === 0
          ? 1
          : (i * 13) % 180 + 2;

    const threshold = i % 17 === 0 ? 6 : (i % 14) + 2;
    const category = categories[i % categories.length];
    const price = Number((((i * 2.87) % 240) + 0.55).toFixed(2));

    rows.push({
      azienda_id: tenant.id,
      codice: `${tenant.prefix}-${String(i).padStart(5, '0')}`,
      descrizione: `${randomFrom(tenant.words, i)} ${String(i).padStart(5, '0')}`,
      marca: randomFrom(tenant.brands, i),
      categoria_id: category.id,
      unita_misura: i % 9 === 0 ? 'sacco' : i % 7 === 0 ? 'conf' : i % 5 === 0 ? 'lt' : 'pz',
      quantita: qty,
      soglia_minima: threshold,
      stato_disponibilita: statusFor(qty, threshold),
      posizione_scaffale: randomFrom(tenant.locations, i),
      prezzo_netto: price,
      fornitore: randomFrom(tenant.suppliers, i),
      note: `Dato massivo demo ${tenant.name}`,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase
      .from('materiali')
      .insert(chunk);

    if (error) throw error;

    console.log(`✅ Materiali inseriti: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

async function getMaterials() {
  const pageSize = 1000;
  const all = [];

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

async function seedMovements(materials) {
  const rows = [];

  for (let i = 1; i <= TARGETS.movimenti; i += 1) {
    const material = materials[i % materials.length];
    const type = i % 2 === 0 ? 'entrata' : 'uscita';

    const date = new Date();
    date.setDate(date.getDate() - (i % 240));
    date.setHours((6 + i) % 20, (i * 11) % 60, 0, 0);

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo_movimento: type,
      quantita: (i % 12) + 1,
      motivo:
        type === 'entrata'
          ? `Carico vivaio demo ${tenant.name}`
          : `Scarico operativo vivaio demo ${tenant.name}`,
      note: `${tenant.prefix} movimento massivo ${i}`,
      operatore_nome:
        i % 7 === 0
          ? 'Responsabile Vivaio'
          : i % 5 === 0
            ? 'Addetto Serra'
            : i % 3 === 0
              ? 'Magazziniere Agricolo'
              : 'Operatore Girasole',
      data_movimento: date.toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase
      .from('movimenti')
      .insert(chunk);

    if (error) throw error;

    console.log(`✅ Movimenti inseriti: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

async function seedNotifications(materials) {
  const critical = materials.filter(
    (m) =>
      Number(m.quantita || 0) <= Number(m.soglia_minima || 0) &&
      Number(m.soglia_minima || 0) > 0
  );

  const source = critical.length > 0 ? critical : materials;
  const rows = [];

  for (let i = 0; i < TARGETS.notifiche; i += 1) {
    const material = source[i % source.length];

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo: Number(material.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
      messaggio: `${material.codice} - ${material.descrizione} richiede attenzione nel vivaio.`,
      letta: i % 4 === 0,
    });
  }

  const { error } = await supabase
    .from('notifiche')
    .insert(rows);

  if (error) throw error;

  console.log(`✅ Notifiche inserite: ${rows.length}`);
}

async function seedSettings() {
  const { error } = await supabase
    .from('impostazioni')
    .insert({
      azienda_id: tenant.id,
      chiave: 'demo_enterprise_agri',
      valore: {
        settore: 'vivaio agricolo',
        prefix: tenant.prefix,
        seededAt: new Date().toISOString(),
      },
    });

  if (error) {
    console.warn(`⚠️ Impostazioni non inserite: ${error.message}`);
  } else {
    console.log('✅ Impostazioni demo inserite.');
  }
}

async function printFinalChecks() {
  console.log('\n📊 CONTROLLO FINALE TEST3');

  const result = {};

  for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche', 'impostazioni', 'utenti']) {
    const column = table === 'utenti' ? 'azienda_id' : 'azienda_id';

    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, tenant.id);

    result[table] = error ? `ERR: ${error.message}` : count;
  }

  console.table(result);

  const { data, error } = await supabase
    .from('materiali')
    .select('codice, descrizione, quantita, fornitore, azienda_id')
    .eq('azienda_id', tenant.id)
    .order('codice')
    .limit(10);

  if (error) throw error;

  console.log('\n🔎 Campioni materiali TEST3');
  console.table(data);
}

await assertCompanyExists();
await cleanTenantData();

const categories = await seedCategories();

await seedMaterials(categories);

const materials = await getMaterials();

await seedMovements(materials);
await seedNotifications(materials);
await seedSettings();
await printFinalChecks();

console.log('\n✅ TEST3 caricato con dati agricoli massivi e separati.');

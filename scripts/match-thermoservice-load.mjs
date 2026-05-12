import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nel terminale.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sourceTenant = 'cl_thermoservice';

const tenants = [
  {
    id: 'cl_test',
    name: 'Officina Auto Verdi',
    prefix: 'AUTO',
    bulkPrefix: 'AUTO-BULK',
    categoryPrefix: 'Reparto Officina',
    words: [
      'Filtro carburante alta pressione',
      'Sensore giri motore',
      'Kit distribuzione completo',
      'Pompa acqua motore',
      'Braccio sospensione inferiore',
      'Supporto motore rinforzato',
      'Liquido radiatore antigelo',
      'Pastiglie freno posteriori',
      'Centralina accensione',
      'Morsetto batteria rapido',
      'Cavo candela schermato',
      'Guarnizione coperchio punterie',
      'Valvola termostatica',
      'Tubo intercooler silicone',
      'Disco freno sportivo',
      'Lampada officina ricaricabile',
      'Spray pulitore freni',
      'Grasso litio multiuso',
      'Additivo pulizia iniettori',
      'Cuscinetto ruota anteriore',
    ],
    brands: ['Bosch', 'Brembo', 'Valeo', 'NGK', 'Febi', 'Sachs', 'Castrol', 'Osram', 'Magneti Marelli', 'Mann'],
    suppliers: ['Autoricambi Europa', 'Ricambi Motore Nord', 'Freni Italia', 'LubriCar Service', 'Meccanica Express'],
    locations: ['AUTO-L1', 'AUTO-L2', 'AUTO-M1', 'AUTO-M2', 'AUTO-N1', 'AUTO-N2', 'AUTO-P1', 'AUTO-P2'],
  },
  {
    id: 'cl_test2',
    name: 'Studio Dentistico Blu',
    prefix: 'DENT',
    bulkPrefix: 'DENT-BULK',
    categoryPrefix: 'Reparto Clinico',
    words: [
      'Frese diamantate grana fine',
      'Composito flow universale',
      'Adesivo dentinale monocomponente',
      'Coni carta assorbenti',
      'Aghi irrigazione endodontica',
      'Gel mordenzante ortofosforico',
      'Cemento vetroionomerico',
      'Buste sterilizzazione autosigillanti',
      'Mascherine chirurgiche studio',
      'Cannule aspirazione monouso',
      'Portaimpronte plastica assortiti',
      'Silicone impronta light body',
      'Lampada fotopolimerizzazione ricambio',
      'Carta articolazione rossa',
      'Pasta profilassi menta',
      'Spazzolini lucidatura',
      'Sonda sterile monouso',
      'Teli campo operatorio',
      'Disinfettante impronte',
      'Vaschetta porta protesi',
    ],
    brands: ['3M', 'Zhermack', 'Euronda', 'Hu-Friedy', 'Ivoclar', 'Kerr', 'Dentsply', 'Septodont', 'Coltene', 'LM Dental'],
    suppliers: ['Dental Care Supply', 'Oral Pharma', 'Steril Pro', 'Impronta Dental', 'Odonto Express'],
    locations: ['DENT-L1', 'DENT-L2', 'DENT-M1', 'DENT-M2', 'DENT-N1', 'DENT-N2', 'DENT-P1', 'DENT-P2'],
  },
];

const MIN_TARGETS = {
  categorie: 30,
  materiali: 1000,
  movimenti: 3000,
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

async function getTargetCounts() {
  const source = {};

  for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche']) {
    source[table] = await countRows(table, sourceTenant);
  }

  return {
    categorie: Math.max(source.categorie, MIN_TARGETS.categorie),
    materiali: Math.max(source.materiali, MIN_TARGETS.materiali),
    movimenti: Math.max(source.movimenti, MIN_TARGETS.movimenti),
    notifiche: Math.max(source.notifiche, MIN_TARGETS.notifiche),
    source,
  };
}

async function getCategories(companyId) {
  const { data, error } = await supabase
    .from('categorie')
    .select('id, nome')
    .eq('azienda_id', companyId)
    .order('nome');

  if (error) throw error;
  return data || [];
}

async function ensureCategories(tenant, targetCount) {
  let categories = await getCategories(tenant.id);
  const missing = Math.max(0, targetCount - categories.length);

  if (missing > 0) {
    const rows = [];

    for (let i = 1; i <= missing; i += 1) {
      rows.push({
        azienda_id: tenant.id,
        nome: `${tenant.categoryPrefix} ${String(categories.length + i).padStart(2, '0')}`,
        descrizione: `Categoria bulk per ${tenant.name}`,
      });
    }

    const { error } = await supabase
      .from('categorie')
      .insert(rows);

    if (error) throw error;

    console.log(`✅ ${tenant.id}: categorie aggiunte ${missing}`);
  } else {
    console.log(`ℹ️ ${tenant.id}: categorie già sufficienti`);
  }

  categories = await getCategories(tenant.id);
  return categories;
}

async function getExistingBulkCodes(tenant) {
  const { data, error } = await supabase
    .from('materiali')
    .select('codice')
    .eq('azienda_id', tenant.id)
    .like('codice', `${tenant.bulkPrefix}-%`);

  if (error) throw error;

  return new Set((data || []).map((row) => row.codice));
}

async function ensureMaterials(tenant, targetCount, categories) {
  const current = await countRows('materiali', tenant.id);
  const missing = Math.max(0, targetCount - current);

  if (missing === 0) {
    console.log(`ℹ️ ${tenant.id}: materiali già sufficienti (${current})`);
    return;
  }

  const existingCodes = await getExistingBulkCodes(tenant);
  const rows = [];
  let serial = 1;

  while (rows.length < missing) {
    const code = `${tenant.bulkPrefix}-${String(serial).padStart(5, '0')}`;
    serial += 1;

    if (existingCodes.has(code)) continue;

    const qty =
      serial % 23 === 0
        ? 0
        : serial % 13 === 0
          ? 1
          : (serial * 11) % 140 + 2;

    const threshold = serial % 13 === 0 ? 5 : (serial % 12) + 2;
    const price = Number((((serial * 4.91) % 180) + 0.85).toFixed(2));
    const category = categories[serial % categories.length];

    rows.push({
      azienda_id: tenant.id,
      codice: code,
      descrizione: `${randomFrom(tenant.words, serial)} bulk ${String(serial).padStart(5, '0')}`,
      marca: randomFrom(tenant.brands, serial),
      categoria_id: category.id,
      unita_misura: serial % 7 === 0 ? 'conf' : serial % 5 === 0 ? 'kit' : serial % 3 === 0 ? 'lt' : 'pz',
      quantita: qty,
      soglia_minima: threshold,
      stato_disponibilita: statusFor(qty, threshold),
      posizione_scaffale: randomFrom(tenant.locations, serial),
      prezzo_netto: price,
      fornitore: randomFrom(tenant.suppliers, serial),
      note: `Dato bulk tenant ${tenant.name}`,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase
      .from('materiali')
      .insert(chunk);

    if (error) throw error;
  }

  console.log(`✅ ${tenant.id}: materiali aggiunti ${rows.length}`);
}

async function getMaterials(companyId) {
  const { data, error } = await supabase
    .from('materiali')
    .select('id, codice, descrizione, quantita, soglia_minima')
    .eq('azienda_id', companyId)
    .order('codice');

  if (error) throw error;
  return data || [];
}

async function ensureMovements(tenant, targetCount, materials) {
  const current = await countRows('movimenti', tenant.id);
  const missing = Math.max(0, targetCount - current);

  if (missing === 0) {
    console.log(`ℹ️ ${tenant.id}: movimenti già sufficienti (${current})`);
    return;
  }

  const rows = [];

  for (let i = 1; i <= missing; i += 1) {
    const material = materials[i % materials.length];
    const type = i % 2 === 0 ? 'entrata' : 'uscita';

    const date = new Date();
    date.setDate(date.getDate() - (i % 180));
    date.setHours((7 + i) % 19, (i * 13) % 60, 0, 0);

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo_movimento: type,
      quantita: (i % 9) + 1,
      motivo: type === 'entrata' ? `Carico bulk ${tenant.name}` : `Scarico bulk ${tenant.name}`,
      note: `${tenant.bulkPrefix} movimento bulk ${i}`,
      operatore_nome:
        i % 5 === 0
          ? 'Datore Demo'
          : i % 3 === 0
            ? 'Magazziniere Demo'
            : 'Operatore Demo',
      data_movimento: date.toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase
      .from('movimenti')
      .insert(chunk);

    if (error) throw error;
  }

  console.log(`✅ ${tenant.id}: movimenti aggiunti ${rows.length}`);
}

async function ensureNotifications(tenant, targetCount, materials) {
  const current = await countRows('notifiche', tenant.id);
  const missing = Math.max(0, targetCount - current);

  if (missing === 0) {
    console.log(`ℹ️ ${tenant.id}: notifiche già sufficienti (${current})`);
    return;
  }

  const candidates = materials.filter(
    (m) =>
      Number(m.quantita || 0) <= Number(m.soglia_minima || 0) &&
      Number(m.soglia_minima || 0) > 0
  );

  const source = candidates.length > 0 ? candidates : materials;
  const rows = [];

  for (let i = 0; i < missing; i += 1) {
    const material = source[i % source.length];

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo: Number(material.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
      messaggio: `${material.codice} - ${material.descrizione} notifica bulk ${tenant.name} #${i + 1}`,
      letta: i % 4 === 0,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);

    const { error } = await supabase
      .from('notifiche')
      .insert(chunk);

    if (error) throw error;
  }

  console.log(`✅ ${tenant.id}: notifiche aggiunte ${rows.length}`);
}

async function printCounts(label, target) {
  console.log(`\n📊 ${label}`);

  for (const companyId of [sourceTenant, ...tenants.map((t) => t.id)]) {
    const result = {};

    for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche']) {
      result[table] = await countRows(table, companyId);
    }

    console.log(`\n${companyId}`);
    console.table(result);
  }

  console.log('\n🎯 Target usato');
  console.table(target);
}

const target = await getTargetCounts();

console.log('\n📌 Conteggi Thermoservice letti:');
console.table(target.source);

console.log('\n🎯 Porterò TEST e TEST2 almeno a:');
console.table({
  categorie: target.categorie,
  materiali: target.materiali,
  movimenti: target.movimenti,
  notifiche: target.notifiche,
});

for (const tenant of tenants) {
  console.log(`\n🚀 Adeguo carico dati: ${tenant.name} (${tenant.id})`);

  const categories = await ensureCategories(tenant, target.categorie);

  await ensureMaterials(tenant, target.materiali, categories);

  const materials = await getMaterials(tenant.id);

  await ensureMovements(tenant, target.movimenti, materials);
  await ensureNotifications(tenant, target.notifiche, materials);
}

await printCounts('CONTROLLO FINALE MATCH THERMOSERVICE', {
  categorie: target.categorie,
  materiali: target.materiali,
  movimenti: target.movimenti,
  notifiche: target.notifiche,
});

console.log('\n✅ TEST e TEST2 ora sono carichi almeno quanto Thermoservice.');

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL mancante.');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY mancante.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const tenants = [
  {
    id: 'cl_test',
    prefix: 'AUTO',
    name: 'Officina Auto Verdi',
    categories: [
      'Cinghie e Distribuzione',
      'Sospensioni',
      'Carrozzeria',
      'Diagnostica',
      'Pulizia Auto',
      'Ricambi Cambio',
      'Raffreddamento Motore',
      'Scarico Auto',
    ],
    suppliers: [
      'Ricambi Motore Nord',
      'Freni Italia',
      'LubriCar Service',
      'Elettrauto Market',
      'Officina Tools',
      'Autoricambi Europa',
      'Meccanica Express',
    ],
    words: [
      'Cinghia distribuzione',
      'Tendicinghia',
      'Ammortizzatore anteriore',
      'Braccio oscillante',
      'Paraurti verniciabile',
      'Specchietto laterale',
      'Tester batteria',
      'Interfaccia diagnosi OBD',
      'Shampoo auto concentrato',
      'Panno microfibra detailing',
      'Kit frizione',
      'Olio cambio manuale',
      'Radiatore acqua',
      'Termostato motore',
      'Marmitta posteriore',
      'Sonda lambda',
      'Additivo diesel',
      'Liquido radiatore rosso',
      'Candele accensione',
      'Bobina accensione',
      'Batteria 60Ah',
      'Spazzole tergicristallo',
      'Sensore pressione pneumatici',
      'Kit bulloni ruota',
      'Cric idraulico compatto',
      'Compressore aria portatile',
    ],
    brands: [
      'Bosch',
      'Brembo',
      'Mann Filter',
      'Valeo',
      'NGK',
      'Magneti Marelli',
      'Castrol',
      'Sachs',
      'Febi',
      'Osram',
    ],
    locations: ['AUTO-F1', 'AUTO-F2', 'AUTO-G1', 'AUTO-G2', 'AUTO-H1', 'AUTO-H2', 'AUTO-I1', 'AUTO-I2'],
  },
  {
    id: 'cl_test2',
    prefix: 'DENT',
    name: 'Studio Dentistico Blu',
    categories: [
      'Endodonzia',
      'Conservativa',
      'Chirurgia Orale',
      'Radiologia',
      'Protezione Paziente',
      'Aspirazione',
      'Sbiancamento',
      'Materiali Protesici',
    ],
    suppliers: [
      'Dental Care Supply',
      'Oral Pharma',
      'Steril Pro',
      'Impronta Dental',
      'Strumenti Blu',
      'Dental Clinic Store',
      'Odonto Express',
    ],
    words: [
      'Lime endodontiche manuali',
      'Coni guttaperca assortiti',
      'Composito universale A2',
      'Adesivo smalto dentina',
      'Sutura riassorbibile 4-0',
      'Lama bisturi sterile',
      'Pellicole radiografiche',
      'Sensore copertura monouso',
      'Mantelline paziente impermeabili',
      'Salviette disinfettanti',
      'Cannule aspirazione chirurgica',
      'Filtro aspiratore studio',
      'Gel sbiancante professionale',
      'Diga liquida fotopolimerizzabile',
      'Resina provvisoria',
      'Cemento provvisorio',
      'Frese diamantate turbina',
      'Rulli cotone odontoiatrici',
      'Aghi anestesia corti',
      'Siringhe monouso',
      'Pasta lucidante profilassi',
      'Scovolini interdentali',
      'Vaschette fluoroprofilassi',
      'Apribocca silicone',
      'Portaimpronte forato',
      'Carta articolazione blu',
    ],
    brands: [
      '3M',
      'Zhermack',
      'Euronda',
      'Hu-Friedy',
      'Coltene',
      'Dentsply',
      'Ivoclar',
      'Kerr',
      'Septodont',
      'LM Dental',
    ],
    locations: ['DENT-F1', 'DENT-F2', 'DENT-G1', 'DENT-G2', 'DENT-H1', 'DENT-H2', 'DENT-I1', 'DENT-I2'],
  },
];

function randomFrom(list, index) {
  return list[index % list.length];
}

function statusFor(qty, threshold) {
  if (Number(qty || 0) <= 0) return 'esaurito';
  if (Number(qty || 0) <= Number(threshold || 0)) return 'sotto_soglia';
  return 'disponibile';
}

async function assertCompanyExists(companyId) {
  const { data, error } = await supabase
    .from('aziende')
    .select('id, nome, codice')
    .eq('id', companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Azienda non trovata: ${companyId}`);

  return data;
}

async function getOrCreateCategories(tenant) {
  const { data: existing, error: existingError } = await supabase
    .from('categorie')
    .select('id, nome')
    .eq('azienda_id', tenant.id);

  if (existingError) throw existingError;

  const existingNames = new Set((existing || []).map((c) => c.nome));
  const missingRows = tenant.categories
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      azienda_id: tenant.id,
      nome: name,
      descrizione: `Categoria extra demo ${tenant.name}: ${name}`,
    }));

  let inserted = [];

  if (missingRows.length > 0) {
    const { data, error } = await supabase
      .from('categorie')
      .insert(missingRows)
      .select('id, nome');

    if (error) throw error;
    inserted = data || [];
  }

  const all = [...(existing || []), ...inserted];
  return new Map(all.map((cat) => [cat.nome, cat.id]));
}

async function getExistingCodes(tenant) {
  const { data, error } = await supabase
    .from('materiali')
    .select('codice')
    .eq('azienda_id', tenant.id)
    .like('codice', `${tenant.prefix}-EXTRA-%`);

  if (error) throw error;

  return new Set((data || []).map((row) => row.codice));
}

async function seedExtraMaterials(tenant, categoryMap, amount = 90) {
  const existingCodes = await getExistingCodes(tenant);
  const rows = [];

  for (let i = 1; i <= amount; i += 1) {
    const code = `${tenant.prefix}-EXTRA-${String(i).padStart(4, '0')}`;

    if (existingCodes.has(code)) continue;

    const categoryName = randomFrom(tenant.categories, i);
    const qty =
      i % 17 === 0
        ? 0
        : i % 11 === 0
          ? 1
          : (i * 7) % 86 + 3;

    const threshold = i % 11 === 0 ? 4 : (i % 8) + 2;
    const price = Number((((i * 3.73) % 95) + 1.5).toFixed(2));

    rows.push({
      azienda_id: tenant.id,
      codice: code,
      descrizione: `${randomFrom(tenant.words, i)} ${String(i).padStart(2, '0')}`,
      marca: randomFrom(tenant.brands, i),
      categoria_id: categoryMap.get(categoryName),
      unita_misura: i % 5 === 0 ? 'conf' : i % 3 === 0 ? 'kit' : 'pz',
      quantita: qty,
      soglia_minima: threshold,
      stato_disponibilita: statusFor(qty, threshold),
      posizione_scaffale: randomFrom(tenant.locations, i),
      prezzo_netto: price,
      fornitore: randomFrom(tenant.suppliers, i),
      note: `Materiale extra demo ${tenant.name}`,
    });
  }

  if (rows.length === 0) {
    console.log(`ℹ️ Nessun nuovo materiale extra da inserire per ${tenant.id}`);
    return [];
  }

  const { data, error } = await supabase
    .from('materiali')
    .insert(rows)
    .select('id, codice, descrizione, quantita, soglia_minima');

  if (error) throw error;

  console.log(`✅ ${tenant.id}: materiali extra inseriti ${data.length}`);
  return data || [];
}

async function getAllTenantMaterials(tenant) {
  const { data, error } = await supabase
    .from('materiali')
    .select('id, codice, descrizione, quantita, soglia_minima')
    .eq('azienda_id', tenant.id)
    .order('codice');

  if (error) throw error;
  return data || [];
}

async function seedMovements(tenant, materials, amount = 240) {
  if (materials.length === 0) return;

  const rows = [];
  const movementTypes = ['entrata', 'uscita'];

  for (let i = 1; i <= amount; i += 1) {
    const material = materials[i % materials.length];
    const type = movementTypes[i % movementTypes.length];
    const daysAgo = i % 60;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours((8 + i) % 18, (i * 7) % 60, 0, 0);

    rows.push({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo_movimento: type,
      quantita: (i % 6) + 1,
      motivo:
        type === 'entrata'
          ? `Rifornimento extra demo ${tenant.name}`
          : `Utilizzo operativo extra demo ${tenant.name}`,
      note: `${tenant.prefix} movimento extra ${i}`,
      operatore_nome: i % 4 === 0 ? 'Responsabile Magazzino' : i % 3 === 0 ? 'Operatore Demo' : 'Sistema Demo',
      data_movimento: date.toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);

    const { error } = await supabase
      .from('movimenti')
      .insert(chunk);

    if (error) throw error;
  }

  console.log(`✅ ${tenant.id}: movimenti extra inseriti ${rows.length}`);
}

async function seedNotifications(tenant, materials) {
  const critical = materials.filter(
    (m) =>
      Number(m.quantita || 0) <= Number(m.soglia_minima || 0) &&
      Number(m.soglia_minima || 0) > 0
  );

  if (critical.length === 0) {
    console.log(`ℹ️ ${tenant.id}: nessuna notifica extra`);
    return;
  }

  const rows = critical.slice(0, 20).map((material) => ({
    azienda_id: tenant.id,
    materiale_id: material.id,
    tipo: Number(material.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
    messaggio: `${material.codice} - ${material.descrizione} richiede attenzione (${tenant.name}).`,
    letta: false,
  }));

  const { error } = await supabase
    .from('notifiche')
    .insert(rows);

  if (error) {
    console.warn(`⚠️ ${tenant.id}: notifiche extra non inserite: ${error.message}`);
    return;
  }

  console.log(`✅ ${tenant.id}: notifiche extra inserite ${rows.length}`);
}

async function printFinalChecks() {
  console.log('\n📊 CONTROLLO FINALE OVERLOAD');

  for (const tenant of tenants) {
    const result = {};

    for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche']) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('azienda_id', tenant.id);

      result[table] = error ? `ERR: ${error.message}` : count;
    }

    console.log(`\n${tenant.name} (${tenant.id})`);
    console.table(result);

    const { data, error } = await supabase
      .from('materiali')
      .select('codice, descrizione, quantita, azienda_id')
      .eq('azienda_id', tenant.id)
      .order('codice')
      .limit(8);

    if (error) throw error;

    console.table(data);
  }
}

for (const tenant of tenants) {
  await assertCompanyExists(tenant.id);

  console.log(`\n🚀 Sovraccarico dati: ${tenant.name} (${tenant.id})`);

  const categoryMap = await getOrCreateCategories(tenant);
  await seedExtraMaterials(tenant, categoryMap, 90);

  const allMaterials = await getAllTenantMaterials(tenant);

  await seedMovements(tenant, allMaterials, 240);
  await seedNotifications(tenant, allMaterials);
}

await printFinalChecks();

console.log('\n✅ Overload tenant completato.');

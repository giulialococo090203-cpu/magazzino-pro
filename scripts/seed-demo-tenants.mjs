import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL mancante.');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY mancante.');
  console.error('Esegui prima export SUPABASE_SERVICE_ROLE_KEY=...');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const tenants = [
  {
    id: 'cl_test',
    name: 'Officina Auto Verdi',
    prefix: 'AUTO',
    categories: [
      { nome: 'Filtri Motore', descrizione: 'Filtri aria, olio e carburante per autovetture' },
      { nome: 'Lubrificanti', descrizione: 'Oli motore, liquidi freni e liquidi tecnici' },
      { nome: 'Freni', descrizione: 'Pastiglie, dischi e accessori impianto frenante' },
      { nome: 'Elettrico Auto', descrizione: 'Lampadine, fusibili, batterie e cablaggi' },
      { nome: 'Attrezzatura Officina', descrizione: 'Utensili e materiali per officina meccanica' },
    ],
    materials: [
      {
        category: 'Filtri Motore',
        descrizione: 'Filtro olio Fiat Panda 1.2',
        marca: 'Mann Filter',
        unita_misura: 'pz',
        quantita: 18,
        soglia_minima: 5,
        posizione_scaffale: 'AUTO-A1',
        prezzo_netto: 6.9,
        fornitore: 'Ricambi Motore Nord',
      },
      {
        category: 'Filtri Motore',
        descrizione: 'Filtro aria Volkswagen Golf',
        marca: 'Bosch',
        unita_misura: 'pz',
        quantita: 11,
        soglia_minima: 4,
        posizione_scaffale: 'AUTO-A2',
        prezzo_netto: 9.4,
        fornitore: 'Ricambi Motore Nord',
      },
      {
        category: 'Lubrificanti',
        descrizione: 'Olio motore 5W30 sintetico 1L',
        marca: 'Castrol',
        unita_misura: 'lt',
        quantita: 48,
        soglia_minima: 12,
        posizione_scaffale: 'AUTO-B1',
        prezzo_netto: 7.8,
        fornitore: 'LubriCar Service',
      },
      {
        category: 'Lubrificanti',
        descrizione: 'Liquido freni DOT4 500ml',
        marca: 'Brembo',
        unita_misura: 'pz',
        quantita: 9,
        soglia_minima: 6,
        posizione_scaffale: 'AUTO-B2',
        prezzo_netto: 4.6,
        fornitore: 'LubriCar Service',
      },
      {
        category: 'Freni',
        descrizione: 'Pastiglie freno anteriori utilitaria',
        marca: 'Ferodo',
        unita_misura: 'set',
        quantita: 7,
        soglia_minima: 3,
        posizione_scaffale: 'AUTO-C1',
        prezzo_netto: 24.5,
        fornitore: 'Freni Italia',
      },
      {
        category: 'Freni',
        descrizione: 'Disco freno ventilato 280mm',
        marca: 'Brembo',
        unita_misura: 'pz',
        quantita: 4,
        soglia_minima: 4,
        posizione_scaffale: 'AUTO-C2',
        prezzo_netto: 38.0,
        fornitore: 'Freni Italia',
      },
      {
        category: 'Elettrico Auto',
        descrizione: 'Lampadina H7 12V',
        marca: 'Osram',
        unita_misura: 'pz',
        quantita: 30,
        soglia_minima: 10,
        posizione_scaffale: 'AUTO-D1',
        prezzo_netto: 3.2,
        fornitore: 'Elettrauto Market',
      },
      {
        category: 'Elettrico Auto',
        descrizione: 'Fusibili auto mini assortiti',
        marca: 'Lampa',
        unita_misura: 'conf',
        quantita: 6,
        soglia_minima: 3,
        posizione_scaffale: 'AUTO-D2',
        prezzo_netto: 5.5,
        fornitore: 'Elettrauto Market',
      },
      {
        category: 'Attrezzatura Officina',
        descrizione: 'Guanti nitrile meccanico neri',
        marca: 'Beta',
        unita_misura: 'conf',
        quantita: 14,
        soglia_minima: 5,
        posizione_scaffale: 'AUTO-E1',
        prezzo_netto: 8.7,
        fornitore: 'Officina Tools',
      },
      {
        category: 'Attrezzatura Officina',
        descrizione: 'Chiave filtro olio universale',
        marca: 'Usag',
        unita_misura: 'pz',
        quantita: 2,
        soglia_minima: 1,
        posizione_scaffale: 'AUTO-E2',
        prezzo_netto: 18.9,
        fornitore: 'Officina Tools',
      },
    ],
  },
  {
    id: 'cl_test2',
    name: 'Studio Dentistico Blu',
    prefix: 'DENT',
    categories: [
      { nome: 'Monouso Clinico', descrizione: 'Guanti, mascherine, bicchieri e materiali monouso' },
      { nome: 'Igiene Dentale', descrizione: 'Spazzolini, paste, gel e materiale per profilassi' },
      { nome: 'Sterilizzazione', descrizione: 'Buste, disinfettanti e prodotti per sterilizzazione' },
      { nome: 'Materiali Impronta', descrizione: 'Siliconi, alginati e accessori impronte' },
      { nome: 'Strumentario Studio', descrizione: 'Piccoli strumenti e accessori odontoiatrici' },
    ],
    materials: [
      {
        category: 'Monouso Clinico',
        descrizione: 'Guanti nitrile azzurri taglia M',
        marca: 'Medicom',
        unita_misura: 'conf',
        quantita: 22,
        soglia_minima: 8,
        posizione_scaffale: 'DENT-A1',
        prezzo_netto: 6.8,
        fornitore: 'Dental Care Supply',
      },
      {
        category: 'Monouso Clinico',
        descrizione: 'Bicchieri monouso studio dentistico',
        marca: 'Euronda',
        unita_misura: 'conf',
        quantita: 16,
        soglia_minima: 6,
        posizione_scaffale: 'DENT-A2',
        prezzo_netto: 3.9,
        fornitore: 'Dental Care Supply',
      },
      {
        category: 'Igiene Dentale',
        descrizione: 'Gel fluorato professionale',
        marca: 'Colgate',
        unita_misura: 'pz',
        quantita: 10,
        soglia_minima: 4,
        posizione_scaffale: 'DENT-B1',
        prezzo_netto: 11.2,
        fornitore: 'Oral Pharma',
      },
      {
        category: 'Igiene Dentale',
        descrizione: 'Spazzolini post-intervento morbidi',
        marca: 'Curaprox',
        unita_misura: 'pz',
        quantita: 35,
        soglia_minima: 10,
        posizione_scaffale: 'DENT-B2',
        prezzo_netto: 1.85,
        fornitore: 'Oral Pharma',
      },
      {
        category: 'Sterilizzazione',
        descrizione: 'Buste sterilizzazione 90x250',
        marca: 'Euronda',
        unita_misura: 'conf',
        quantita: 12,
        soglia_minima: 5,
        posizione_scaffale: 'DENT-C1',
        prezzo_netto: 9.6,
        fornitore: 'Steril Pro',
      },
      {
        category: 'Sterilizzazione',
        descrizione: 'Disinfettante superfici medicale',
        marca: 'Zhermack',
        unita_misura: 'lt',
        quantita: 5,
        soglia_minima: 4,
        posizione_scaffale: 'DENT-C2',
        prezzo_netto: 13.5,
        fornitore: 'Steril Pro',
      },
      {
        category: 'Materiali Impronta',
        descrizione: 'Alginato cromatico rapido',
        marca: 'Zhermack',
        unita_misura: 'busta',
        quantita: 8,
        soglia_minima: 3,
        posizione_scaffale: 'DENT-D1',
        prezzo_netto: 7.4,
        fornitore: 'Impronta Dental',
      },
      {
        category: 'Materiali Impronta',
        descrizione: 'Silicone addizione putty',
        marca: '3M',
        unita_misura: 'kit',
        quantita: 3,
        soglia_minima: 2,
        posizione_scaffale: 'DENT-D2',
        prezzo_netto: 42.0,
        fornitore: 'Impronta Dental',
      },
      {
        category: 'Strumentario Studio',
        descrizione: 'Specchietto odontoiatrico piano',
        marca: 'Hu-Friedy',
        unita_misura: 'pz',
        quantita: 9,
        soglia_minima: 3,
        posizione_scaffale: 'DENT-E1',
        prezzo_netto: 4.9,
        fornitore: 'Strumenti Blu',
      },
      {
        category: 'Strumentario Studio',
        descrizione: 'Sonda parodontale millimetrata',
        marca: 'LM Dental',
        unita_misura: 'pz',
        quantita: 4,
        soglia_minima: 2,
        posizione_scaffale: 'DENT-E2',
        prezzo_netto: 16.5,
        fornitore: 'Strumenti Blu',
      },
    ],
  },
];

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

  if (!data) {
    throw new Error(`Azienda non trovata: ${companyId}`);
  }

  return data;
}

async function cleanTenantData(companyId) {
  console.log(`🧹 Pulizia dati demo per ${companyId}`);

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
      .eq('azienda_id', companyId);

    if (error) {
      console.warn(`⚠️ Pulizia ${table} non completata per ${companyId}: ${error.message}`);
    }
  }
}

async function seedTenant(tenant) {
  const company = await assertCompanyExists(tenant.id);

  console.log(`\n🏢 ${tenant.name} → ${tenant.id} (${company.codice})`);

  await cleanTenantData(tenant.id);

  const categoryRows = tenant.categories.map((category) => ({
    ...category,
    azienda_id: tenant.id,
  }));

  const { data: insertedCategories, error: catError } = await supabase
    .from('categorie')
    .insert(categoryRows)
    .select('id, nome');

  if (catError) throw catError;

  const categoryMap = new Map(insertedCategories.map((cat) => [cat.nome, cat.id]));

  console.log(`✅ Categorie inserite: ${insertedCategories.length}`);

  const materialRows = tenant.materials.map((material, index) => ({
    azienda_id: tenant.id,
    codice: `${tenant.prefix}-${String(index + 1).padStart(4, '0')}`,
    descrizione: material.descrizione,
    marca: material.marca,
    categoria_id: categoryMap.get(material.category),
    unita_misura: material.unita_misura,
    quantita: material.quantita,
    soglia_minima: material.soglia_minima,
    stato_disponibilita: statusFor(material.quantita, material.soglia_minima),
    posizione_scaffale: material.posizione_scaffale,
    prezzo_netto: material.prezzo_netto,
    fornitore: material.fornitore,
    note: `Dato demo ${tenant.name}`,
  }));

  const { data: insertedMaterials, error: matError } = await supabase
    .from('materiali')
    .insert(materialRows)
    .select('id, codice, descrizione, quantita, soglia_minima');

  if (matError) throw matError;

  console.log(`✅ Materiali inseriti: ${insertedMaterials.length}`);

  const movementRows = insertedMaterials.map((material) => ({
    azienda_id: tenant.id,
    materiale_id: material.id,
    tipo_movimento: 'entrata',
    quantita: material.quantita,
    motivo: 'Carico iniziale demo',
    note: `Carico iniziale ${tenant.name}`,
    operatore_nome: 'Sistema demo',
    data_movimento: new Date().toISOString(),
  }));

  const { data: insertedMovements, error: movError } = await supabase
    .from('movimenti')
    .insert(movementRows)
    .select('id');

  if (movError) throw movError;

  console.log(`✅ Movimenti iniziali inseriti: ${insertedMovements.length}`);

  const lowStock = insertedMaterials.filter(
    (material) =>
      Number(material.quantita || 0) <= Number(material.soglia_minima || 0) &&
      Number(material.soglia_minima || 0) > 0
  );

  if (lowStock.length > 0) {
    const notificationRows = lowStock.map((material) => ({
      azienda_id: tenant.id,
      materiale_id: material.id,
      tipo: Number(material.quantita || 0) <= 0 ? 'esaurito' : 'sotto_soglia',
      messaggio: `${material.codice} - ${material.descrizione} è sotto soglia nel tenant ${tenant.name}.`,
      letta: false,
    }));

    const { data: insertedNotifications, error: notifError } = await supabase
      .from('notifiche')
      .insert(notificationRows)
      .select('id');

    if (notifError) throw notifError;

    console.log(`✅ Notifiche inserite: ${insertedNotifications.length}`);
  } else {
    console.log('ℹ️ Nessuna notifica sotto soglia creata.');
  }

  const { error: settingsError } = await supabase
    .from('impostazioni')
    .insert({
      azienda_id: tenant.id,
      chiave: 'demo_seed',
      valore: {
        settore: tenant.name,
        prefix: tenant.prefix,
        seededAt: new Date().toISOString(),
      },
    });

  if (settingsError) {
    console.warn(`⚠️ Impostazioni non inserite per ${tenant.id}: ${settingsError.message}`);
  } else {
    console.log('✅ Impostazioni demo inserite.');
  }
}

async function printChecks() {
  console.log('\n📊 CONTROLLO FINALE');

  for (const tenant of tenants) {
    const result = {};

    for (const table of ['categorie', 'materiali', 'movimenti', 'notifiche', 'impostazioni']) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('azienda_id', tenant.id);

      result[table] = error ? `ERR: ${error.message}` : count;
    }

    console.log(`\n${tenant.name} (${tenant.id})`);
    console.table(result);
  }

  console.log('\n🔎 Campioni materiali');

  for (const tenant of tenants) {
    const { data, error } = await supabase
      .from('materiali')
      .select('codice, descrizione, quantita, fornitore, azienda_id')
      .eq('azienda_id', tenant.id)
      .order('codice')
      .limit(5);

    if (error) throw error;

    console.log(`\n${tenant.id}`);
    console.table(data);
  }
}

for (const tenant of tenants) {
  await seedTenant(tenant);
}

await printChecks();

console.log('\n✅ Seed tenant completato senza contaminazione.');

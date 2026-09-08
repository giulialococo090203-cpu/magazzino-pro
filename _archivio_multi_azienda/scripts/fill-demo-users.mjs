import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const tenants = [
  {
    id: 'cl_test',
    code: 'TEST',
    label: 'Officina Auto Verdi',
    targetUsers: 10,
    emailDomain: 'officina-verdi-demo.it',
    names: [
      'Marco Verdi',
      'Laura Meccanica',
      'Paolo Ricambi',
      'Sara Accettazione',
      'Nico Officina',
      'Elena Magazzino',
      'Davide Freni',
      'Giulia Motori',
      'Luca Diagnosi',
      'Anna Contabilità',
    ],
  },
  {
    id: 'cl_test2',
    code: 'TEST2',
    label: 'Studio Dentistico Blu',
    targetUsers: 20,
    emailDomain: 'dentistico-blu-demo.it',
    names: [
      'Claudia Blu',
      'Federico Clinica',
      'Marta Sterilizzazione',
      'Simone Assistente',
      'Elisa Reception',
      'Giorgio Odonto',
      'Valeria Igiene',
      'Roberto Protesi',
      'Chiara Radiologia',
      'Andrea Chirurgia',
      'Silvia Studio',
      'Matteo Scorte',
      'Francesca Dental',
      'Alessio Magazzino',
      'Irene Segreteria',
      'Tommaso Clinico',
      'Noemi Fornitori',
      'Pietro Sala',
      'Greta Amministrazione',
      'Lorenzo Materiali',
    ],
  },
  {
    id: 'cl_test3',
    code: 'TEST3',
    label: 'Vivaio Agricolo Girasole',
    targetUsers: 50,
    emailDomain: 'vivaio-girasole-demo.it',
    names: [
      'Gino Girasole',
      'Angela Serra',
      'Mario Vivaio',
      'Lucia Semi',
      'Roberto Irrigazione',
      'Elisa Piante',
      'Claudio Concimi',
      'Marta Fiori',
      'Davide Ortaggi',
      'Sofia Garden',
      'Lorenzo Agricolo',
      'Giada Potatura',
      'Paolo Magazzino',
      'Francesca Serra',
      'Andrea Attrezzi',
      'Silvia Fertilizzanti',
      'Nicolò Irrigo',
      'Valentina Natura',
      'Tommaso Verde',
      'Irene Vivaista',
      'Matteo Campo',
      'Noemi Fitosanitari',
      'Giorgio Piante',
      'Alessia Garden',
      'Pietro Semi',
      'Chiara Orto',
      'Federico Bosco',
      'Greta Fiori',
      'Simone Agraria',
      'Laura Natura',
    ],
  },
];

function slugName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function roleForIndex(index) {
  if (index === 0) return 'datore';
  if (index % 5 === 0) return 'segretaria';
  if (index % 3 === 0) return 'magazziniere';
  return 'operaio';
}

async function getCompany(companyId) {
  const { data, error } = await supabase
    .from('aziende')
    .select('id, nome, codice, piano, max_utenti')
    .eq('id', companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Azienda non trovata: ${companyId}`);

  return data;
}

async function getActiveUsers(companyId) {
  const { data, error } = await supabase
    .from('utenti')
    .select('id, username, email, nome, ruolo, attivo, azienda_id')
    .eq('azienda_id', companyId)
    .eq('attivo', true)
    .order('nome');

  if (error) throw error;
  return data || [];
}

async function ensureUsersToTarget(tenant) {
  const company = await getCompany(tenant.id);
  const existingUsers = await getActiveUsers(tenant.id);

  const existingCount = existingUsers.length;
  const missing = Math.max(0, tenant.targetUsers - existingCount);

  console.log(`\n👥 ${tenant.label} (${tenant.id})`);
  console.log(`Piano: ${company.piano} · Max utenti DB: ${company.max_utenti ?? 'illimitati'} · Target demo: ${tenant.targetUsers} · Attivi ora: ${existingCount}`);

  if (missing === 0) {
    console.log('✅ Utenti già al target previsto.');
    return;
  }

  const rows = [];

  for (let i = 0; rows.length < missing; i += 1) {
    const absoluteIndex = existingCount + i;
    const baseName = tenant.names[absoluteIndex % tenant.names.length];
    const name =
      absoluteIndex < tenant.names.length
        ? baseName
        : `${baseName} ${Math.floor(absoluteIndex / tenant.names.length) + 1}`;

    const email = `${slugName(name)}.${String(absoluteIndex + 1).padStart(3, '0')}@${tenant.emailDomain}`;
    const role = roleForIndex(absoluteIndex);

    const alreadyExists = existingUsers.some(
      (u) =>
        String(u.email || '').toLowerCase() === email.toLowerCase() ||
        String(u.username || '').toLowerCase() === email.toLowerCase()
    );

    if (alreadyExists) continue;

    rows.push({
      username: email,
      email,
      nome: name,
      ruolo: role,
      attivo: true,
      permessi: {},
      azienda_id: tenant.id,
      password: null,
    });
  }

  const { data, error } = await supabase
    .from('utenti')
    .insert(rows)
    .select('id, username, email, nome, ruolo, attivo, azienda_id');

  if (error) throw error;

  console.log(`✅ Utenti demo aggiunti: ${data.length}`);

  const finalUsers = await getActiveUsers(tenant.id);

  console.log(`📊 Totale utenti attivi finale: ${finalUsers.length}/${tenant.targetUsers}`);
  console.table(
    finalUsers.slice(0, 12).map((u) => ({
      nome: u.nome,
      email: u.email,
      ruolo: u.ruolo,
      azienda_id: u.azienda_id,
    }))
  );

  if (finalUsers.length > 12) {
    console.log(`… altri ${finalUsers.length - 12} utenti non mostrati in tabella.`);
  }
}

for (const tenant of tenants) {
  await ensureUsersToTarget(tenant);
}

console.log('\n📊 CONTROLLO FINALE UTENTI');

for (const tenant of tenants) {
  const users = await getActiveUsers(tenant.id);

  const byRole = users.reduce((acc, user) => {
    const role = user.ruolo || 'senza_ruolo';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n${tenant.label} (${tenant.id})`);
  console.log(`Totale attivi: ${users.length}`);
  console.table(byRole);
}

console.log('\n✅ Utenti demo riempiti per tutti i tenant.');

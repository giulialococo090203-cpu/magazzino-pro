import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function readEnvFile(path = '.env') {
  if (!fs.existsSync(path)) return {};
  const raw = fs.readFileSync(path, 'utf8');
  const env = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }

  return env;
}

const env = { ...readEnvFile('.env'), ...process.env };

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERRORE: mancano VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const now = new Date().toISOString();
const AZIENDA_ID = 'cl_thermoservice';

const categories = [
  ['Caldaie e ricambi', 'Ricambi principali per caldaie murali e condensazione.'],
  ['Pompe e circolatori', 'Circolatori, pompe impianto e accessori.'],
  ['Valvole e rubinetteria', 'Valvole sicurezza, sfogo aria, ritegno e intercettazione.'],
  ['Raccordi e minuteria', 'Raccordi, guarnizioni, curve, riduzioni e minuteria varia.'],
  ['Termostati e componenti elettrici', 'Termostati, sonde, schede, pressostati e componenti elettrici.'],
  ['Climatizzazione', 'Materiali per split, staffe, canaline e pompe condensa.'],
  ['Filtrazione e trattamento acqua', 'Filtri, polifosfati, defangatori e trattamento impianti.'],
  ['Canne fumarie e scarichi', 'Tubi coassiali, curve, terminali e accessori scarico fumi.'],
  ['Materiale consumo tecnico', 'Silicone, teflon, paste, spray, fascette e tasselli.'],
  ['Attrezzatura e DPI', 'Utensili, DPI, strumenti di misura e attrezzatura officina.'],
];

const materials = [
  ['BOS-87167632110', 'Valvola sicurezza caldaia 3 bar', 'Valvole e rubinetteria', 'Bosch', 'Robert Bosch S.p.A.', 12, 4, 18.50, 'PZ', 'A1-01'],
  ['BOS-87161165440', 'Sonda NTC sanitario', 'Termostati e componenti elettrici', 'Bosch', 'Robert Bosch S.p.A.', 9, 3, 13.80, 'PZ', 'A1-02'],
  ['BOS-87186445630', 'Elettrodo accensione/rilevazione', 'Caldaie e ricambi', 'Bosch', 'Robert Bosch S.p.A.', 7, 3, 24.90, 'PZ', 'A1-03'],
  ['ARI-65105322', 'Gruppo ritorno caldaia', 'Caldaie e ricambi', 'Ariston', 'Ariston SpA', 5, 2, 75.98, 'PZ', 'A2-01'],
  ['ARI-60000872', 'Pressostato acqua', 'Termostati e componenti elettrici', 'Ariston', 'Ariston SpA', 6, 2, 29.40, 'PZ', 'A2-02'],
  ['GRU-UPS25-60', 'Circolatore impianto 25/60', 'Pompe e circolatori', 'Grundfos', 'Grossista Termoidraulico', 4, 2, 92.00, 'PZ', 'B1-01'],
  ['WIL-YONOS25-6', 'Circolatore elettronico 25/6', 'Pompe e circolatori', 'Wilo', 'Grossista Termoidraulico', 3, 1, 88.50, 'PZ', 'B1-02'],
  ['CALEF-502640', 'Valvola sfogo aria automatica', 'Valvole e rubinetteria', 'Caleffi', 'Caleffi S.p.A.', 20, 6, 7.90, 'PZ', 'B2-01'],
  ['CALEF-312430', 'Valvola ritegno 1/2', 'Valvole e rubinetteria', 'Caleffi', 'Caleffi S.p.A.', 18, 6, 6.40, 'PZ', 'B2-02'],
  ['GEN-RAC-001', 'Raccordo diritto 1/2 ottone', 'Raccordi e minuteria', 'Generico', 'Grossista Termoidraulico', 80, 25, 1.25, 'PZ', 'C1-01'],
  ['GEN-RAC-002', 'Curva ottone 1/2', 'Raccordi e minuteria', 'Generico', 'Grossista Termoidraulico', 65, 20, 1.55, 'PZ', 'C1-02'],
  ['GEN-GUA-001', 'Guarnizione 1/2', 'Raccordi e minuteria', 'Generico', 'Grossista Termoidraulico', 150, 50, 0.08, 'PZ', 'C1-03'],
  ['HONEY-T3R', 'Cronotermostato wireless', 'Termostati e componenti elettrici', 'Honeywell', 'Grossista Termoidraulico', 5, 2, 54.00, 'PZ', 'D1-01'],
  ['DAI-PUMP-01', 'Pompa scarico condensa clima', 'Climatizzazione', 'Daikin', 'Daikin Air Conditioning Italy S.p.A.', 6, 2, 43.00, 'PZ', 'D2-01'],
  ['CLI-CAN-080', 'Canalina clima 80 mm', 'Climatizzazione', 'Generico', 'Grossista Clima', 35, 10, 2.35, 'MT', 'D2-02'],
  ['FER-DEF-34', 'Defangatore magnetico 3/4', 'Filtrazione e trattamento acqua', 'Ferroli', 'Ferroli S.p.A.', 8, 3, 39.90, 'PZ', 'E1-01'],
  ['TRAT-POLI-001', 'Cartuccia polifosfati', 'Filtrazione e trattamento acqua', 'Generico', 'Grossista Termoidraulico', 16, 5, 5.80, 'PZ', 'E1-02'],
  ['FUM-COAX-100', 'Prolunga coassiale 60/100', 'Canne fumarie e scarichi', 'Generico', 'Grossista Termoidraulico', 10, 3, 21.00, 'PZ', 'F1-01'],
  ['FUM-CURVA-90', 'Curva coassiale 90 gradi 60/100', 'Canne fumarie e scarichi', 'Generico', 'Grossista Termoidraulico', 8, 3, 18.50, 'PZ', 'F1-02'],
  ['CONS-TEFLON', 'Rotolo teflon professionale', 'Materiale consumo tecnico', 'Generico', 'Ferramenta Tecnica', 40, 12, 0.95, 'PZ', 'G1-01'],
  ['CONS-SILI-TRASP', 'Silicone trasparente sanitario', 'Materiale consumo tecnico', 'Mapei', 'Ferramenta Tecnica', 24, 8, 3.20, 'PZ', 'G1-02'],
  ['DPI-GUA-NIT', 'Guanti nitrile box 100 pezzi', 'Attrezzatura e DPI', 'Generico', 'Ferramenta Tecnica', 12, 4, 6.90, 'BOX', 'H1-01'],
  ['ATT-CERCAFUGHE', 'Spray cercafughe gas', 'Attrezzatura e DPI', 'Rothenberger', 'Ferramenta Tecnica', 10, 3, 7.50, 'PZ', 'H1-02'],
];

function statoDisponibilita(qta, soglia) {
  if (qta <= 0) return 'esaurito';
  if (qta <= soglia) return 'sotto_soglia';
  return 'disponibile';
}

async function ensureCompanyEnterprise() {
  const payload = {
    id: AZIENDA_ID,
    nome: 'CL Thermoservice',
    codice: 'CL_THERMOSERVICE',
    attiva: true,
    stato_abbonamento: 'attivo',
    piano: 'enterprise',
    max_utenti: 999,
    updated_at: now,
  };

  const { data: existing, error: findError } = await supabase
    .from('aziende')
    .select('id')
    .eq('id', AZIENDA_ID)
    .limit(1);

  if (findError) {
    console.error('ERRORE ricerca azienda:', findError);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('aziende')
      .update(payload)
      .eq('id', AZIENDA_ID);

    if (error) {
      console.error('ERRORE aggiornamento azienda enterprise:', error);
      process.exit(1);
    }

    console.log('OK azienda aggiornata a piano enterprise:', AZIENDA_ID);
    return;
  }

  const { error } = await supabase
    .from('aziende')
    .insert({ ...payload, created_at: now });

  if (error) {
    console.error('ERRORE creazione azienda:', error);
    process.exit(1);
  }

  console.log('OK azienda creata con piano enterprise:', AZIENDA_ID);
}

async function seedCategories() {
  const map = new Map();

  for (const [nome, descrizione] of categories) {
    const { data: existing, error: findError } = await supabase
      .from('categorie')
      .select('id,nome')
      .eq('nome', nome)
      .eq('azienda_id', AZIENDA_ID)
      .limit(1);

    if (findError) {
      console.error('ERRORE ricerca categoria:', nome, findError);
      process.exit(1);
    }

    if (existing && existing.length > 0) {
      const row = existing[0];

      const { error: updateError } = await supabase
        .from('categorie')
        .update({ descrizione, azienda_id: AZIENDA_ID })
        .eq('id', row.id);

      if (updateError) {
        console.error('ERRORE aggiornamento categoria:', nome, updateError);
        process.exit(1);
      }

      map.set(nome, row);
      continue;
    }

    const { data, error } = await supabase
      .from('categorie')
      .insert({
        nome,
        descrizione,
        azienda_id: AZIENDA_ID,
        created_at: now,
      })
      .select('id,nome')
      .single();

    if (error) {
      console.error('ERRORE inserimento categoria:', nome, error);
      process.exit(1);
    }

    map.set(nome, data);
  }

  console.log(`OK categorie azienda ${AZIENDA_ID}: ${map.size}`);
  return map;
}

async function seedMaterials(categoryMap) {
  let inserted = 0;
  let updated = 0;

  for (const [codice, descrizione, categoriaNome, marca, fornitore, quantita, sogliaMinima, prezzoNetto, unitaMisura, posizioneScaffale] of materials) {
    const categoria = categoryMap.get(categoriaNome);

    if (!categoria?.id) {
      console.error('ERRORE categoria non trovata per materiale:', codice, categoriaNome);
      process.exit(1);
    }

    const payload = {
      codice,
      descrizione,
      marca,
      quantita,
      categoria_id: categoria.id,
      unita_misura: unitaMisura,
      soglia_minima: sogliaMinima,
      stato_disponibilita: statoDisponibilita(quantita, sogliaMinima),
      posizione_scaffale: posizioneScaffale,
      fornitore,
      note: 'Dato test CL Thermoservice',
      updated_at: now,
      prezzo_netto: prezzoNetto,
      azienda_id: AZIENDA_ID,
    };

    const { data: existing, error: findError } = await supabase
      .from('materiali')
      .select('id')
      .eq('codice', codice)
      .eq('azienda_id', AZIENDA_ID)
      .limit(1);

    if (findError) {
      console.error('ERRORE ricerca materiale:', codice, findError);
      process.exit(1);
    }

    if (existing && existing.length > 0) {
      const { error: updateError } = await supabase
        .from('materiali')
        .update(payload)
        .eq('id', existing[0].id);

      if (updateError) {
        console.error('ERRORE aggiornamento materiale:', codice, updateError);
        process.exit(1);
      }

      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('materiali')
        .insert({ ...payload, created_at: now });

      if (insertError) {
        console.error('ERRORE inserimento materiale:', codice, insertError);
        process.exit(1);
      }

      inserted += 1;
    }
  }

  console.log(`OK materiali CL Thermoservice inseriti: ${inserted}, aggiornati: ${updated}`);
}

async function main() {
  console.log('Seed MagazzinoPro CL Thermoservice avviato...');
  await ensureCompanyEnterprise();
  const categoryMap = await seedCategories();
  await seedMaterials(categoryMap);
  console.log('FATTO.');
}

main().catch((error) => {
  console.error('ERRORE GENERALE:', error);
  process.exit(1);
});

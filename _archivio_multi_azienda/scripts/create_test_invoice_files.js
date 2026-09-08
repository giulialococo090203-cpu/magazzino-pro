import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

function readEnv(name) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  const match = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) return '';

  return match[1].trim().replace(/^["']|["']$/g, '');
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY nel file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function makePdfBuffer(title = 'Fattura test MagazzinoPro') {
  const safeTitle = String(title).replace(/[()\\]/g, '');
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 22 Tf
72 760 Td
(${safeTitle}) Tj
0 -36 Td
/F1 12 Tf
(PDF generato per test archivio fatture.) Tj
0 -22 Td
(Questo file serve solo per verificare apertura e download.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000262 00000 n 
0000000433 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
503
%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

const { data: invoices, error } = await supabase
  .from('fatture_importate')
  .select('id, nome_file, nome_file_originale, percorso_file, bucket')
  .ilike('nome_file', 'TEST_2026_%');

if (error) {
  console.error('❌ Errore lettura fatture:', error.message);
  process.exit(1);
}

if (!invoices?.length) {
  console.log('Nessuna fattura TEST_2026_ trovata.');
  process.exit(0);
}

console.log(`📄 Fatture test trovate: ${invoices.length}`);

let ok = 0;
let fail = 0;

for (const invoice of invoices) {
  const bucket = invoice.bucket || 'fatture';
  const path = invoice.percorso_file;

  if (!path) {
    console.warn(`⚠️ Fattura senza percorso_file: ${invoice.nome_file}`);
    fail += 1;
    continue;
  }

  const pdfBuffer = makePdfBuffer(invoice.nome_file_originale || invoice.nome_file);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error(`❌ Upload fallito ${path}: ${uploadError.message}`);
    fail += 1;
  } else {
    ok += 1;
    if (ok % 25 === 0) console.log(`✅ Creati ${ok}/${invoices.length} PDF test...`);
  }
}

console.log('');
console.log(`✅ PDF creati: ${ok}`);
console.log(`❌ Errori: ${fail}`);
console.log('Ora riapri Archivio Fatture e prova Apri/Download.');

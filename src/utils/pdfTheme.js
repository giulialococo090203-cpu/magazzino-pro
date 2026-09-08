// ============================================================
// PDFTHEME.JS - Colori dei documenti PDF
// ------------------------------------------------------------
// Stessa palette dell'applicazione, in formato RGB per jsPDF.
// Modificando qui si aggiornano tutti i documenti generati.
// ============================================================

export const PDF_COLORS = {
  // Intestazioni e testo
  graphite: [31, 35, 33],      // #1f2321
  graphite2: [51, 55, 51],     // #333733
  text: [31, 35, 33],
  muted: [92, 97, 89],         // #5c6159

  // Colore primario (verde oliva) — usato per linee e titoli
  primary: [101, 122, 69],     // #657a45
  primaryDark: [78, 97, 52],   // #4e6134
  primarySoft: [233, 237, 224],// #e9ede0

  // Nomi storici mantenuti per compatibilità con il codice esistente
  orange: [101, 122, 69],
  orangeDark: [78, 97, 52],

  // Accento (bordeaux) — usato per avvisi e valori critici
  accent: [141, 46, 56],       // #8d2e38
  accentSoft: [248, 236, 238], // #f8ecee

  // Sfondi chiari
  cream: [246, 244, 239],      // #f6f4ef
  cream2: [239, 237, 229],     // #efede5
  border: [217, 212, 199],     // #d9d4c7
  white: [255, 255, 255],

  // Stati
  success: [78, 122, 62],      // #4e7a3e
  warning: [176, 124, 29],     // #b07c1d
  danger: [141, 46, 56],       // #8d2e38
};

export default PDF_COLORS;

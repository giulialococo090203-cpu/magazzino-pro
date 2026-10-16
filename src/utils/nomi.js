/**
 * Scrive un nome di persona con le iniziali maiuscole:
 * "roberto lo coco" → "Roberto Lo Coco", "MARIA D'ANGELO" → "Maria D'Angelo",
 * "anna-maria rossi" → "Anna-Maria Rossi".
 * Un indirizzo email resta com'è.
 */
export function nomeProprio(valore) {
  const testo = String(valore ?? '').trim().replace(/\s+/g, ' ');

  if (!testo || testo.includes('@')) return testo;

  return testo
    .toLocaleLowerCase('it-IT')
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, prima, lettera) => prima + lettera.toLocaleUpperCase('it-IT'));
}

// ============================================================
// CONFIGURAZIONE AZIENDA UNICA
// ------------------------------------------------------------
// L'applicazione è mono-azienda: non esiste più la selezione
// dell'azienda al login né la gestione multi-tenant.
// Tutti i dati sono legati a questo unico azienda_id.
// ============================================================

export const AZIENDA_ID =
  import.meta.env.VITE_AZIENDA_ID || 'cl_thermoservice';

export const AZIENDA_NOME =
  import.meta.env.VITE_AZIENDA_NOME || 'Thermoservice';

export const AZIENDA = {
  id: AZIENDA_ID,
  nome: AZIENDA_NOME,
};

/**
 * Email abilitate alla parte programmatore (supporto tecnico).
 * Configurabile con VITE_PROGRAMMER_EMAIL (anche più email separate da virgola).
 */
export const PROGRAMMER_EMAILS = String(
  import.meta.env.VITE_PROGRAMMER_EMAIL ||
    'giulialococo090203@gmail.com,giulia@gmail.com'
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isProgrammerEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  return Boolean(clean) && PROGRAMMER_EMAILS.includes(clean);
}

export default AZIENDA;

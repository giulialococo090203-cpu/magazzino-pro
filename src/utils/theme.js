// ============================================================
// THEME.JS - Modalita' chiara / scura
// ------------------------------------------------------------
// La scelta viene salvata sul dispositivo. Se l'utente non ha
// mai scelto, si segue l'impostazione del sistema operativo.
// ============================================================

const CHIAVE = 'wm_theme';

export const TEMI = ['light', 'dark'];

function preferenzaSistema() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function temaSalvato() {
  try {
    const valore = localStorage.getItem(CHIAVE);
    return TEMI.includes(valore) ? valore : null;
  } catch {
    return null;
  }
}

export function temaIniziale() {
  return temaSalvato() || preferenzaSistema();
}

export function applicaTema(tema) {
  const valore = TEMI.includes(tema) ? tema : 'light';

  try {
    document.documentElement.setAttribute('data-theme', valore);
    document.documentElement.style.colorScheme = valore;
  } catch {
    // ignora
  }

  return valore;
}

export function salvaTema(tema) {
  try {
    localStorage.setItem(CHIAVE, tema);
  } catch {
    // ignora
  }

  return applicaTema(tema);
}

/** Applica subito il tema iniziale, prima del primo disegno. */
export function inizializzaTema() {
  return applicaTema(temaIniziale());
}

/**
 * Segue le modifiche di sistema finche' l'utente non sceglie
 * esplicitamente una modalita'.
 */
export function ascoltaSistema(callback) {
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const gestisci = (event) => {
      if (temaSalvato()) return;
      callback(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', gestisci);

    return () => media.removeEventListener('change', gestisci);
  } catch {
    return () => {};
  }
}

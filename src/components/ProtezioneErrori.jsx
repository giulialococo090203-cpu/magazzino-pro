/* eslint-disable react-refresh/only-export-components */
import { Component } from 'react';
import { useLocation } from 'react-router-dom';

const CHIAVE_RICARICA = 'wm_ricarica_dopo_aggiornamento';

/**
 * Errore tipico dopo una nuova pubblicazione: il browser ha ancora la
 * versione precedente e cerca file di pagina che non esistono piu'.
 */
function isErroreVersioneVecchia(errore) {
  const testo = String(errore?.message || errore || '');

  return (
    /dynamically imported module/i.test(testo) ||
    /Importing a module script failed/i.test(testo) ||
    /Failed to fetch dynamically/i.test(testo) ||
    /error loading dynamically imported module/i.test(testo) ||
    /ChunkLoadError/i.test(testo) ||
    /Unable to preload CSS/i.test(testo)
  );
}

/**
 * Ricarica una sola volta per sessione: se il problema persiste
 * si mostra il messaggio invece di entrare in un ciclo di ricariche.
 */
export function ricaricaPerNuovaVersione() {
  try {
    const ultima = Number(sessionStorage.getItem(CHIAVE_RICARICA) || 0);

    if (Date.now() - ultima < 30000) return false;

    sessionStorage.setItem(CHIAVE_RICARICA, String(Date.now()));
  } catch {
    // sessionStorage non disponibile: ricarichiamo comunque una volta.
  }

  window.location.reload();
  return true;
}

/**
 * Prima, qualsiasi errore in una pagina lasciava l'intero schermo
 * bianco. Ora l'errore resta confinato e compare un messaggio con
 * il pulsante per ricaricare.
 */
export class ProtezioneErrori extends Component {
  constructor(props) {
    super(props);
    this.state = { errore: null };
  }

  static getDerivedStateFromError(errore) {
    return { errore };
  }

  componentDidCatch(errore, info) {
    console.error('Errore nella pagina:', errore, info?.componentStack);

    if (isErroreVersioneVecchia(errore)) {
      ricaricaPerNuovaVersione();
    }
  }

  render() {
    const { errore } = this.state;

    if (!errore) return this.props.children;

    const versioneVecchia = isErroreVersioneVecchia(errore);

    return (
      <div
        role="alert"
        style={{
          maxWidth: 520,
          margin: '48px auto',
          padding: 24,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        <h2 style={{ margin: '0 0 8px' }}>
          {versioneVecchia ? 'È disponibile una versione nuova' : 'Questa pagina ha avuto un problema'}
        </h2>
        <p style={{ margin: '0 0 20px', opacity: 0.8 }}>
          {versioneVecchia
            ? 'Ricarica per aprire l’app aggiornata.'
            : 'Le altre sezioni funzionano. Prova a ricaricare; se succede ancora, segnala cosa stavi facendo.'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Ricarica
        </button>
      </div>
    );
  }
}

/**
 * Versione da usare dentro il router: cambiando pagina l'errore
 * della pagina precedente si azzera da solo.
 */
export function ProtezionePagina({ children }) {
  const location = useLocation();

  return <ProtezioneErrori key={location.pathname}>{children}</ProtezioneErrori>;
}

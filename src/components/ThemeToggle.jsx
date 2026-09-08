import { useAuth } from '../App';

/**
 * Interruttore fra modalita' chiara e scura.
 * Mostra l'icona della modalita' in cui si passa cliccando.
 */
export default function ThemeToggle({ className = '', tema, onCambia }) {
  const auth = useAuth();

  const temaCorrente = tema || auth?.theme || 'light';
  const cambia = onCambia || auth?.toggleTheme;

  const prossimo = temaCorrente === 'dark' ? 'chiara' : 'scura';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => cambia && cambia()}
      title={`Passa alla modalità ${prossimo}`}
      aria-label={`Passa alla modalità ${prossimo}`}
    >
      {temaCorrente === 'dark' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

import SafeIcon from '../components/SafeIcon';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Schermata mostrata agli utenti quando il programmatore
 * attiva la modalità manutenzione.
 */
export default function Manutenzione({ message, onLogout, tema, onCambiaTema }) {
  return (
    <main className="maintenance-page">
      <ThemeToggle className="theme-toggle-floating" tema={tema} onCambia={onCambiaTema} />

      <div className="card maintenance-card">
        <div className="maintenance-icon">
          <SafeIcon name="settings" size={32} />
        </div>

        <h1 className="page-title">Manutenzione in corso</h1>

        <p className="page-subtitle">
          {message ||
            'Stiamo aggiornando il sistema. L’applicazione tornerà disponibile a breve.'}
        </p>

        <button type="button" className="btn btn-secondary" onClick={onLogout}>
          Esci
        </button>
      </div>
    </main>
  );
}

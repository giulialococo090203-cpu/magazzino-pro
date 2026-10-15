/**
 * Indicatore mostrato mentre si scarica una pagina dell'app.
 * Usa colori ereditati, cosi' funziona sia in chiaro che in scuro.
 */
export default function CaricamentoPagina({ testo = 'Caricamento…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: 220,
        opacity: 0.75,
        fontSize: 15,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderRightColor: 'transparent',
          animation: 'caricamento-giro 0.8s linear infinite',
        }}
      />
      <span>{testo}</span>
      <style>{'@keyframes caricamento-giro { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Rifinitura grafica: va caricata per ultima, dopo tutti gli altri stili.
import './styles/rifinitura.css'
// Tavolozza neutra (bianco / quasi nero): sostituisce i toni crema.
import './styles/tema-neutro.css'
import { inizializzaTema } from './utils/theme'
import { ProtezioneErrori, ricaricaPerNuovaVersione } from './components/ProtezioneErrori'

// Applica la modalita' chiara/scura prima del primo disegno,
// cosi' non si vede il cambio di colore all'avvio.
inizializzaTema()

// Dopo una nuova pubblicazione il browser puo' avere in memoria la pagina
// vecchia, che chiede file non piu' esistenti: in quel caso si ricarica.
window.addEventListener('vite:preloadError', (evento) => {
  if (ricaricaPerNuovaVersione()) {
    evento.preventDefault()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProtezioneErrori>
      <App />
    </ProtezioneErrori>
  </StrictMode>,
)

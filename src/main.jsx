import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { inizializzaTema } from './utils/theme'

// Applica la modalita' chiara/scura prima del primo disegno,
// cosi' non si vede il cambio di colore all'avvio.
inizializzaTema()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

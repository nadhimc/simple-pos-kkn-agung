import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { registerServiceWorker, setupInstallPrompt } from './lib/pwa'
import './index.css'

// Dipasang sebelum React dirender: `beforeinstallprompt` datang sekali dan
// lebih awal dari komponen mana pun.
setupInstallPrompt()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

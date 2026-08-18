import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { logger } from './lib/logger'
import './styles/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('No se encontro el elemento #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: registra el service worker generado por vite-plugin-pwa.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      logger.info('Hay una nueva version disponible')
      updateSW(true).catch((error: unknown) => logger.error('No se pudo actualizar la PWA', error))
    },
    onOfflineReady() {
      logger.info('EdiFeasy esta listo para funcionar sin conexion')
    },
  })
}

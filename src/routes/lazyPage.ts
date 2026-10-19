import { lazy, type ComponentType } from 'react'

/**
 * `lazy` que ademas registra el cargador para poder precargar todas las
 * pantallas en segundo plano despues de ingresar. Asi, al navegar, el codigo
 * ya esta descargado y no aparece el cargador de pagina ("pantallazo").
 */
const loaders: (() => Promise<unknown>)[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  loaders.push(loader)
  return lazy(loader)
}

let preloaded = false

/** Descarga los modulos de todas las pantallas cuando el navegador este libre. */
export function preloadPages(): void {
  if (preloaded) return
  preloaded = true
  const run = () => loaders.forEach((load) => void load().catch(() => undefined))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

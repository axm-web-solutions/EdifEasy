/**
 * Recuperacion tras un despliegue: el navegador (o el service worker) puede
 * tener la version anterior, que pide archivos de pantallas que ya no existen.
 * En ese caso se recarga la pagina una sola vez para traer la version nueva.
 */
const KEY = 'edifeasy:chunk-reload'

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return CHUNK_ERROR.test(message)
}

/** Recarga una vez por minuto como maximo (evita bucles si el servidor falla). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Sin almacenamiento: se recarga igual.
  }
  window.location.reload()
  return true
}

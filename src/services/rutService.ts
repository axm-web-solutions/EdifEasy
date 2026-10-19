/**
 * Lee el texto de un RUT en PDF directamente en el navegador con pdf.js: el
 * archivo nunca sale del equipo del super administrador. pdf.js (~1 MB) se
 * descarga solo al usar esta funcion.
 */
import type { RutTextItem } from '@/features/platform/viewmodels/rut.logic'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 10

export const rutService = {
  async extractText(file: File): Promise<RutTextItem[]> {
    if (file.type && file.type !== 'application/pdf') throw new Error('El archivo debe ser un PDF')
    if (file.size > MAX_BYTES) throw new Error('El PDF supera 10 MB')

    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default

    let doc
    try {
      doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    } catch {
      throw new Error('No se pudo abrir el PDF. Verifica que no este danado ni protegido con clave.')
    }

    const items: RutTextItem[] = []
    try {
      for (let page = 1; page <= Math.min(doc.numPages, MAX_PAGES); page++) {
        const content = await (await doc.getPage(page)).getTextContent()
        for (const entry of content.items) {
          if (!('str' in entry) || !entry.str.trim()) continue
          items.push({
            page,
            x: entry.transform[4],
            y: entry.transform[5],
            width: entry.width,
            text: entry.str,
          })
        }
      }
    } finally {
      void doc.destroy()
    }
    return items
  },
}

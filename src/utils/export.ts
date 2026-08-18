import dayjs from 'dayjs'

/**
 * Exportacion de datos.
 *
 * CSV esta implementado y funcionando. La arquitectura queda preparada para
 * Excel y PDF: basta implementar un nuevo `Exporter` y registrarlo en
 * `EXPORTERS`, sin tocar las paginas que ya llaman a `exportData`.
 */
export interface ExportColumn<T> {
  key: string
  header: string
  value: (row: T) => string | number | null | undefined
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export interface Exporter {
  format: ExportFormat
  label: string
  available: boolean
  run: <T>(rows: T[], columns: ExportColumn<T>[], fileName: string) => void
}

/** Marca de orden de bytes UTF-8 (U+FEFF). */
const UTF8_BOM = String.fromCharCode(0xfeff)

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const header = columns.map((column) => escapeCsv(column.header)).join(';')
  const body = rows
    .map((row) => columns.map((column) => escapeCsv(column.value(row))).join(';'))
    .join('\r\n')
  // El BOM hace que Excel abra el CSV con la codificacion correcta.
  return `${UTF8_BOM}${header}\r\n${body}`
}

function downloadBlob(content: BlobPart, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const csvExporter: Exporter = {
  format: 'csv',
  label: 'CSV',
  available: true,
  run: (rows, columns, fileName) => {
    const csv = toCsv(rows, columns)
    downloadBlob(csv, `${fileName}-${dayjs().format('YYYYMMDD-HHmm')}.csv`, 'text/csv;charset=utf-8')
  },
}

/**
 * Exportadores adicionales. `available: false` significa que la dependencia
 * correspondiente todavia no esta instalada; la UI oculta esas opciones.
 */
export const EXPORTERS: Record<ExportFormat, Exporter> = {
  csv: csvExporter,
  xlsx: {
    format: 'xlsx',
    label: 'Excel',
    available: false,
    run: () => {
      throw new Error('Exportacion a Excel no habilitada. Instala `xlsx` y registra el exportador.')
    },
  },
  pdf: {
    format: 'pdf',
    label: 'PDF',
    available: false,
    run: () => {
      throw new Error('Exportacion a PDF no habilitada. Instala `jspdf` y registra el exportador.')
    },
  },
}

export function exportData<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
  format: ExportFormat = 'csv',
): void {
  const exporter = EXPORTERS[format]
  if (!exporter?.available) {
    throw new Error(`Formato de exportacion no disponible: ${format}`)
  }
  exporter.run(rows, columns, fileName)
}

export function availableExporters(): Exporter[] {
  return Object.values(EXPORTERS).filter((exporter) => exporter.available)
}

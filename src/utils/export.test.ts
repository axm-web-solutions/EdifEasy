import { describe, expect, it } from 'vitest'
import { EXPORTERS, availableExporters, toCsv, type ExportColumn } from './export'
import { formatCurrency, formatFileSize, initials, emptyToNull } from './format'

interface Row {
  name: string
  amount: number
  note: string | null
}

const columns: ExportColumn<Row>[] = [
  { key: 'name', header: 'Nombre', value: (row) => row.name },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'note', header: 'Nota', value: (row) => row.note },
]

describe('toCsv', () => {
  it('genera encabezado y filas separadas por punto y coma', () => {
    const csv = toCsv([{ name: 'Bloque A', amount: 1000, note: null }], columns)
    const lines = csv.split('\r\n')

    expect(lines[0]).toContain('Nombre;Valor;Nota')
    expect(lines[1]).toBe('Bloque A;1000;')
  })

  it('escapa valores que contienen separadores o comillas', () => {
    const csv = toCsv([{ name: 'Aseo; limpieza', amount: 10, note: 'Dijo "hola"' }], columns)
    expect(csv).toContain('"Aseo; limpieza"')
    expect(csv).toContain('"Dijo ""hola"""')
  })

  it('incluye el BOM UTF-8 para que Excel muestre las tildes', () => {
    const csv = toCsv([], columns)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
})

describe('exportadores', () => {
  it('CSV esta disponible y Excel/PDF quedan preparados', () => {
    expect(EXPORTERS.csv.available).toBe(true)
    expect(EXPORTERS.xlsx.available).toBe(false)
    expect(EXPORTERS.pdf.available).toBe(false)
    expect(availableExporters().map((exporter) => exporter.format)).toEqual(['csv'])
  })
})

describe('formatters', () => {
  it('formatea moneda colombiana sin decimales', () => {
    expect(formatCurrency(1500000)).toContain('1.500.000')
    expect(formatCurrency(null)).toBe('$0')
  })

  it('formatea tamanos de archivo', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('genera iniciales de dos letras', () => {
    expect(initials('Carlos Mejia')).toBe('CM')
    expect(initials('Sofia')).toBe('S')
    expect(initials(null)).toBe('?')
  })

  it('convierte cadenas vacias en null antes de guardar', () => {
    expect(emptyToNull({ a: '', b: 'texto', c: 0 })).toEqual({ a: null, b: 'texto', c: 0 })
  })
})

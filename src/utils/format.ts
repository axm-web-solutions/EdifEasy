import dayjs from 'dayjs'

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat('es-CO')

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0'
  return currencyFormatter.format(value)
}

export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0'
  return `$${compactFormatter.format(value)}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0'
  return numberFormatter.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).format('DD/MM/YYYY')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).format('DD/MM/YYYY HH:mm')
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const date = dayjs(value)
  const diffMinutes = dayjs().diff(date, 'minute')

  if (diffMinutes < 1) return 'hace unos segundos'
  if (diffMinutes < 60) return `hace ${diffMinutes} min`

  const diffHours = dayjs().diff(date, 'hour')
  if (diffHours < 24) return `hace ${diffHours} h`

  const diffDays = dayjs().diff(date, 'day')
  if (diffDays < 30) return `hace ${diffDays} d`

  return date.format('DD/MM/YYYY')
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** exponent
  return `${size.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}


/** Convierte '' en null para no enviar cadenas vacias a columnas nullable. */
export function emptyToNull<T extends Record<string, unknown>>(input: T): T {
  const output = { ...input }
  for (const key of Object.keys(output) as (keyof T)[]) {
    if (output[key] === '') {
      output[key] = null as T[keyof T]
    }
  }
  return output
}

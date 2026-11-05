import type {
  AgencyPropertyRow,
  LeaseChargeRow,
  PropertyOperation,
  PropertyStatus,
  PropertyType,
} from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  CATEGORY_LABELS,
  OPERATION_LABELS,
  PRICE_TEXT,
  TYPE_LABELS,
  type StoreLang,
} from './storefront.i18n'

// ------------------------------------------------------------ etiquetas
export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAESTUDIO', label: 'Apartaestudio' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'FINCA', label: 'Finca' },
  { value: 'OTRO', label: 'Otro' },
]

export const OPERATIONS: { value: PropertyOperation; label: string }[] = [
  { value: 'RENT', label: 'Arriendo' },
  { value: 'SALE', label: 'Venta' },
  { value: 'BOTH', label: 'Arriendo y venta' },
]

export const PROPERTY_STATUS: Record<PropertyStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponible', color: 'green' },
  RESERVED: { label: 'Reservada', color: 'gold' },
  RENTED: { label: 'Arrendada', color: 'blue' },
  SOLD: { label: 'Vendida', color: 'purple' },
  INACTIVE: { label: 'Inactiva', color: 'default' },
}

export const typeLabel = (type: PropertyType, lang: StoreLang = 'es') =>
  TYPE_LABELS[lang][type] ?? type
export const operationLabel = (operation: PropertyOperation, lang: StoreLang = 'es') =>
  OPERATION_LABELS[lang][operation] ?? operation

const englishMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
})

/** Pesos colombianos: "$ 2.500.000" en espanol, "COP 2,500,000" en ingles. */
export function money(value: number, lang: StoreLang = 'es'): string {
  return lang === 'en' ? englishMoney.format(value).replace(/\s/g, ' ') : formatCurrency(value)
}

/** Campos comunes de la propiedad privada y la publica (tienda). */
type PropertyLike = Pick<
  AgencyPropertyRow,
  | 'operation'
  | 'rent_price'
  | 'admin_fee'
  | 'sale_price'
  | 'bedrooms'
  | 'bathrooms'
  | 'area_m2'
  | 'parking'
  | 'stratum'
  | 'neighborhood'
  | 'city'
  | 'images'
>

export function priceLines(
  property: PropertyLike,
  lang: StoreLang = 'es',
): { main: string; extra: string | null } {
  const text = PRICE_TEXT[lang]
  const rent =
    property.rent_price !== null
      ? `${money(Number(property.rent_price), lang)} ${text.perMonth}`
      : null
  const sale = property.sale_price !== null ? money(Number(property.sale_price), lang) : null
  const admin =
    Number(property.admin_fee) > 0
      ? `${text.admin} ${money(Number(property.admin_fee), lang)}`
      : null
  if (property.operation === 'SALE') return { main: sale ?? text.priceOnRequest, extra: admin }
  if (property.operation === 'BOTH') {
    return {
      main: rent ?? text.rentOnRequest,
      extra: [sale ? `${text.sale} ${sale}` : null, admin].filter(Boolean).join(' · ') || null,
    }
  }
  return { main: rent ?? text.rentOnRequest, extra: admin }
}

export type SpecKind = 'bedrooms' | 'bathrooms' | 'area' | 'parking' | 'stratum'
export interface SpecItem {
  kind: SpecKind
  label: string
}

/** Caracteristicas principales con su tipo (la vista elige el icono por tipo). */
export function specItems(property: PropertyLike, lang: StoreLang = 'es'): SpecItem[] {
  const text = PRICE_TEXT[lang]
  const items: (SpecItem | null)[] = [
    property.bedrooms ? { kind: 'bedrooms', label: text.bedrooms(property.bedrooms) } : null,
    property.bathrooms ? { kind: 'bathrooms', label: text.bathrooms(property.bathrooms) } : null,
    property.area_m2 ? { kind: 'area', label: `${Number(property.area_m2)} m2` } : null,
    property.parking ? { kind: 'parking', label: text.parking(property.parking) } : null,
    property.stratum ? { kind: 'stratum', label: text.stratum(property.stratum) } : null,
  ]
  return items.filter((item): item is SpecItem => item !== null)
}

export function specs(property: PropertyLike, lang: StoreLang = 'es'): string[] {
  return specItems(property, lang).map((item) => item.label)
}

export function locationLabel(
  property: Pick<PropertyLike, 'neighborhood' | 'city'>,
  lang: StoreLang = 'es',
): string {
  return (
    [property.neighborhood, property.city].filter(Boolean).join(', ') ||
    PRICE_TEXT[lang].noLocation
  )
}

export interface PropertyView {
  id: string
  title: string
  code: string | null
  typeLabel: string
  operationLabel: string
  statusLabel: string
  statusColor: string
  status: PropertyStatus
  price: string
  priceExtra: string | null
  specs: string[]
  location: string
  cover: string | null
  imageCount: number
  isPublished: boolean
  ownerLabel: string | null
}

export function toPropertyView(row: AgencyPropertyRow, ownerName?: string | null): PropertyView {
  const price = priceLines(row)
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    typeLabel: typeLabel(row.property_type),
    operationLabel: operationLabel(row.operation),
    statusLabel: PROPERTY_STATUS[row.status].label,
    statusColor: PROPERTY_STATUS[row.status].color,
    status: row.status,
    price: price.main,
    priceExtra: price.extra,
    specs: specs(row),
    location: locationLabel(row),
    cover: row.images[0] ?? null,
    imageCount: row.images.length,
    isPublished: row.is_published,
    ownerLabel: ownerName ?? row.owner_name ?? null,
  }
}

// ------------------------------------------------------- tienda publica
export interface StorefrontFilters {
  operation: 'ALL' | 'RENT' | 'SALE'
  type: PropertyType | 'ALL'
  city: string
  maxPrice: number | null
  minBedrooms: number | null
  search: string
}

export const EMPTY_FILTERS: StorefrontFilters = {
  operation: 'ALL',
  type: 'ALL',
  city: '',
  maxPrice: null,
  minBedrooms: null,
  search: '',
}

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

type StoreItem = PropertyLike &
  Pick<AgencyPropertyRow, 'id' | 'title' | 'property_type' | 'description'> & {
    code?: string | null
  }

export function filterStorefront<T extends StoreItem>(items: T[], filters: StorefrontFilters): T[] {
  const term = normalize(filters.search.trim())
  return items.filter((item) => {
    const forRent = item.operation === 'RENT' || item.operation === 'BOTH'
    const forSale = item.operation === 'SALE' || item.operation === 'BOTH'
    if (filters.operation === 'RENT' && !forRent) return false
    if (filters.operation === 'SALE' && !forSale) return false
    if (filters.type !== 'ALL' && item.property_type !== filters.type) return false
    if (filters.city && normalize(item.city ?? '') !== normalize(filters.city)) return false
    if (filters.minBedrooms && (item.bedrooms ?? 0) < filters.minBedrooms) return false
    if (filters.maxPrice) {
      const price =
        filters.operation === 'SALE'
          ? item.sale_price
          : filters.operation === 'RENT'
            ? item.rent_price
            : (item.rent_price ?? item.sale_price)
      if (price !== null && Number(price) > filters.maxPrice) return false
    }
    if (term) {
      const haystack = normalize(
        [item.title, item.neighborhood, item.city, item.description, item.code]
          .filter(Boolean)
          .join(' '),
      )
      if (!haystack.includes(term)) return false
    }
    return true
  })
}

export function cityOptions(items: { city: string | null }[]): string[] {
  return [
    ...new Set(
      items.map((item) => item.city?.trim()).filter((city): city is string => Boolean(city)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Mensaje de WhatsApp para preguntar por una propiedad. */
export function inquiryText(
  title: string,
  code: string | null,
  url: string,
  lang: StoreLang = 'es',
): string {
  return PRICE_TEXT[lang].inquiry(title, code, url)
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// --------------------------------------------------------------- cobros
export const CONCEPT_LABELS: Record<LeaseChargeRow['concept'], string> = {
  RENT: 'Canon de arrendamiento',
  ADMIN_FEE: 'Cuota de administracion',
  UTILITIES: 'Servicios publicos',
  LATE_FEE: 'Intereses de mora',
  OTHER: 'Otro cobro',
}

const METHOD_LABELS = {
  ONLINE: 'en linea',
  CASH: 'en efectivo',
  TRANSFER: 'por transferencia',
} as const

export interface ChargeView {
  id: string
  leaseId: string
  concept: string
  periodLabel: string
  amount: number
  amountLabel: string
  dueLabel: string
  statusLabel: string
  statusColor: string
  isPending: boolean
  isOverdue: boolean
  paidLabel: string | null
}

export function periodLabel(period: string): string {
  return new Date(`${period.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })
}

export function toChargeView(row: LeaseChargeRow, today = new Date()): ChargeView {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const overdue = row.status === 'PENDING' && new Date(`${row.due_date}T00:00:00`) < start
  const status =
    row.status === 'PAID'
      ? { label: 'Pagado', color: 'green' }
      : row.status === 'VOID'
        ? { label: 'Anulado', color: 'default' }
        : overdue
          ? { label: 'Vencido', color: 'red' }
          : { label: 'Pendiente', color: 'gold' }
  return {
    id: row.id,
    leaseId: row.lease_id,
    concept: CONCEPT_LABELS[row.concept],
    periodLabel: periodLabel(row.period),
    amount: Number(row.amount),
    amountLabel: formatCurrency(Number(row.amount)),
    dueLabel: formatDate(row.due_date),
    statusLabel: status.label,
    statusColor: status.color,
    isPending: row.status === 'PENDING',
    isOverdue: overdue,
    paidLabel:
      row.status === 'PAID' && row.paid_at
        ? `Pagado ${row.payment_method ? METHOD_LABELS[row.payment_method] : ''} el ${formatDate(row.paid_at)}`.replace(
            '  ',
            ' ',
          )
        : null,
  }
}

export function chargesSummary(views: ChargeView[]) {
  const pending = views.filter((view) => view.isPending)
  const overdue = pending.filter((view) => view.isOverdue)
  const sum = (items: ChargeView[]) => items.reduce((total, item) => total + item.amount, 0)
  return {
    pendingCount: pending.length,
    pendingTotal: formatCurrency(sum(pending)),
    overdueCount: overdue.length,
    overdueTotal: formatCurrency(sum(overdue)),
  }
}

/** Mes de cobro: el actual y los dos siguientes/anteriores, como YYYY-MM-01. */
export function periodOptions(today = new Date()): { value: string; label: string }[] {
  return [-2, -1, 0, 1, 2].map((offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    return { value, label: periodLabel(value) }
  })
}

// ---------------------------------------------------------------- panel
export function agencyStats(properties: AgencyPropertyRow[]) {
  const active = properties.filter((item) => item.status !== 'INACTIVE' && item.status !== 'SOLD')
  const rented = active.filter((item) => item.status === 'RENTED').length
  const rentable = active.filter((item) => item.operation !== 'SALE').length
  return {
    total: active.length,
    available: active.filter((item) => item.status === 'AVAILABLE').length,
    rented,
    published: active.filter((item) => item.is_published).length,
    occupancy: rentable ? Math.round((rented / rentable) * 100) : 0,
  }
}

// ----------------------------------------------------------------- mapa
/** Precio corto para los marcadores del mapa: "$2,5 M", "$950 mil", "$980 M". */
export function markerPrice(
  item: {
    operation: PropertyOperation
    rent_price: number | null
    sale_price: number | null
  },
  lang: StoreLang = 'es',
): string {
  const words = PRICE_TEXT[lang].marker
  const locale = lang === 'en' ? 'en-US' : 'es-CO'
  const value = item.operation === 'SALE' ? item.sale_price : (item.rent_price ?? item.sale_price)
  if (value === null || value === undefined) return words.see
  const amount = Number(value)
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const text =
      millions >= 100
        ? Math.round(millions).toLocaleString(locale)
        : millions.toLocaleString(locale, { maximumFractionDigits: 1 })
    return `$${text} ${words.million}`
  }
  const thousands = Math.round(amount / 1000).toLocaleString(locale)
  return lang === 'en' ? `$${thousands}${words.thousand}` : `$${thousands} ${words.thousand}`
}

/** Centro del mapa: promedio de las propiedades ubicadas, o Bogota. */
export function mapCenter(points: { lat: number | null; lng: number | null }[]): {
  lat: number
  lng: number
} {
  const located = points.filter(
    (point): point is { lat: number; lng: number } => point.lat !== null && point.lng !== null,
  )
  if (located.length === 0) return { lat: 4.711, lng: -74.0721 }
  const lat = located.reduce((sum, point) => sum + Number(point.lat), 0) / located.length
  const lng = located.reduce((sum, point) => sum + Number(point.lng), 0) / located.length
  return { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 }
}

/** Categorias de la tienda (chips con icono, estilo Airbnb). */
const CATEGORY_ORDER: (PropertyType | 'ALL')[] = [
  'ALL',
  'APARTAMENTO',
  'CASA',
  'APARTAESTUDIO',
  'LOCAL',
  'OFICINA',
  'BODEGA',
  'LOTE',
  'FINCA',
]

export function storeCategories(
  lang: StoreLang = 'es',
): { value: PropertyType | 'ALL'; label: string }[] {
  return CATEGORY_ORDER.map((value) => ({ value, label: CATEGORY_LABELS[lang][value] }))
}

export const STORE_CATEGORIES = storeCategories('es')

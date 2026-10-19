/**
 * Reglas puras de los clasificados (sin React): textos, filtros y que acciones
 * puede hacer cada persona. La base vuelve a validar todo con RLS y triggers.
 */
import type { Json, ListingCategory, ListingPriceType, ListingStatus } from '@/types/database'
import type { ListingWithRelations } from '@/services/listingService'
import {
  CATEGORIES_WITH_CONDITION,
  LISTING_CATEGORIES,
  LISTING_PRICE_TYPES,
  LISTING_STATUS,
  PROPERTY_CATEGORIES,
} from '@/constants/listings'
import { formatCurrency } from '@/utils/format'
import { telHref, whatsappHref } from '@/utils/phone'

export interface ListingDetails {
  bedrooms?: number | null
  bathrooms?: number | null
  area_m2?: number | null
  parking?: boolean | null
  modality?: 'IN_PERSON' | 'ONLINE' | 'BOTH' | null
  delivery?: boolean | null
  schedule?: string | null
}

function listingPaths(images: Json): string[] {
  return Array.isArray(images)
    ? images.filter((item): item is string => typeof item === 'string')
    : []
}

export function readDetails(details: Json): ListingDetails {
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as ListingDetails)
    : {}
}

export function priceLabel(price: number | null, priceType: ListingPriceType): string {
  if (priceType === 'FREE') return 'Gratis'
  if (price === null || price === undefined) return 'A convenir'
  return formatCurrency(Number(price)) + LISTING_PRICE_TYPES[priceType].suffix
}

const MODALITY = { IN_PERSON: 'Presencial', ONLINE: 'Virtual', BOTH: 'Presencial o virtual' }

/** Etiquetas cortas segun la categoria (habitaciones, estado, modalidad...). */
export function detailChips(
  category: ListingCategory,
  details: ListingDetails,
  condition: 'NEW' | 'USED' | null,
): string[] {
  const chips: string[] = []
  if (CATEGORIES_WITH_CONDITION.includes(category) && condition)
    chips.push(condition === 'NEW' ? 'Nuevo' : 'Usado')
  if (PROPERTY_CATEGORIES.includes(category)) {
    if (details.bedrooms) chips.push(`${details.bedrooms} hab.`)
    if (details.bathrooms) chips.push(`${details.bathrooms} bano(s)`)
    if (details.area_m2) chips.push(`${details.area_m2} m2`)
    if (details.parking) chips.push('Parqueadero')
  }
  if (category === 'CLASSES' && details.modality) chips.push(MODALITY[details.modality])
  if (category === 'FOOD' && details.delivery) chips.push('Entrega a domicilio')
  if (details.schedule) chips.push(details.schedule)
  return chips
}

export interface ListingView {
  id: string
  title: string
  description: string
  category: ListingCategory
  categoryLabel: string
  color: string
  price: number | null
  priceLabel: string
  chips: string[]
  images: string[]
  cover: string | null
  sellerLabel: string
  publishedAt: string | null
  status: ListingStatus
  statusLabel: string
  statusColor: string
  expired: boolean
  isMine: boolean
  reviewNotes: string | null
  callHref: string | null
  whatsappHref: string | null
  canEdit: boolean
  canMarkSold: boolean
  canArchive: boolean
  canRepublish: boolean
  canDelete: boolean
  canReview: boolean
  /** Fila original, para editarla. */
  row: ListingWithRelations
}

export function toListingView(
  row: ListingWithRelations,
  viewer: { userId: string | null; isAdmin: boolean },
  now = Date.now(),
): ListingView {
  const isMine = row.created_by === viewer.userId
  const expired = Boolean(row.expires_at && Date.parse(row.expires_at) <= now)
  const images = listingPaths(row.images)
  const unit = row.apartment
    ? `${row.apartment.building?.name ? `${row.apartment.building.name} · ` : ''}Apto ${row.apartment.number}`
    : null
  const active = row.status === 'APPROVED' || row.status === 'PENDING' || row.status === 'REJECTED'
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: LISTING_CATEGORIES[row.category].label,
    color: LISTING_CATEGORIES[row.category].hex,
    price: row.price === null ? null : Number(row.price),
    priceLabel: priceLabel(row.price, row.price_type),
    chips: detailChips(row.category, readDetails(row.details), row.item_condition),
    images,
    cover: images[0] ?? null,
    sellerLabel: [row.author?.full_name, unit].filter(Boolean).join(' · ') || 'Vecino del conjunto',
    publishedAt: row.published_at,
    status: row.status,
    statusLabel:
      expired && row.status === 'APPROVED' ? 'Vencida' : LISTING_STATUS[row.status].label,
    statusColor:
      expired && row.status === 'APPROVED' ? 'default' : LISTING_STATUS[row.status].color,
    expired,
    isMine,
    reviewNotes: row.review_notes,
    callHref: telHref(row.contact_phone),
    whatsappHref: whatsappHref(
      row.contact_whatsapp ?? row.contact_phone,
      `Hola, vi tu publicacion "${row.title}" en EdiFeasy.`,
    ),
    canEdit: isMine,
    canMarkSold: isMine && row.status === 'APPROVED' && !expired,
    canArchive: (isMine || viewer.isAdmin) && active,
    canRepublish: isMine && (row.status === 'SOLD' || row.status === 'ARCHIVED' || expired),
    canDelete: isMine || viewer.isAdmin,
    canReview: viewer.isAdmin && row.status === 'PENDING',
    row,
  }
}

export type ClassifiedsTab = 'explorar' | 'mias' | 'revisar'
export type ClassifiedsSort = 'recent' | 'price_asc' | 'price_desc'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function inTab(view: ListingView, tab: ClassifiedsTab): boolean {
  if (tab === 'mias') return view.isMine
  if (tab === 'revisar') return view.status === 'PENDING'
  return view.status === 'APPROVED' && !view.expired
}

export function filterListings(
  views: ListingView[],
  filters: {
    tab: ClassifiedsTab
    category: ListingCategory | null
    search: string
    sort: ClassifiedsSort
  },
): ListingView[] {
  const search = normalize(filters.search.trim())
  const result = views.filter(
    (view) =>
      inTab(view, filters.tab) &&
      (!filters.category || view.category === filters.category) &&
      (!search ||
        normalize(`${view.title} ${view.description} ${view.categoryLabel}`).includes(search)),
  )
  if (filters.sort === 'recent') return result
  // Sin precio (a convenir) al final en ambos ordenes.
  const value = (view: ListingView) =>
    view.price ?? (filters.sort === 'price_asc' ? Infinity : -Infinity)
  return [...result].sort((a, b) =>
    filters.sort === 'price_asc' ? value(a) - value(b) : value(b) - value(a),
  )
}

/** Conteo por categoria de lo publicado (chips de filtro). */
export function categoryCounts(
  views: ListingView[],
): { value: ListingCategory; label: string; count: number }[] {
  const counts = new Map<ListingCategory, number>()
  for (const view of views)
    if (inTab(view, 'explorar')) counts.set(view.category, (counts.get(view.category) ?? 0) + 1)
  return (Object.keys(LISTING_CATEGORIES) as ListingCategory[]).map((value) => ({
    value,
    label: LISTING_CATEGORIES[value].label,
    count: counts.get(value) ?? 0,
  }))
}

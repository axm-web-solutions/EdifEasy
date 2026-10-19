import { describe, expect, it } from 'vitest'
import type { ListingWithRelations } from '@/services/listingService'
import {
  categoryCounts,
  detailChips,
  filterListings,
  priceLabel,
  toListingView,
} from './classifieds.logic'

const NOW = Date.parse('2026-10-19T12:00:00Z')

const row = (overrides: Partial<ListingWithRelations> = {}): ListingWithRelations => ({
  id: 'l1',
  condominium_id: 'c',
  apartment_id: 'a',
  category: 'PRODUCTS',
  title: 'Bicicleta rin 26',
  description: 'En muy buen estado',
  price: 300000,
  price_type: 'NEGOTIABLE',
  item_condition: 'USED',
  details: {},
  images: ['c/listings/u1/1.jpg', 'c/listings/u1/2.jpg'],
  contact_phone: '3001112233',
  contact_whatsapp: null,
  status: 'APPROVED',
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  published_at: '2026-10-18T10:00:00Z',
  expires_at: '2026-12-17T10:00:00Z',
  created_by: 'u1',
  created_at: '',
  updated_at: '',
  author: { id: 'u1', full_name: 'Ana Perez' },
  apartment: { id: 'a', number: '101', building: { id: 'b', name: 'Torre 1' } },
  ...overrides,
})

const owner = { userId: 'u1', isAdmin: false }
const neighbor = { userId: 'u2', isAdmin: false }
const admin = { userId: 'u9', isAdmin: true }

describe('textos', () => {
  it('precio segun el tipo', () => {
    expect(priceLabel(300000, 'NEGOTIABLE')).toMatch(/300\.000 \(negociable\)$/)
    expect(priceLabel(1800000, 'PER_MONTH')).toMatch(/ \/ mes$/)
    expect(priceLabel(null, 'FREE')).toBe('Gratis')
    expect(priceLabel(null, 'FIXED')).toBe('A convenir')
  })
  it('detalles segun la categoria', () => {
    expect(
      detailChips('PROPERTY_RENT', { bedrooms: 3, bathrooms: 2, area_m2: 70, parking: true }, null),
    ).toEqual(['3 hab.', '2 bano(s)', '70 m2', 'Parqueadero'])
    expect(detailChips('PRODUCTS', {}, 'NEW')).toEqual(['Nuevo'])
    expect(detailChips('CLASSES', { modality: 'ONLINE', schedule: 'Sabados 8am' }, null)).toEqual([
      'Virtual',
      'Sabados 8am',
    ])
    expect(detailChips('FOOD', { delivery: true }, 'NEW')).toEqual(['Entrega a domicilio'])
  })
})

describe('toListingView', () => {
  it('tarjeta con portada, vendedor y contacto', () => {
    const view = toListingView(row(), neighbor, NOW)
    expect(view.cover).toBe('c/listings/u1/1.jpg')
    expect(view.sellerLabel).toBe('Ana Perez · Torre 1 · Apto 101')
    expect(view.callHref).toBe('tel:3001112233')
    expect(view.whatsappHref).toContain('wa.me/573001112233?text=')
  })

  it('el vecino solo contacta', () => {
    const view = toListingView(row(), neighbor, NOW)
    expect([
      view.canEdit,
      view.canMarkSold,
      view.canArchive,
      view.canDelete,
      view.canReview,
    ]).toEqual([false, false, false, false, false])
  })

  it('el autor edita, marca vendida, archiva y borra', () => {
    const view = toListingView(row(), owner, NOW)
    expect([view.canEdit, view.canMarkSold, view.canArchive, view.canDelete]).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(view.canRepublish).toBe(false)
  })

  it('vencida: se puede republicar, no marcar vendida', () => {
    const view = toListingView(row({ expires_at: '2026-10-01T00:00:00Z' }), owner, NOW)
    expect(view.statusLabel).toBe('Vencida')
    expect(view.canRepublish).toBe(true)
    expect(view.canMarkSold).toBe(false)
  })

  it('la administracion revisa las pendientes', () => {
    expect(toListingView(row({ status: 'PENDING' }), admin, NOW).canReview).toBe(true)
    expect(toListingView(row(), admin, NOW).canReview).toBe(false)
    expect(toListingView(row(), admin, NOW).canDelete).toBe(true)
  })
})

describe('filterListings', () => {
  const views = [
    toListingView(row({ id: '1', price: 300000 }), owner, NOW),
    toListingView(
      row({ id: '2', category: 'FOOD', title: 'Postres caseros', price: 8000, created_by: 'u2' }),
      owner,
      NOW,
    ),
    toListingView(row({ id: '3', status: 'PENDING', created_by: 'u2' }), owner, NOW),
    toListingView(row({ id: '4', price: null, price_type: 'FIXED', created_by: 'u3' }), owner, NOW),
    toListingView(row({ id: '5', expires_at: '2026-10-01T00:00:00Z' }), owner, NOW),
  ]
  const base = { tab: 'explorar' as const, category: null, search: '', sort: 'recent' as const }

  it('explorar: aprobadas y vigentes', () => {
    expect(filterListings(views, base).map((v) => v.id)).toEqual(['1', '2', '4'])
  })
  it('mias y revisar', () => {
    expect(filterListings(views, { ...base, tab: 'mias' }).map((v) => v.id)).toEqual(['1', '5'])
    expect(filterListings(views, { ...base, tab: 'revisar' }).map((v) => v.id)).toEqual(['3'])
  })
  it('categoria y busqueda sin tildes', () => {
    expect(filterListings(views, { ...base, category: 'FOOD' }).map((v) => v.id)).toEqual(['2'])
    expect(filterListings(views, { ...base, search: 'POSTRÉS' }).map((v) => v.id)).toEqual(['2'])
  })
  it('orden por precio con "a convenir" al final', () => {
    expect(filterListings(views, { ...base, sort: 'price_asc' }).map((v) => v.id)).toEqual([
      '2',
      '1',
      '4',
    ])
    expect(filterListings(views, { ...base, sort: 'price_desc' }).map((v) => v.id)).toEqual([
      '1',
      '2',
      '4',
    ])
  })
  it('conteo por categoria de lo publicado', () => {
    const counts = Object.fromEntries(categoryCounts(views).map((c) => [c.value, c.count]))
    expect(counts.PRODUCTS).toBe(2)
    expect(counts.FOOD).toBe(1)
    expect(counts.CLASSES).toBe(0)
  })
})

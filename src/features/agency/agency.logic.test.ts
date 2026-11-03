import { describe, expect, it } from 'vitest'
import type { AgencyPropertyRow, LeaseChargeRow } from '@/types/database'
import {
  EMPTY_FILTERS,
  agencyStats,
  chargesSummary,
  cityOptions,
  filterStorefront,
  inquiryText,
  periodOptions,
  priceLines,
  slugify,
  specs,
  toChargeView,
  toPropertyView,
} from './agency.logic'

const property = (overrides: Partial<AgencyPropertyRow> = {}): AgencyPropertyRow => ({
  id: 'p1',
  condominium_id: 'a',
  code: 'A-101',
  title: 'Apartamento en Cedritos',
  property_type: 'APARTAMENTO',
  operation: 'RENT',
  status: 'AVAILABLE',
  is_published: true,
  rent_price: 2500000,
  admin_fee: 350000,
  sale_price: null,
  address: 'Calle 147',
  neighborhood: 'Cedritos',
  city: 'Bogota',
  stratum: 4,
  area_m2: 72,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  floor: 5,
  furnished: false,
  pets_allowed: true,
  amenities: [],
  description: 'Con balcon y vista',
  images: ['https://x/1.jpg', 'https://x/2.jpg'],
  owner_profile_id: null,
  owner_name: 'Pedro Dueno',
  owner_phone: null,
  linked_apartment_id: null,
  published_at: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const charge = (overrides: Partial<LeaseChargeRow> = {}): LeaseChargeRow => ({
  id: 'c1',
  condominium_id: 'a',
  lease_id: 'l1',
  property_id: 'p1',
  period: '2026-11-01',
  concept: 'RENT',
  description: null,
  amount: 2500000,
  due_date: '2026-11-05',
  status: 'PENDING',
  paid_at: null,
  payment_method: null,
  payment_id: null,
  created_at: '',
  ...overrides,
})

describe('propiedades', () => {
  it('precio segun la operacion', () => {
    expect(priceLines(property())).toEqual({
      main: expect.stringMatching(/2\.500\.000 \/ mes$/),
      extra: expect.stringMatching(/^Adm\. .*350\.000$/),
    })
    expect(
      priceLines(
        property({ operation: 'SALE', rent_price: null, sale_price: 850000000, admin_fee: 0 }),
      ),
    ).toEqual({
      main: expect.stringMatching(/850\.000\.000$/),
      extra: null,
    })
    const both = priceLines(property({ operation: 'BOTH', sale_price: 600000000 }))
    expect(both.extra).toMatch(/^Venta .*600\.000\.000 · Adm\./)
  })

  it('ficha y vista', () => {
    expect(specs(property())).toEqual(['3 hab.', '2 banos', '72 m2', '1 parq.', 'Estrato 4'])
    expect(
      specs(property({ bathrooms: 1, bedrooms: null, area_m2: null, parking: 0, stratum: null })),
    ).toEqual(['1 bano'])
    expect(toPropertyView(property())).toMatchObject({
      typeLabel: 'Apartamento',
      operationLabel: 'Arriendo',
      statusLabel: 'Disponible',
      location: 'Cedritos, Bogota',
      cover: 'https://x/1.jpg',
      imageCount: 2,
      ownerLabel: 'Pedro Dueno',
    })
  })

  it('cifras del panel', () => {
    expect(
      agencyStats([
        property({ id: '1', status: 'RENTED' }),
        property({ id: '2' }),
        property({ id: '3', operation: 'SALE', is_published: false }),
        property({ id: '4', status: 'INACTIVE' }),
      ]),
    ).toEqual({ total: 3, available: 2, rented: 1, published: 2, occupancy: 50 })
  })
})

describe('tienda publica', () => {
  const items = [
    property({ id: 'r1' }),
    property({
      id: 's1',
      title: 'Casa campestre',
      property_type: 'CASA',
      operation: 'SALE',
      rent_price: null,
      sale_price: 900000000,
      city: 'Chía',
      bedrooms: 4,
    }),
    property({
      id: 'b1',
      operation: 'BOTH',
      sale_price: 500000000,
      rent_price: 1800000,
      bedrooms: 2,
      neighborhood: 'Usaquén',
    }),
  ]
  it('filtra por operacion, tipo, ciudad, precio y habitaciones', () => {
    const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
      filterStorefront(items, { ...EMPTY_FILTERS, ...f }).map((p) => p.id)
    expect(ids({ operation: 'RENT' })).toEqual(['r1', 'b1'])
    expect(ids({ operation: 'SALE' })).toEqual(['s1', 'b1'])
    expect(ids({ type: 'CASA' })).toEqual(['s1'])
    expect(ids({ city: 'chia' })).toEqual(['s1'])
    expect(ids({ operation: 'RENT', maxPrice: 2000000 })).toEqual(['b1'])
    expect(ids({ minBedrooms: 3 })).toEqual(['r1', 's1'])
    expect(ids({ search: 'usaquen' })).toEqual(['b1'])
  })
  it('ciudades, mensaje y enlace', () => {
    expect(cityOptions(items)).toEqual(['Bogota', 'Chía'])
    expect(inquiryText('Casa', 'C-1', 'https://edifeasy.com/i/sol/p/1')).toBe(
      'Hola, me interesa la propiedad "Casa" (ref. C-1): https://edifeasy.com/i/sol/p/1',
    )
    expect(slugify('Inmobiliaria Peña & Asociados S.A.S.')).toBe(
      'inmobiliaria-pena-asociados-s-a-s',
    )
  })
})

describe('cobros', () => {
  const today = new Date('2026-11-08T10:00:00')
  it('estado y vencimiento', () => {
    expect(toChargeView(charge(), today)).toMatchObject({
      statusLabel: 'Vencido',
      isOverdue: true,
      concept: 'Canon de arrendamiento',
    })
    expect(toChargeView(charge({ due_date: '2026-11-10' }), today)).toMatchObject({
      statusLabel: 'Pendiente',
      isOverdue: false,
    })
    expect(
      toChargeView(
        charge({ status: 'PAID', paid_at: '2026-11-04T10:00:00Z', payment_method: 'ONLINE' }),
        today,
      ).paidLabel,
    ).toMatch(/^Pagado en linea el /)
  })
  it('resumen y meses', () => {
    const views = [
      toChargeView(charge({ id: '1' }), today),
      toChargeView(
        charge({ id: '2', concept: 'ADMIN_FEE', amount: 350000, due_date: '2026-11-30' }),
        today,
      ),
      toChargeView(charge({ id: '3', status: 'PAID' }), today),
    ]
    expect(chargesSummary(views)).toMatchObject({ pendingCount: 2, overdueCount: 1 })
    expect(periodOptions(today).map((p) => p.value)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ])
  })
})

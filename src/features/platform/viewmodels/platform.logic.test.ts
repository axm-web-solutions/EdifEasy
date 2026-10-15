import { describe, expect, it } from 'vitest'
import type { ListParams, PlatformCondominium } from '@/types/models'
import { planState, queryCondominiums } from './platform.logic'

const condo = (overrides: Partial<PlatformCondominium>): PlatformCondominium => ({
  id: overrides.name ?? 'x',
  name: 'X',
  city: 'Bogota',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  apartments: 10,
  members: 20,
  owners: 8,
  admins: [],
  plan: null,
  last_payment_at: null,
  ...overrides,
})

const rows = [
  condo({
    name: 'Horeb',
    city: 'Armenia',
    apartments: 16,
    plan: { period: 'ANNUAL', ends_at: '2027-01-01', active: true },
  }),
  condo({
    name: 'Altos del Parque',
    apartments: 15,
    admins: [{ full_name: 'Carlos Mejia', email: 'admin@edifeasy.com' }],
  }),
  condo({
    name: 'Bosques',
    status: 'SUSPENDED',
    apartments: 120,
    plan: { period: 'MONTHLY', ends_at: '2026-01-01', active: false },
  }),
]

const params = (overrides: Partial<ListParams> = {}): ListParams => ({
  page: 1,
  pageSize: 10,
  ...overrides,
})

describe('platform.logic', () => {
  it('clasifica el plan', () => {
    expect(rows.map(planState)).toEqual(['ACTIVE', 'NONE', 'EXPIRED'])
  })

  it('busca por nombre, ciudad o administrador', () => {
    expect(queryCondominiums(rows, params({ search: 'armenia' })).page.map((r) => r.name)).toEqual([
      'Horeb',
    ])
    expect(
      queryCondominiums(rows, params({ search: 'admin@edifeasy' })).page.map((r) => r.name),
    ).toEqual(['Altos del Parque'])
  })

  it('filtra por estado y plan', () => {
    expect(queryCondominiums(rows, params({ filters: { status: 'SUSPENDED' } })).total).toBe(1)
    expect(queryCondominiums(rows, params({ filters: { plan: 'NONE' } })).page[0].name).toBe(
      'Altos del Parque',
    )
  })

  it('ordena y pagina', () => {
    const sorted = queryCondominiums(
      rows,
      params({ sortBy: 'apartments', sortDir: 'desc', pageSize: 2 }),
    )
    expect(sorted.page.map((r) => r.name)).toEqual(['Bosques', 'Horeb'])
    expect(sorted.total).toBe(3)
    expect(sorted.all).toHaveLength(3)
  })
})

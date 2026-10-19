import { describe, expect, it } from 'vitest'
import type { CommunityContactRow } from '@/types/database'
import type { NearbyPlace } from '@/services/placesService'
import { buildMarketItems, categoryChips, filterMarketItems } from './marketplace.logic'

const contact = (overrides: Partial<CommunityContactRow>): CommunityContactRow => ({
  id: 'c1',
  condominium_id: 'x',
  kind: 'SERVICE',
  category: 'plumber',
  name: 'Plomeria Don Jorge',
  phone: '3101112233',
  whatsapp: null,
  description: 'Calentadores y tuberias',
  address: null,
  sort_order: 0,
  is_active: true,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const place = (overrides: Partial<NearbyPlace>): NearbyPlace => ({
  id: 'node/1',
  name: 'Ferreteria El Tornillo',
  category: 'hardware',
  lat: 4.6,
  lon: -75.6,
  distance: 400,
  address: null,
  phone: null,
  website: null,
  whatsapp: null,
  openingHours: null,
  ...overrides,
})

describe('buildMarketItems', () => {
  const items = buildMarketItems(
    [
      contact({}),
      contact({ id: 'e1', kind: 'EMERGENCY', name: 'Cuadrante' }),
      contact({
        id: 'c2',
        category: 'moving',
        name: 'Trasteos Rapidos',
        phone: null,
        whatsapp: '3204445566',
        description: null,
      }),
    ],
    [
      place({ id: 'n2', distance: 900 }),
      place({
        id: 'n1',
        name: 'Taxis Libres',
        category: 'taxi',
        distance: 100,
        phone: '6067451234',
      }),
      place({ id: 'n3', name: 'Parque', category: 'park' }),
      place({ id: 'n4', name: 'Pizzeria', category: 'restaurant', distance: 50 }),
    ],
  )

  it('recomendados primero, luego el mapa por cercania; sin emergencias ni parques', () => {
    expect(items.map((item) => item.name)).toEqual([
      'Plomeria Don Jorge',
      'Trasteos Rapidos',
      'Pizzeria',
      'Taxis Libres',
      'Ferreteria El Tornillo',
    ])
  })

  it('arma enlaces de llamada y WhatsApp', () => {
    expect(items[0].callHref).toBe('tel:3101112233')
    expect(items[0].whatsappHref).toContain('https://wa.me/573101112233')
    expect(items[1].callHref).toBeNull()
    expect(items[1].whatsappHref).toContain('wa.me/573204445566')
    expect(items[1].categoryLabel).toBe('Mudanzas')
    expect(items[3].callHref).toBe('tel:6067451234')
    expect(items[3].whatsappHref).toBeNull()
    expect(items[3].distanceLabel).toBe('100 m')
  })

  it('filtra por categoria, telefono y texto sin tildes', () => {
    expect(
      filterMarketItems(items, { category: 'taxi', search: '', onlyWithPhone: false }),
    ).toHaveLength(1)
    expect(
      filterMarketItems(items, { category: null, search: '', onlyWithPhone: true }).map(
        (item) => item.name,
      ),
    ).toEqual(['Plomeria Don Jorge', 'Trasteos Rapidos', 'Taxis Libres'])
    expect(
      filterMarketItems(items, { category: null, search: 'tubérias', onlyWithPhone: false }).map(
        (item) => item.name,
      ),
    ).toEqual(['Plomeria Don Jorge'])
  })

  it('chips en el orden del catalogo con conteo', () => {
    expect(categoryChips(items)).toEqual([
      { value: 'plumber', label: 'Plomeros', count: 1 },
      { value: 'hardware', label: 'Ferreterias', count: 1 },
      { value: 'taxi', label: 'Taxis', count: 1 },
      { value: 'restaurant', label: 'Restaurantes', count: 1 },
      { value: 'moving', label: 'Mudanzas', count: 1 },
    ])
  })
})

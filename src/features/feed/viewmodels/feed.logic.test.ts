import { describe, expect, it } from 'vitest'
import type { CommunityContactRow } from '@/types/database'
import type { FeedPost } from '@/types/models'
import type { NearbyPlace } from '@/services/placesService'
import {
  audienceLabel,
  formatDistance,
  initials,
  nearestEmergencyPlaces,
  toEmergencyContacts,
  toPostView,
} from './feed.logic'

const post = (overrides: Partial<FeedPost> = {}): FeedPost =>
  ({
    id: 'p1',
    condominium_id: 'c1',
    building_id: null,
    apartment_id: null,
    title: 'Corte de agua',
    content: 'Manana de 8 a 12',
    image_url: null,
    attachments: [],
    audience: 'CONDOMINIUM',
    audience_role_id: null,
    status: 'PUBLISHED',
    pinned: false,
    published_at: '2026-10-18T10:00:00Z',
    expires_at: null,
    created_by: 'u1',
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
    author: { id: 'u1', full_name: 'Maria Lopez', email: 'm@x.co', avatar_url: null, phone: null },
    building: null,
    audience_role: null,
    ...overrides,
  }) as FeedPost

describe('audienceLabel', () => {
  it('todo el conjunto', () => expect(audienceLabel(post())).toBe('Todo el conjunto'))
  it('bloque por nombre', () =>
    expect(audienceLabel(post({ audience: 'BUILDING', building: { id: 'b', name: 'Torre 2' } }))).toBe(
      'Torre 2',
    ))
  it('rol en plural', () =>
    expect(
      audienceLabel(post({ audience: 'ROLE', audience_role: { id: 'r', code: 'TENANT', name: 'Arrendatario' } })),
    ).toBe('Arrendatarios'))
})

describe('toPostView', () => {
  it('usa el autor y sus iniciales', () => {
    const view = toPostView(post({ pinned: true }))
    expect(view.authorName).toBe('Maria Lopez')
    expect(view.authorInitials).toBe('ML')
    expect(view.pinned).toBe(true)
    expect(view.audienceIsEveryone).toBe(true)
  })
  it('sin autor muestra Administracion', () => {
    expect(toPostView(post({ author: null })).authorName).toBe('Administracion')
  })
})

describe('initials', () => {
  it('una o varias palabras', () => {
    expect(initials('Juan')).toBe('J')
    expect(initials('  juan felipe orjuela ')).toBe('JO')
    expect(initials('')).toBe('A')
  })
})

const contact = (overrides: Partial<CommunityContactRow>): CommunityContactRow => ({
  id: 'x',
  condominium_id: 'c1',
  kind: 'EMERGENCY',
  category: 'police',
  name: 'Cuadrante 12',
  phone: '3201234567',
  whatsapp: null,
  description: null,
  address: null,
  sort_order: 0,
  is_active: true,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('toEmergencyContacts', () => {
  it('solo emergencias activas, con enlace para llamar', () => {
    const views = toEmergencyContacts([
      contact({ id: 'a' }),
      contact({ id: 'b', kind: 'SERVICE' }),
      contact({ id: 'c', is_active: false }),
    ])
    expect(views.map((view) => view.id)).toEqual(['a'])
    expect(views[0].callHref).toBe('tel:3201234567')
    expect(views[0].detail).toBe('Cuadrante de policia')
    expect(views[0].phoneLabel).toBe('320 123 4567')
  })
})

const place = (overrides: Partial<NearbyPlace>): NearbyPlace => ({
  id: 'node/1',
  name: 'Lugar',
  category: 'police',
  lat: 4.6,
  lon: -75.6,
  distance: 500,
  address: null,
  phone: null,
  website: null,
  ...overrides,
})

describe('nearestEmergencyPlaces', () => {
  it('ordena policia, hospital y bomberos y limita por tipo', () => {
    const result = nearestEmergencyPlaces(
      [
        place({ id: 'h1', category: 'hospital', distance: 300 }),
        place({ id: 'p2', category: 'police', distance: 900 }),
        place({ id: 'p1', category: 'police', distance: 200, phone: '6067451234' }),
        place({ id: 'p3', category: 'police', distance: 1500 }),
        place({ id: 'f1', category: 'fire_station', distance: 1200 }),
        place({ id: 'r1', category: 'restaurant', distance: 10 }),
      ],
      2,
    )
    expect(result.map((item) => item.id)).toEqual(['p1', 'p2', 'h1', 'f1'])
    expect(result[0].callHref).toBe('tel:6067451234')
    expect(result[1].callHref).toBeNull()
    expect(result[1].directionsHref).toContain('google.com/maps')
    expect(result[3].detail).toBe('Bomberos · 1.2 km')
  })
})

describe('formatDistance', () => {
  it('metros y kilometros', () => {
    expect(formatDistance(234)).toBe('230 m')
    expect(formatDistance(1530)).toBe('1.5 km')
  })
})

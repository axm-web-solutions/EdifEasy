import { describe, expect, it } from 'vitest'
import type { NearbyPlace } from '@/services/placesService'
import { formatDistance, formatOpeningHours, toPlaceInfo } from './nearby.logic'

const place = (overrides: Partial<NearbyPlace> = {}): NearbyPlace => ({
  id: 'node/1',
  name: 'Plomeria El Tubo',
  category: 'plumber',
  lat: 4.6,
  lon: -75.6,
  distance: 420,
  address: 'Calle 1 # 2-3',
  phone: '310 111 2233',
  website: 'https://eltubo.co',
  whatsapp: null,
  openingHours: 'Mo-Fr 08:00-18:00; Sa 09:00-13:00; Su off',
  ...overrides,
})

describe('formatOpeningHours', () => {
  it('traduce los dias de OpenStreetMap', () => {
    expect(formatOpeningHours('Mo-Fr 08:00-18:00; Sa 09:00-13:00; Su off')).toBe(
      'Lun-Vie 08:00-18:00 · Sab 09:00-13:00 · Dom cerrado',
    )
    expect(formatOpeningHours('24/7')).toBe('Abierto 24 horas')
    expect(formatOpeningHours('')).toBeNull()
  })
})

describe('toPlaceInfo', () => {
  it('arma la ficha con llamada, WhatsApp, ruta y web', () => {
    const info = toPlaceInfo(place())
    expect(info.category).toBe('Plomeros')
    expect(info.distance).toBe('420 m')
    expect(info.phoneLabel).toBe('310 111 2233')
    expect(info.callHref).toBe('tel:3101112233')
    expect(info.whatsappHref).toContain('wa.me/573101112233')
    expect(info.directionsHref).toContain('google.com/maps')
    expect(info.website).toBe('https://eltubo.co')
    expect(info.noContact).toBe(false)
  })
  it('prefiere el WhatsApp propio del lugar', () => {
    expect(toPlaceInfo(place({ whatsapp: '+57 320 999 8877' })).whatsappHref).toContain(
      'wa.me/573209998877',
    )
  })
  it('fijo sin WhatsApp ni web', () => {
    const info = toPlaceInfo(place({ phone: '6067451234', website: null }))
    expect(info.whatsappHref).toBeNull()
    expect(info.callHref).toBe('tel:6067451234')
  })
  it('sin ningun contacto', () => {
    expect(toPlaceInfo(place({ phone: null, website: null })).noContact).toBe(true)
  })
  it('distancias', () => {
    expect(formatDistance(1530)).toBe('1.5 km')
  })
})

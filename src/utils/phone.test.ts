import { describe, expect, it } from 'vitest'
import { directionsHref, formatPhone, telHref, uberPickupHref, whatsappHref } from './phone'

describe('telHref', () => {
  it('limpia espacios y simbolos', () => {
    expect(telHref('310 434 4995')).toBe('tel:3104344995')
    expect(telHref('+57 (606) 745-1234')).toBe('tel:+576067451234')
  })
  it('codifica las lineas con #', () => {
    expect(telHref('#767')).toBe('tel:%23767')
  })
  it('null sin numero', () => {
    expect(telHref('')).toBeNull()
    expect(telHref(null)).toBeNull()
    expect(telHref('sin numero')).toBeNull()
  })
})

describe('whatsappHref', () => {
  it('agrega el indicativo a celulares colombianos', () => {
    expect(whatsappHref('310 434 4995')).toBe('https://wa.me/573104344995')
    expect(whatsappHref('+57 310 434 4995')).toBe('https://wa.me/573104344995')
  })
  it('incluye el mensaje', () => {
    expect(whatsappHref('3104344995', 'Hola, vi tu servicio')).toBe(
      'https://wa.me/573104344995?text=Hola%2C%20vi%20tu%20servicio',
    )
  })
  it('fijos y lineas cortas no tienen WhatsApp', () => {
    expect(whatsappHref('6067451234')).toBeNull()
    expect(whatsappHref('123')).toBeNull()
  })
})

describe('formatPhone', () => {
  it('agrupa numeros de 10 digitos', () => {
    expect(formatPhone('3104344995')).toBe('310 434 4995')
    expect(formatPhone('+573104344995')).toBe('+57 310 434 4995')
  })
  it('deja igual lo que no reconoce', () => {
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone(null)).toBe('')
  })
})

describe('enlaces de mapas', () => {
  it('Uber con punto de recogida', () => {
    const href = uberPickupHref({ lat: 4.634531, lon: -75.615561 }, 'Conjunto')
    expect(href).toContain('https://m.uber.com/ul/?action=setPickup')
    expect(href).toContain('pickup%5Blatitude%5D=4.634531')
    expect(href).toContain('pickup%5Bnickname%5D=Conjunto')
  })
  it('como llegar', () => {
    expect(directionsHref({ lat: 4.6, lon: -75.6 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=4.6,-75.6',
    )
  })
})

import { describe, expect, it } from 'vitest'
import { amenityLabel, localized, resolveStoreLang, STORE_TEXT } from './storefront.i18n'
import {
  inquiryText,
  markerPrice,
  operationLabel,
  priceLines,
  specItems,
  storeCategories,
  typeLabel,
} from './agency.logic'

const property = {
  operation: 'RENT' as const,
  rent_price: 2500000,
  admin_fee: 350000,
  sale_price: null,
  bedrooms: 1,
  bathrooms: 2,
  area_m2: 72,
  parking: 1,
  stratum: 4,
  neighborhood: 'Cedritos',
  city: 'Bogota',
  images: [],
}

describe('idioma de la tienda', () => {
  it('prefiere la URL, luego lo guardado y luego el navegador', () => {
    expect(resolveStoreLang('en', 'es', 'es-CO')).toBe('en')
    expect(resolveStoreLang(null, 'en', 'es-CO')).toBe('en')
    expect(resolveStoreLang('fr', null, 'en-US')).toBe('en')
    expect(resolveStoreLang(null, null, 'pt-BR')).toBe('es')
    expect(resolveStoreLang(undefined, undefined, undefined)).toBe('es')
  })

  it('usa el texto en ingles solo si existe', () => {
    expect(localized('en', 'Casa', 'House')).toBe('House')
    expect(localized('en', 'Casa', '  ')).toBe('Casa')
    expect(localized('es', 'Casa', 'House')).toBe('Casa')
    expect(localized('en', null, null)).toBeNull()
  })

  it('traduce amenidades conocidas y deja las demas igual', () => {
    expect(amenityLabel('Porteria 24 h', 'en')).toBe('24/7 doorman')
    expect(amenityLabel('Balcón', 'en')).toBe('Balcony')
    expect(amenityLabel('Altura 8 m', 'en')).toBe('8 m ceiling height')
    expect(amenityLabel('Vista al Monserrate', 'en')).toBe('Vista al Monserrate')
    expect(amenityLabel('Balcon', 'es')).toBe('Balcon')
  })

  it('las dos versiones tienen las mismas claves', () => {
    expect(Object.keys(STORE_TEXT.en).sort()).toEqual(Object.keys(STORE_TEXT.es).sort())
  })
})

describe('etiquetas en ingles', () => {
  it('precio con COP y por mes', () => {
    expect(priceLines(property, 'en')).toEqual({
      main: 'COP 2,500,000 / month',
      extra: 'HOA fee COP 350,000',
    })
    expect(priceLines({ ...property, rent_price: null }, 'en').main).toBe('Rent upon request')
  })

  it('caracteristicas con su tipo', () => {
    expect(specItems(property, 'en')).toEqual([
      { kind: 'bedrooms', label: '1 bed' },
      { kind: 'bathrooms', label: '2 baths' },
      { kind: 'area', label: '72 m2' },
      { kind: 'parking', label: '1 parking' },
      { kind: 'stratum', label: 'Stratum 4' },
    ])
    expect(specItems(property).map((item) => item.label)).toContain('1 hab.')
  })

  it('tipos, operaciones, categorias y marcadores', () => {
    expect(typeLabel('APARTAESTUDIO', 'en')).toBe('Studio apartment')
    expect(operationLabel('BOTH', 'en')).toBe('For rent or sale')
    expect(storeCategories('en')[0]).toEqual({ value: 'ALL', label: 'All' })
    expect(markerPrice({ operation: 'RENT', rent_price: 2500000, sale_price: null }, 'en')).toBe(
      '$2.5 M',
    )
    expect(markerPrice({ operation: 'RENT', rent_price: 950000, sale_price: null }, 'en')).toBe(
      '$950K',
    )
    expect(markerPrice({ operation: 'RENT', rent_price: 950000, sale_price: null })).toBe(
      '$950 mil',
    )
  })

  it('mensaje de WhatsApp en ingles', () => {
    expect(inquiryText('House', 'C-1', 'https://x/p/1', 'en')).toBe(
      'Hi, I\'m interested in the property "House" (ref. C-1): https://x/p/1',
    )
  })
})

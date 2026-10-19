import { describe, expect, it } from 'vitest'
import terminos from '../../../docs/legal/terminos.md?raw'
import privacidad from '../../../docs/legal/privacidad.md?raw'
import marketplace from '../../../docs/legal/reglas-marketplace.md?raw'
import {
  LEGAL_VERSION,
  hasAccepted,
  isLegalSlug,
  missingEntityFields,
  pendingDocuments,
  renderLegal,
  vatNote,
  type LegalEntity,
} from './legal.logic'

const ENTITY: LegalEntity = {
  name: 'EdiFeasy S.A.S.',
  nit: '901234567-8',
  address: 'Calle 10 # 20-30',
  city: 'Armenia',
  email: 'datos@edifeasy.com',
  phone: '6060000000',
  dataOfficer: 'Oficial de datos',
  serverLocation: 'Estados Unidos',
  vatResponsible: true,
}

describe('renderLegal', () => {
  it('reemplaza todos los datos en los tres documentos', () => {
    for (const source of [terminos, privacidad, marketplace]) {
      const text = renderLegal(source, ENTITY)
      expect(text).not.toMatch(/\{\{[A-Z_]+\}\}/)
      expect(text).not.toContain('[pendiente')
      expect(text).toContain(LEGAL_VERSION)
    }
    expect(renderLegal(terminos, ENTITY)).toContain('EdiFeasy S.A.S.')
    expect(renderLegal(terminos, ENTITY)).toContain('Los valores incluyen IVA.')
  })

  it('marca lo que falta', () => {
    const text = renderLegal(privacidad, { name: 'X' })
    expect(text).toContain('[pendiente: NIT]')
    expect(text).toContain('[pendiente: correo]')
  })

  it('los textos citan la base legal', () => {
    expect(privacidad).toContain('Ley 1581 de 2012')
    expect(privacidad).toContain('Decreto 1377 de 2013')
    expect(privacidad).toMatch(/diez \(10\) dias habiles/)
    expect(privacidad).toMatch(/quince \(15\) dias habiles/)
    expect(marketplace).toContain('articulo 53 de la Ley 1480 de 2011')
    expect(terminos).toContain('Ley 527 de 1999')
  })
})

describe('datos del operador', () => {
  it('detecta campos faltantes', () => {
    expect(missingEntityFields(ENTITY)).toEqual([])
    expect(missingEntityFields({ ...ENTITY, nit: ' ' })).toEqual(['NIT'])
    expect(missingEntityFields({ ...ENTITY, vatResponsible: null })).toEqual(['Regimen de IVA'])
    expect(missingEntityFields(null)).toHaveLength(9)
  })
  it('nota de IVA', () => {
    expect(vatNote(ENTITY)).toBe('Los valores incluyen IVA.')
    expect(vatNote({ ...ENTITY, vatResponsible: false })).toBe(
      'EdiFeasy S.A.S. no es responsable de IVA.',
    )
    expect(vatNote(null)).toBe('')
  })
})

describe('aceptaciones', () => {
  it('pide los documentos de la version vigente que falten', () => {
    expect(pendingDocuments([])).toEqual(['TERMS', 'PRIVACY'])
    expect(pendingDocuments([{ document: 'TERMS', version: LEGAL_VERSION }])).toEqual(['PRIVACY'])
    expect(
      pendingDocuments([
        { document: 'TERMS', version: '2020-01-01' },
        { document: 'PRIVACY', version: LEGAL_VERSION },
      ]),
    ).toEqual(['TERMS'])
  })
  it('reglas del marketplace: cualquier version', () => {
    expect(hasAccepted([{ document: 'MARKETPLACE_RULES' }], 'MARKETPLACE_RULES')).toBe(true)
    expect(hasAccepted([{ document: 'TERMS' }], 'MARKETPLACE_RULES')).toBe(false)
  })
  it('slugs', () => {
    expect(isLegalSlug('privacidad')).toBe(true)
    expect(isLegalSlug('otro')).toBe(false)
  })
})

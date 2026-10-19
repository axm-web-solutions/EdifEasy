import { describe, expect, it } from 'vitest'
import { toCsv } from '@/utils/export'
import {
  CREDENTIAL_COLUMNS,
  EXISTING_ACCOUNT_NOTE,
  emailSlug,
  parseRut,
  planUnits,
  titleCase,
  unitCount,
  unitEmail,
  type RutTextItem,
} from './rut.logic'

/**
 * Posiciones tomadas de un RUT real (formulario 001 de la DIAN) con datos
 * ficticios. Incluye las trampas del formato: digitos de codigos DANE junto a
 * la ciudad, el nombre del funcionario de la DIAN (casilla 984) y bloques de
 * representantes vacios.
 */
const item = (
  page: number,
  x: number,
  y: number,
  text: string,
  width = text.length * 4,
): RutTextItem => ({
  page,
  x,
  y,
  width,
  text,
})

const digits = (page: number, xs: number[], y: number, value: string) =>
  value.split('').map((char, index) => item(page, xs[index], y, char, 4))

const NIT_XS = [86, 98, 109, 121, 132, 144, 156, 167, 179]

const RUT: RutTextItem[] = [
  // Hoja 1
  item(1, 28, 616, '5. Número de Identificación Tributaria (NIT)', 150),
  item(1, 185, 616, '6. DV', 15),
  item(1, 206, 616, '12. Dirección seccional', 80),
  ...digits(1, NIT_XS, 604, '901234567'),
  item(1, 193, 604, '8'),
  item(1, 28, 581, '24. Tipo de contribuyente', 80),
  item(1, 187, 581, '25. Tipo de documento', 70),
  item(1, 27, 569, 'Persona jurídica', 60),
  item(1, 173, 570, '1'),
  item(1, 28, 508, '35. Razón social', 60),
  item(1, 27, 497, 'CONJUNTO RESIDENCIAL LOS PINOS DE LA SIERRA P.H.', 200),
  item(1, 28, 448, '38. País', 30),
  item(1, 201, 447, '39. Departamento', 60),
  item(1, 393, 448, '40. Ciudad/Municipio', 70),
  item(1, 27, 437, 'COLOMBIA', 40),
  ...digits(1, [168, 179, 189], 438, '169'),
  item(1, 201, 437, 'Antioquia', 40),
  ...digits(1, [371, 381], 438, '05'),
  item(1, 393, 437, 'Medellín', 35),
  ...digits(1, [564, 575, 586], 438, '001'),
  item(1, 28, 424, '41. Dirección principal', 80),
  item(1, 27, 412, 'CL 10', 20),
  item(1, 52, 412, '# 43 - 21', 40),
  item(1, 28, 400, '42. Correo electrónico', 75),
  item(1, 106, 401, 'Admin.LosPinos@Example.com', 110),
  item(1, 28, 388, '43. Código postal', 60),
  item(1, 202, 388, '44. Teléfono 1', 50),
  item(1, 309, 388, '3 0 0 1 2 3 4 5 6 7', 60),
  item(1, 399, 388, '45. Teléfono 2', 50),
  item(1, 307, 52, '984. Nombre', 40),
  item(1, 349, 53, 'FUNCIONARIO DE LA DIAN', 100),
  // Hoja 3: representacion
  item(3, 39, 580, '98. Representación', 60),
  item(3, 216, 580, '99. Fecha inicio ejercicio representación', 140),
  item(3, 41, 569, 'REPRS LEGAL PRIN', 70),
  item(3, 39, 556, '100. Tipo de documento', 80),
  item(3, 138, 556, '101. Número de identificación', 100),
  ...digits(3, [114, 124, 140, 154], 544, '7777'),
  item(3, 39, 532, '104. Primer apellido', 70),
  item(3, 172, 532, '105. Segundo apellido', 70),
  item(3, 313, 532, '106. Primer nombre', 65),
  item(3, 456, 532, '107. Otros nombres', 65),
  item(3, 38, 520, 'PEREZ', 25),
  item(3, 171, 520, 'GOMEZ', 25),
  item(3, 312, 520, 'ANA', 15),
  item(3, 455, 520, 'MARIA', 25),
  // Segundo bloque de representante, vacio
  item(3, 39, 436, '104. Primer apellido', 70),
  item(3, 172, 436, '105. Segundo apellido', 70),
]

describe('parseRut', () => {
  const result = parseRut(RUT)

  it('lee los datos del conjunto', () => {
    expect(result.unreadable).toBe(false)
    expect(result.missing).toEqual([])
    expect(result.data).toMatchObject({
      nit: '901234567-8',
      businessName: 'Conjunto Residencial Los Pinos de la Sierra P.H.',
      taxpayerType: 'Persona jurídica',
      department: 'Antioquia',
      city: 'Medellín',
      address: 'CL 10 # 43 - 21',
      email: 'admin.lospinos@example.com',
      phone: '3001234567',
    })
  })

  it('el representante legal es el de la hoja de representacion, no el funcionario de la DIAN', () => {
    expect(result.data.legalRepresentative).toBe('Ana Maria Perez Gomez')
  })

  it('no guarda el documento del representante', () => {
    expect(JSON.stringify(result.data)).not.toContain('7777')
  })

  it('un PDF escaneado (sin texto) es ilegible', () => {
    const scanned = parseRut([])
    expect(scanned.unreadable).toBe(true)
    expect(scanned.missing).toContain('nit')
  })

  it('reporta los campos que faltan', () => {
    const partial = parseRut(RUT.filter((entry) => !entry.text.includes('@')))
    expect(partial.missing).toEqual(['email'])
  })
})

describe('titleCase', () => {
  it('respeta conectores, P.H. y numeros romanos', () => {
    expect(titleCase('EDIFICIO TORRES DEL PARQUE II P.H.')).toBe(
      'Edificio Torres del Parque II P.H.',
    )
  })
})

describe('emailSlug', () => {
  it('quita palabras genericas al inicio y P.H. al final', () => {
    expect(emailSlug('Condominio Campestre Angeles del Bosque')).toBe('angelesdelbosque')
    expect(emailSlug('Conjunto Residencial Los Pinos de la Sierra P.H.')).toBe('lospinosdelasierra')
    expect(emailSlug('Edificio Núñez')).toBe('nunez')
  })
  it('si solo hay palabras genericas conserva la ultima', () => {
    expect(emailSlug('Conjunto Residencial')).toBe('residencial')
  })
})

describe('plan de unidades', () => {
  it('casas con ceros a la izquierda', () => {
    const units = planUnits({ kind: 'HOUSES', houses: 35 }, 'angelesdelbosque')
    expect(units).toHaveLength(35)
    expect(units[6]).toEqual({ label: 'Casa 07', email: '07.angelesdelbosque@ventofast.com' })
  })

  it('torres: piso + consecutivo, con la torre en el correo', () => {
    const layout = { kind: 'TOWERS' as const, towers: 2, floors: 3, unitsPerFloor: 4 }
    const units = planUnits(layout, 'pinos')
    expect(unitCount(layout)).toBe(24)
    expect(units).toHaveLength(24)
    expect(units[0]).toEqual({ label: 'Torre 1 · Apto 101', email: 't1-101.pinos@ventofast.com' })
    expect(units[23]).toEqual({ label: 'Torre 2 · Apto 304', email: 't2-304.pinos@ventofast.com' })
  })

  it('unitEmail', () => {
    expect(unitEmail('x', '12')).toBe('12.x@ventofast.com')
    expect(unitEmail('x', '1002', 3)).toBe('t3-1002.x@ventofast.com')
  })
})

describe('CREDENTIAL_COLUMNS', () => {
  it('clave temporal o aviso de cuenta existente', () => {
    const csv = toCsv(
      [
        {
          unit: 'Casa 01',
          role: 'Propietario',
          email: '01.pinos@ventofast.com',
          password: 'Abc123xyz',
        },
        { unit: 'Administracion', role: 'Administrador', email: 'a@b.co', password: null },
      ],
      CREDENTIAL_COLUMNS,
    )
    expect(csv).toContain('Unidad;Rol;Correo;Clave temporal')
    expect(csv).toContain('Casa 01;Propietario;01.pinos@ventofast.com;Abc123xyz')
    expect(csv).toContain(`Administracion;Administrador;a@b.co;${EXISTING_ACCOUNT_NOTE}`)
  })
})

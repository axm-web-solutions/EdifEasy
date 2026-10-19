/**
 * Lectura del RUT de la DIAN y plan de unidades para el alta de un conjunto.
 * Funciones puras (sin React ni pdf.js): reciben el texto del PDF con su
 * posicion en la pagina, tal como lo entrega `rutService.extractText`.
 *
 * El formulario del RUT numera cada casilla ("35. Razon social"). El valor de
 * una casilla esta debajo de su etiqueta (o a la derecha, en correo y
 * telefono) y termina donde empieza la siguiente etiqueta de la misma fila.
 *
 * Por privacidad NO se extrae el numero de documento del representante legal.
 */
import type { ExportColumn } from '@/utils/export'

export interface RutTextItem {
  page: number
  x: number
  /** Coordenada PDF: crece hacia arriba. */
  y: number
  width: number
  text: string
}

export interface RutData {
  nit: string
  businessName: string
  taxpayerType: string
  department: string
  city: string
  address: string
  email: string
  phone: string
  legalRepresentative: string
}

export interface RutParseResult {
  data: RutData
  /** Campos que no se encontraron (hay que llenarlos a mano). */
  missing: (keyof RutData)[]
  /** true si el PDF no tiene texto (escaneado) o no parece un RUT. */
  unreadable: boolean
}

const LABEL = /^(\d{1,3})\.\s/
const SAME_ROW = 3
const PAGE_WIDTH = 612

function labelCode(item: RutTextItem): number | null {
  const match = LABEL.exec(item.text.trim())
  return match ? Number(match[1]) : null
}

/** Etiqueta de la casilla `code`; si se repite en la pagina, la de mas arriba. */
function findLabel(items: RutTextItem[], code: number, page?: number): RutTextItem | undefined {
  return items
    .filter((item) => (page === undefined || item.page === page) && labelCode(item) === code)
    .sort((a, b) => a.page - b.page || b.y - a.y)[0]
}

/** Donde empieza la siguiente etiqueta a la derecha, en la misma fila. */
function rightBoundary(items: RutTextItem[], label: RutTextItem): number {
  const next = items
    .filter(
      (item) =>
        item.page === label.page &&
        Math.abs(item.y - label.y) <= SAME_ROW &&
        item.x > label.x + 5 &&
        labelCode(item) !== null,
    )
    .sort((a, b) => a.x - b.x)[0]
  return next ? next.x : PAGE_WIDTH
}

/**
 * Une los fragmentos de un valor. Las casillas de digitos vienen de a un
 * caracter ("9","0","0"): se pegan. En textos se descartan los digitos
 * sueltos, que son codigos DANE junto al nombre (p. ej. "Circasia 1 9 0").
 */
function joinValue(parts: RutTextItem[]): string {
  const texts = parts
    .sort((a, b) => a.x - b.x)
    .map((part) => part.text.trim())
    .filter(Boolean)
  if (texts.length === 0) return ''
  if (texts.every((text) => text.length === 1)) return texts.join('')
  return texts
    .filter((text) => !/^\d$/.test(text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function valueBelow(items: RutTextItem[], label: RutTextItem): string {
  const right = rightBoundary(items, label)
  return joinValue(
    items.filter(
      (item) =>
        item.page === label.page &&
        item.y < label.y - 3 &&
        item.y >= label.y - 16 &&
        item.x >= label.x - 4 &&
        item.x < right - 2 &&
        labelCode(item) === null,
    ),
  )
}

function valueRight(items: RutTextItem[], label: RutTextItem): string {
  const right = rightBoundary(items, label)
  return joinValue(
    items.filter(
      (item) =>
        item.page === label.page &&
        Math.abs(item.y - label.y) <= SAME_ROW &&
        item.x >= label.x + label.width - 1 &&
        item.x < right - 2 &&
        labelCode(item) === null,
    ),
  )
}

function field(items: RutTextItem[], code: number, mode: 'below' | 'right', page?: number): string {
  const label = findLabel(items, code, page)
  if (!label) return ''
  const first = mode === 'below' ? valueBelow(items, label) : valueRight(items, label)
  if (first) return first
  return mode === 'below' ? valueRight(items, label) : valueBelow(items, label)
}

const CONNECTORS = new Set(['de', 'del', 'y', 'e', 'en', 'a'])
const ARTICLES = new Set(['el', 'la', 'los', 'las'])

/**
 * "CONDOMINIO CAMPESTRE ANGELES DEL BOSQUE P.H." -> "Condominio Campestre Angeles del Bosque P.H."
 * Los articulos van en minuscula solo tras una preposicion ("de la Sierra"),
 * no al inicio de un nombre propio ("Los Pinos").
 */
export function titleCase(text: string): string {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  return words
    .map((word, index) => {
      if (/^(p\.?h\.?|nit)$/.test(word) || /^[ivx]{1,4}$/.test(word)) return word.toUpperCase()
      if (index > 0 && CONNECTORS.has(word)) return word
      if (index > 0 && ARTICLES.has(word) && CONNECTORS.has(words[index - 1])) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function formatNit(digits: string, dv: string): string {
  return dv ? `${digits}-${dv}` : digits
}

export function parseRut(items: RutTextItem[]): RutParseResult {
  const isRut = items.some((item) => /Identificaci[oó]n Tributaria/i.test(item.text))
  const nitDigits = field(items, 5, 'below').replace(/\D/g, '')
  const dv = field(items, 6, 'below').replace(/\D/g, '').slice(0, 1)

  // El representante legal esta en la hoja que tiene la casilla 98 (Representacion).
  const representationPage = findLabel(items, 98)?.page
  const representative =
    representationPage === undefined
      ? ''
      : [106, 107, 104, 105]
          .map((code) => field(items, code, 'below', representationPage))
          .filter(Boolean)
          .join(' ')

  const email = field(items, 42, 'right').replace(/\s+/g, '').toLowerCase()
  const phoneDigits = field(items, 44, 'right').replace(/\D/g, '')

  const data: RutData = {
    nit: nitDigits ? formatNit(nitDigits, dv) : '',
    businessName: titleCase(field(items, 35, 'below')),
    taxpayerType: field(items, 24, 'below'),
    department: field(items, 39, 'below'),
    city: field(items, 40, 'below'),
    address: field(items, 41, 'below'),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    phone: phoneDigits.length >= 7 ? phoneDigits : '',
    legalRepresentative: titleCase(representative),
  }

  const required: (keyof RutData)[] = [
    'nit',
    'businessName',
    'city',
    'address',
    'email',
    'legalRepresentative',
  ]
  const missing = required.filter((key) => !data[key])

  return { data, missing, unreadable: !isRut || (!data.nit && !data.businessName) }
}

// ---------------------------------------------------------------------------
// Correos de las unidades
// ---------------------------------------------------------------------------

/**
 * Dominio de las cuentas de residentes creadas en el alta. Debe coincidir con
 * `RESIDENT_EMAIL_DOMAIN` de la Edge Function `provision-condominium`.
 */
export const RESIDENT_EMAIL_DOMAIN = 'ventofast.com'

const GENERIC_PREFIX = new Set([
  'conjunto',
  'residencial',
  'condominio',
  'campestre',
  'edificio',
  'unidad',
  'agrupacion',
  'urbanizacion',
  'parcelacion',
  'centro',
])
const GENERIC_SUFFIX = new Set(['ph', 'p.h.', 'p.h', 'propiedad', 'horizontal'])

/**
 * Identificador del conjunto en los correos: el nombre sin tildes, sin
 * palabras genericas al inicio ("Conjunto Residencial") ni "P.H." al final.
 * "Condominio Campestre Angeles del Bosque" -> "angelesdelbosque".
 */
export function emailSlug(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
  let start = 0
  while (start < words.length - 1 && GENERIC_PREFIX.has(words[start])) start++
  let end = words.length
  while (end > start + 1 && GENERIC_SUFFIX.has(words[end - 1])) end--
  return words
    .slice(start, end)
    .join('')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30)
}

export const EMAIL_SLUG_PATTERN = /^[a-z0-9]{3,30}$/

export type UnitLayout =
  | { kind: 'HOUSES'; houses: number }
  | { kind: 'TOWERS'; towers: number; floors: number; unitsPerFloor: number }

export interface PlannedUnit {
  label: string
  email: string
}

/**
 * Misma regla que la Edge Function: casa "07" -> 07.<slug>@ventofast.com;
 * torre 2, apto 301 -> t2-301.<slug>@ventofast.com.
 */
export function unitEmail(slug: string, number: string, tower?: number): string {
  const local = tower ? `t${tower}-${number}` : number
  return `${local}.${slug}@${RESIDENT_EMAIL_DOMAIN}`
}

export function unitCount(layout: UnitLayout): number {
  return layout.kind === 'HOUSES'
    ? layout.houses
    : layout.towers * layout.floors * layout.unitsPerFloor
}

/** Unidades que se crearan (numeracion igual a `provision_condominium`). */
export function planUnits(layout: UnitLayout, slug: string): PlannedUnit[] {
  if (layout.kind === 'HOUSES') {
    const width = Math.max(2, String(layout.houses).length)
    return Array.from({ length: layout.houses }, (_, index) => {
      const number = String(index + 1).padStart(width, '0')
      return { label: `Casa ${number}`, email: unitEmail(slug, number) }
    })
  }
  const units: PlannedUnit[] = []
  for (let tower = 1; tower <= layout.towers; tower++)
    for (let floor = 1; floor <= layout.floors; floor++)
      for (let unit = 1; unit <= layout.unitsPerFloor; unit++) {
        const number = `${floor}${String(unit).padStart(2, '0')}`
        units.push({
          label: `Torre ${tower} · Apto ${number}`,
          email: unitEmail(slug, number, tower),
        })
      }
  return units
}

// ---------------------------------------------------------------------------
// Credenciales
// ---------------------------------------------------------------------------

export interface ProvisionedAccount {
  unit: string
  role: string
  email: string
  /** null si la cuenta ya existia (no se cambio su clave). */
  password: string | null
}

export const EXISTING_ACCOUNT_NOTE = '(cuenta existente: usa su clave actual)'

/** Columnas del archivo de credenciales (lo genera `EXPORTERS.csv`). */
export const CREDENTIAL_COLUMNS: ExportColumn<ProvisionedAccount>[] = [
  { key: 'unit', header: 'Unidad', value: (account) => account.unit },
  { key: 'role', header: 'Rol', value: (account) => account.role },
  { key: 'email', header: 'Correo', value: (account) => account.email },
  {
    key: 'password',
    header: 'Clave temporal',
    value: (account) => account.password ?? EXISTING_ACCOUNT_NOTE,
  },
]

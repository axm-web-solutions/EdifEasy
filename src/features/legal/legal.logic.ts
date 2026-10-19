/**
 * Documentos legales (sin React): version vigente, datos del operador que se
 * insertan en los textos y que documentos le faltan aceptar a un usuario.
 *
 * Al cambiar un texto de docs/legal/*.md de forma sustancial, sube
 * LEGAL_VERSION: todos los usuarios deberan aceptarlo de nuevo al ingresar.
 */
export const LEGAL_VERSION = '2026-10-19'

export type LegalDocumentKey = 'TERMS' | 'PRIVACY' | 'MARKETPLACE_RULES'
export type LegalSlug = 'terminos' | 'privacidad' | 'marketplace'

export const LEGAL_DOCUMENT_META: Record<
  LegalSlug,
  { key: LegalDocumentKey; title: string; short: string }
> = {
  terminos: { key: 'TERMS', title: 'Terminos y condiciones', short: 'Terminos' },
  privacidad: {
    key: 'PRIVACY',
    title: 'Politica de tratamiento de datos',
    short: 'Datos personales',
  },
  marketplace: { key: 'MARKETPLACE_RULES', title: 'Reglas del marketplace', short: 'Marketplace' },
}

export function isLegalSlug(value: string | undefined): value is LegalSlug {
  return value === 'terminos' || value === 'privacidad' || value === 'marketplace'
}

/** Datos del operador (platform_settings.legal_entity). */
export interface LegalEntity {
  name?: string
  nit?: string
  address?: string
  city?: string
  email?: string
  phone?: string
  dataOfficer?: string
  serverLocation?: string
  /** true: responsable de IVA (precios con IVA incluido); false: no responsable. */
  vatResponsible?: boolean | null
}

export const LEGAL_ENTITY_FIELDS: { key: keyof LegalEntity; label: string; placeholder: string }[] =
  [
    { key: 'name', label: 'Razon social', placeholder: 'EdiFeasy S.A.S.' },
    { key: 'nit', label: 'NIT', placeholder: '901234567-8' },
    { key: 'address', label: 'Direccion', placeholder: 'Calle 10 # 20-30' },
    { key: 'city', label: 'Ciudad', placeholder: 'Armenia' },
    {
      key: 'email',
      label: 'Correo para datos personales y PQR',
      placeholder: 'datos@edifeasy.com',
    },
    { key: 'phone', label: 'Telefono', placeholder: '606 000 0000' },
    {
      key: 'dataOfficer',
      label: 'Responsable de proteccion de datos',
      placeholder: 'Nombre o cargo',
    },
    {
      key: 'serverLocation',
      label: 'Ubicacion de los servidores',
      placeholder: 'Estados Unidos (Supabase, region us-east-1)',
    },
  ]

/** Campos sin llenar: con alguno pendiente la plataforma no esta lista para produccion. */
export function missingEntityFields(entity: LegalEntity | null | undefined): string[] {
  const missing = LEGAL_ENTITY_FIELDS.filter(({ key }) => !String(entity?.[key] ?? '').trim()).map(
    ({ label }) => label,
  )
  if (entity?.vatResponsible === undefined || entity.vatResponsible === null)
    missing.push('Regimen de IVA')
  return missing
}

export function vatNote(entity: LegalEntity | null | undefined): string {
  if (entity?.vatResponsible === true) return 'Los valores incluyen IVA.'
  if (entity?.vatResponsible === false)
    return `${entity.name || 'El Operador'} no es responsable de IVA.`
  return ''
}

/** Inserta los datos del operador en un texto legal. Lo que falte queda marcado. */
export function renderLegal(
  source: string,
  entity: LegalEntity | null | undefined,
  version = LEGAL_VERSION,
): string {
  const value = (text: string | undefined, label: string) => text?.trim() || `[pendiente: ${label}]`
  const values: Record<string, string> = {
    RAZON_SOCIAL: value(entity?.name, 'razon social'),
    NIT: value(entity?.nit, 'NIT'),
    DIRECCION: value(entity?.address, 'direccion'),
    CIUDAD: value(entity?.city, 'ciudad'),
    CORREO_DATOS: value(entity?.email, 'correo'),
    TELEFONO: value(entity?.phone, 'telefono'),
    OFICIAL_DATOS: value(entity?.dataOfficer, 'responsable de datos'),
    UBICACION_SERVIDORES: value(entity?.serverLocation, 'ubicacion de servidores'),
    NOTA_IVA: vatNote(entity),
    VERSION: version,
  }
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => values[key] ?? match)
}

/** Documentos de la version vigente que el usuario aun no acepta. */
export function pendingDocuments(
  acceptances: { document: string; version: string }[],
  required: LegalDocumentKey[] = ['TERMS', 'PRIVACY'],
  version = LEGAL_VERSION,
): LegalDocumentKey[] {
  return required.filter(
    (document) =>
      !acceptances.some((item) => item.document === document && item.version === version),
  )
}

export function hasAccepted(
  acceptances: { document: string }[],
  document: LegalDocumentKey,
): boolean {
  return acceptances.some((item) => item.document === document)
}

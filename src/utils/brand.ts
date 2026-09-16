import type { Json } from '@/types/database'

/** Color por defecto cuando el condominio aun no define su marca. */
export const DEFAULT_BRAND_COLOR = '#2559eb'

/** Variable CSS donde vive el color principal de la marca. */
export const BRAND_CSS_VAR = '--edifeasy-brand'

/** Normaliza el color guardado en BD; cae al azul EdiFeasy si no es un hex. */
export function resolvePrimaryColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value
  return DEFAULT_BRAND_COLOR
}

/** Lee una clave de la columna `settings` (jsonb) sin pisar tipos de Supabase. */
export function readSetting(settings: Json | undefined, key: string): unknown {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return undefined
  return (settings as Record<string, unknown>)[key]
}

/** Devuelve `settings` con `key` actualizada, preservando las claves previas. */
export function mergeSetting(settings: Json | undefined | null, key: string, value: string): Json {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    return { ...settings, [key]: value }
  }
  return { [key]: value }
}
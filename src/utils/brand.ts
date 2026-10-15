import type { Json } from '@/types/database'
import { contrastRatio, mix } from './color'

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

export const BRAND_TONES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type BrandTone = (typeof BRAND_TONES)[number]

/** Texto oscuro de la interfaz (slate-900) y fondo del menu lateral. */
const INK = '#0f172a'
const WHITE = '#ffffff'
/** Contraste minimo WCAG AA para texto normal. */
const AA_TEXT = 4.5
/** Contraste minimo WCAG para elementos graficos y estado seleccionado. */
const AA_UI = 3

/** Color de texto (blanco u oscuro) que mejor se lee sobre `background`. */
export function readableOn(background: string): string {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK
}

export interface BrandTheme {
  /** Color elegido por el conjunto. */
  base: string
  /** Escala 50-900 derivada del color base (500 = base). */
  tones: Record<BrandTone, string>
  /** Texto sobre el color base (botones primarios, burbujas, avatares). */
  on: string
  /** Version del color apta para texto/enlaces sobre fondo blanco (>= 4.5:1). */
  text: string
  /** Fondo del item seleccionado en el menu lateral oscuro y su texto. */
  menuBg: string
  menuOn: string
  /** true si el color base no alcanza AA con texto blanco (se usa texto oscuro). */
  lowContrast: boolean
}

/**
 * Paleta completa a partir del color de marca del conjunto, con los colores de
 * texto elegidos por contraste: un conjunto puede escoger amarillo o verde
 * claro sin dejar texto blanco ilegible en botones, menu o chat.
 */
export function buildBrandTheme(input: unknown): BrandTheme {
  const base = resolvePrimaryColor(input)
  const tones: Record<BrandTone, string> = {
    50: mix(base, WHITE, 0.92),
    100: mix(base, WHITE, 0.84),
    200: mix(base, WHITE, 0.68),
    300: mix(base, WHITE, 0.5),
    400: mix(base, WHITE, 0.25),
    500: base,
    600: mix(base, '#000000', 0.12),
    700: mix(base, '#000000', 0.28),
    800: mix(base, '#000000', 0.42),
    900: mix(base, '#000000', 0.55),
  }
  const on = readableOn(base)
  const text =
    ([500, 600, 700, 800, 900] as BrandTone[])
      .map((tone) => tones[tone])
      .find((color) => contrastRatio(color, WHITE) >= AA_TEXT) ?? tones[900]
  // Sobre el menu oscuro, un color de marca muy oscuro no se distingue.
  const menuBg = contrastRatio(base, INK) >= AA_UI ? base : tones[300]

  return {
    base,
    tones,
    on,
    text,
    menuBg,
    menuOn: readableOn(menuBg),
    lowContrast: contrastRatio(base, WHITE) < AA_TEXT,
  }
}

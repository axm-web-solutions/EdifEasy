import terminos from '../../../docs/legal/terminos.md?raw'
import privacidad from '../../../docs/legal/privacidad.md?raw'
import marketplace from '../../../docs/legal/reglas-marketplace.md?raw'
import type { LegalSlug } from './legal.logic'

/** Textos legales (fuente unica: docs/legal/*.md). */
export const LEGAL_SOURCES: Record<LegalSlug, string> = { terminos, privacidad, marketplace }

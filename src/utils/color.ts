/**
 * Utilidades de color puras (sin React ni DOM). Base de la paleta de marca por
 * conjunto y de los controles de contraste WCAG.
 */

export type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as Rgb
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Mezcla `color` con `target` en la proporcion `amount` (0 = color, 1 = target). */
export function mix(color: string, target: string, amount: number): string {
  const a = hexToRgb(color)
  const b = hexToRgb(target)
  return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * amount) as Rgb)
}

/** Luminancia relativa segun WCAG 2.x. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Relacion de contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Canales "r g b" para usar en `rgb(var(--x) / alpha)` de Tailwind. */
export function rgbChannels(hex: string): string {
  return hexToRgb(hex).join(' ')
}

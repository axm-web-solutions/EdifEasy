import { describe, expect, it } from 'vitest'
import { buildBrandTheme, readableOn } from './brand'
import { contrastRatio, mix } from './color'

describe('contraste', () => {
  it('calcula la relacion WCAG conocida', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#2559eb', '#ffffff')).toBeCloseTo(5.66, 1)
    expect(contrastRatio('#facc15', '#ffffff')).toBeCloseTo(1.53, 1)
  })

  it('mezcla colores', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('elige el texto mas legible', () => {
    expect(readableOn('#2559eb')).toBe('#ffffff')
    expect(readableOn('#facc15')).toBe('#0f172a')
  })
})

describe('buildBrandTheme', () => {
  it('el azul de EdiFeasy usa texto blanco y es su propio color de texto', () => {
    const theme = buildBrandTheme('#2559eb')
    expect(theme.on).toBe('#ffffff')
    expect(theme.text).toBe('#2559eb')
    expect(theme.lowContrast).toBe(false)
    expect(theme.tones[500]).toBe('#2559eb')
  })

  it.each(['#facc15', '#22c55e', '#38bdf8'])('un color claro (%s) usa texto oscuro y un tono legible para enlaces', (color) => {
    const theme = buildBrandTheme(color)
    expect(theme.lowContrast).toBe(true)
    expect(theme.on).toBe('#0f172a')
    expect(contrastRatio(theme.base, theme.on)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(theme.text, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('un color muy oscuro se aclara en el menu lateral para distinguirse', () => {
    const theme = buildBrandTheme('#0f172a')
    expect(theme.menuBg).toBe(theme.tones[300])
    expect(contrastRatio(theme.menuBg, theme.menuOn)).toBeGreaterThanOrEqual(4.5)
  })

  it('valores invalidos caen al azul por defecto', () => {
    expect(buildBrandTheme('rojo').base).toBe('#2559eb')
    expect(buildBrandTheme(null).base).toBe('#2559eb')
  })

  it('la escala va de claro a oscuro', () => {
    const { tones } = buildBrandTheme('#7c3aed')
    const order = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    for (let i = 1; i < order.length; i += 1) {
      expect(contrastRatio(tones[order[i]], '#ffffff')).toBeGreaterThan(
        contrastRatio(tones[order[i - 1]], '#ffffff'),
      )
    }
  })
})

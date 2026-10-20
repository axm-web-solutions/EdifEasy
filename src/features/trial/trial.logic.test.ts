import { describe, expect, it } from 'vitest'
import { hasTrialSignup, isAllowedWhenExpired, trialBannerText, trialState } from './trial.logic'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString()

describe('prueba gratis', () => {
  it('sin prueba no hay nada que mostrar', () => {
    expect(trialState(null, NOW)).toEqual({ kind: 'none' })
    expect(trialState({ trial_ends_at: null, has_access: true }, NOW)).toEqual({ kind: 'none' })
    expect(trialState({}, NOW)).toEqual({ kind: 'none' })
  })

  it('cuenta los dias que quedan', () => {
    const state = trialState({ trial_ends_at: inDays(6.5), has_access: true }, NOW)
    expect(state).toMatchObject({ kind: 'active', daysLeft: 7, urgent: false })
    expect(trialState({ trial_ends_at: inDays(0.2), has_access: true }, NOW)).toMatchObject({
      daysLeft: 1,
      urgent: true,
    })
  })

  it('vencida cuando el contexto dice que no hay acceso', () => {
    expect(trialState({ trial_ends_at: inDays(-1), has_access: false }, NOW)).toEqual({
      kind: 'expired',
    })
    // Vencida pero con plan pagado: acceso normal, sin aviso.
    expect(trialState({ trial_ends_at: inDays(-1), has_access: true }, NOW)).toEqual({
      kind: 'none',
    })
  })

  it('textos y rutas permitidas', () => {
    expect(trialBannerText(1)).toBe('Tu prueba gratis termina hoy')
    expect(trialBannerText(3)).toBe('Te quedan 3 dias de prueba gratis')
    expect(isAllowedWhenExpired('/plans')).toBe(true)
    expect(isAllowedWhenExpired('/payments/result')).toBe(true)
    expect(isAllowedWhenExpired('/dashboard')).toBe(false)
    expect(isAllowedWhenExpired('/plansx')).toBe(false)
  })

  it('detecta el registro de prueba en los metadatos', () => {
    expect(hasTrialSignup({ trial: { condo_name: 'X' } })).toBe(true)
    expect(hasTrialSignup({ trial: 'si' })).toBe(false)
    expect(hasTrialSignup({})).toBe(false)
    expect(hasTrialSignup(undefined)).toBe(false)
  })
})

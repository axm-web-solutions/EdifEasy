import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { planStatus, tariffDescription } from './plans.logic'

describe('plans.logic', () => {
  const today = dayjs('2026-10-14T18:00:00')

  it('sin plan', () => {
    expect(planStatus(null, today)).toEqual({ state: 'none', daysLeft: 0 })
  })

  it('el dia de vencimiento todavia esta activo', () => {
    expect(planStatus({ ends_at: '2026-10-14' }, today)).toEqual({ state: 'active', daysLeft: 0 })
    expect(planStatus({ ends_at: '2026-11-13' }, today)).toEqual({ state: 'active', daysLeft: 30 })
  })

  it('vencido desde el dia siguiente', () => {
    expect(planStatus({ ends_at: '2026-10-13' }, today).state).toBe('expired')
  })

  it('explica la tarifa segun el tamano', () => {
    expect(tariffDescription(79)).toMatch(/menos de 80/)
    expect(tariffDescription(80)).toMatch(/80 apartamentos o mas/)
  })
})

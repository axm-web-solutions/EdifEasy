import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  defaultDueDate,
  feeStatus,
  formatPeriod,
  isOverdue,
  ownerTotals,
  paymentMethodLabel,
} from './adminFees.logic'

describe('adminFees.logic', () => {
  const today = dayjs('2026-10-14')

  it('una cuota pendiente con fecha pasada esta vencida', () => {
    expect(isOverdue({ status: 'PENDING', due_date: '2026-10-10' }, today)).toBe(true)
    expect(isOverdue({ status: 'PENDING', due_date: '2026-10-14' }, today)).toBe(false)
    expect(isOverdue({ status: 'PAID', due_date: '2026-10-01' }, today)).toBe(false)
  })

  it('muestra "Vencida" por encima de "Pendiente"', () => {
    expect(feeStatus({ status: 'PENDING', due_date: '2000-01-10' })).toEqual({
      label: 'Vencida',
      color: 'red',
    })
    expect(feeStatus({ status: 'PAID', due_date: '2000-01-10' }).label).toBe('Pagada')
  })

  it('formatea el mes y el medio de pago', () => {
    expect(formatPeriod('2026-10-01')).toBe('octubre de 2026')
    expect(paymentMethodLabel('WOMPI')).toBe('En linea (Wompi)')
    expect(paymentMethodLabel(null)).toBe('')
  })

  it('sugiere el dia 10 del mes como fecha limite', () => {
    expect(defaultDueDate(dayjs('2026-11-20')).format('YYYY-MM-DD')).toBe('2026-11-10')
  })

  it('suma lo pendiente y lo pagado en el ano', () => {
    const totals = ownerTotals(
      [
        { status: 'PENDING', amount: 350000, period: '2026-10-01' },
        { status: 'PENDING', amount: 350000, period: '2026-09-01' },
        { status: 'PAID', amount: 340000, period: '2026-08-01' },
        { status: 'PAID', amount: 300000, period: '2025-12-01' },
        { status: 'CANCELLED', amount: 999, period: '2026-07-01' },
      ],
      2026,
    )
    expect(totals).toEqual({ pendingAmount: 700000, pendingCount: 2, paidThisYear: 340000 })
  })
})

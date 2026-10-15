import { describe, expect, it } from 'vitest'
import { emptyFineForm, isPayable, paidHint, toFineForm, toFinePayload } from './fines.logic'
import type { FineRow } from '@/types/database'

const fine: FineRow = {
  id: 'f1',
  condominium_id: 'c1',
  apartment_id: 'a1',
  resident_id: null,
  reason: 'Ruido',
  description: null,
  amount: 180000,
  fine_date: '2026-10-01',
  due_date: null,
  status: 'PENDING',
  evidence: [],
  notes: null,
  paid_at: null,
  payment_method: null,
  payment_id: null,
  created_by: 'admin-1',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

describe('fines.logic', () => {
  it('convierte textos vacios en null al guardar', () => {
    const payload = toFinePayload(
      { ...emptyFineForm(), apartment_id: 'a1', reason: 'Ruido', amount: 5 },
      'c1',
      'u1',
    )
    expect(payload).toMatchObject({
      description: null,
      notes: null,
      resident_id: null,
      due_date: null,
    })
    expect(payload.condominium_id).toBe('c1')
  })

  it('ida y vuelta formulario <-> multa conserva los datos', () => {
    const payload = toFinePayload(toFineForm(fine), 'c1', fine.created_by)
    expect(payload).toMatchObject({
      apartment_id: 'a1',
      reason: 'Ruido',
      amount: 180000,
      created_by: 'admin-1',
    })
  })

  it('solo se pagan multas pendientes con valor', () => {
    expect(isPayable(fine)).toBe(true)
    expect(isPayable({ ...fine, status: 'APPEALED' })).toBe(false)
    expect(isPayable({ ...fine, amount: 0 })).toBe(false)
  })

  it('describe el pago en linea', () => {
    expect(paidHint(fine)).toBeUndefined()
    expect(paidHint({ paid_at: '2026-10-05T15:00:00Z', payment_method: 'WOMPI' })).toMatch(
      /en linea$/,
    )
  })
})

import { describe, expect, it } from 'vitest'
import type { ReservationWithRelations } from '@/services/reservationService'
import {
  areaFlowNote,
  bogotaParts,
  busyLabels,
  dayRange,
  filterReservations,
  timeOptions,
  toInstant,
  toReservationView,
  validateSlot,
} from './reservations.logic'

const AREA = { open_time: '08:00:00', close_time: '22:00:00', max_hours: 4, capacity: 30 }
const NOW = Date.parse('2026-10-19T12:00:00-05:00')
const DAY = '2026-10-25'

describe('horas de Colombia', () => {
  it('convierte entre instante y hora local', () => {
    expect(toInstant(DAY, '14:30')).toBe('2026-10-25T14:30:00-05:00')
    expect(bogotaParts('2026-10-25T19:30:00Z')).toEqual({ date: DAY, time: '14:30' })
    expect(bogotaParts('2026-10-26T03:00:00Z')).toEqual({ date: DAY, time: '22:00' })
  })
  it('rango del dia', () => {
    expect(dayRange('2026-10-31')).toEqual({
      from: '2026-10-31T00:00:00-05:00',
      to: '2026-11-01T00:00:00-05:00',
    })
  })
  it('opciones cada media hora de apertura a cierre', () => {
    const options = timeOptions({ open_time: '08:00:00', close_time: '10:00:00' })
    expect(options).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00'])
  })
})

describe('validateSlot', () => {
  const busy = [{ starts_at: '2026-10-25T14:00:00-05:00', ends_at: '2026-10-25T18:00:00-05:00' }]
  const check = (start: string, end: string, extra = {}) =>
    validateSlot(AREA, { day: DAY, start, end, ...extra }, busy, NOW)

  it('valido', () => expect(check('10:00', '12:00')).toBeNull())
  it('contiguo a otra reserva es valido', () => expect(check('18:00', '20:00')).toBeNull())
  it('fin antes del inicio', () => expect(check('12:00', '10:00')).toMatch(/despues/))
  it('fuera del horario', () => expect(check('20:00', '23:00')).toMatch(/08:00 a 22:00/))
  it('demasiadas horas', () => expect(check('08:00', '13:00')).toMatch(/Maximo 4/))
  it('aforo', () => expect(check('10:00', '11:00', { guests: 31 })).toMatch(/aforo/))
  it('cruce', () => expect(check('17:00', '19:00')).toMatch(/14:00 - 18:00/))
  it('pasado', () =>
    expect(
      validateSlot(AREA, { day: '2026-10-19', start: '09:00', end: '10:00' }, [], NOW),
    ).toMatch(/futuras/))
  it('incompleto no reporta error', () => expect(check('', '')).toBeNull())
  it('etiquetas de ocupados', () => expect(busyLabels(busy)).toEqual(['14:00 - 18:00']))
})

describe('areaFlowNote', () => {
  it('explica aprobacion y pago', () => {
    expect(areaFlowNote({ price: 150000, requires_approval: true })).toMatch(
      /aprobarla; despues pagas/,
    )
    expect(areaFlowNote({ price: 0, requires_approval: false })).toBe(
      'Sin costo. Queda confirmada de inmediato.',
    )
  })
})

const row = (overrides: Partial<ReservationWithRelations> = {}): ReservationWithRelations => ({
  id: 'r1',
  condominium_id: 'c',
  common_area_id: 'a',
  apartment_id: 'apt1',
  starts_at: '2026-10-25T14:00:00-05:00',
  ends_at: '2026-10-25T18:00:00-05:00',
  guests: 20,
  notes: null,
  status: 'PENDING_APPROVAL',
  amount: 150000,
  payment_method: null,
  paid_at: null,
  payment_id: null,
  admin_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  created_by: 'u',
  created_at: '',
  updated_at: '',
  area: { id: 'a', name: 'Salon social' },
  apartment: { id: 'apt1', number: '101', building: { id: 'b', name: 'Torre 1' } },
  author: { id: 'u', full_name: 'Ana' },
  ...overrides,
})

describe('toReservationView', () => {
  const resident = { isAdmin: false, apartmentIds: ['apt1'] }
  const admin = { isAdmin: true, apartmentIds: [] }

  it('datos de la tarjeta', () => {
    const view = toReservationView(row(), resident, NOW)
    expect(view.unitLabel).toBe('Torre 1 · Apto 101')
    expect(view.timeLabel).toBe('14:00 - 18:00')
    expect(view.statusLabel).toBe('Por aprobar')
    expect(view.amountLabel).toContain('150.000')
  })

  it('por aprobar: la administracion revisa; el residente puede cancelar', () => {
    expect(toReservationView(row(), admin, NOW).canReview).toBe(true)
    const mine = toReservationView(row(), resident, NOW)
    expect(mine.canReview).toBe(false)
    expect(mine.canCancel).toBe(true)
    expect(mine.canPayOnline).toBe(false)
  })

  it('pendiente de pago: el residente paga en linea, la administracion registra el pago', () => {
    expect(toReservationView(row({ status: 'PENDING_PAYMENT' }), resident, NOW).canPayOnline).toBe(
      true,
    )
    expect(
      toReservationView(row({ status: 'PENDING_PAYMENT' }), admin, NOW).canRegisterPayment,
    ).toBe(true)
    expect(toReservationView(row({ status: 'PENDING_PAYMENT' }), admin, NOW).canPayOnline).toBe(
      false,
    )
  })

  it('pagada: el residente ya no cancela, la administracion si', () => {
    const paid = row({ status: 'CONFIRMED', paid_at: '2026-10-19', payment_method: 'ONLINE' })
    expect(toReservationView(paid, resident, NOW).canCancel).toBe(false)
    expect(toReservationView(paid, resident, NOW).paymentLabel).toBe('Pagada en linea')
    expect(toReservationView(paid, admin, NOW).canCancel).toBe(true)
  })

  it('reserva de otro apartamento: nada que hacer', () => {
    const other = toReservationView(
      row({ status: 'PENDING_PAYMENT' }),
      { isAdmin: false, apartmentIds: ['x'] },
      NOW,
    )
    expect(other.canPayOnline || other.canCancel).toBe(false)
  })
})

describe('filterReservations', () => {
  const views = [
    toReservationView(row({ id: 'a' }), { isAdmin: true, apartmentIds: [] }, NOW),
    toReservationView(
      row({ id: 'b', status: 'CONFIRMED' }),
      { isAdmin: true, apartmentIds: [] },
      NOW,
    ),
    toReservationView(
      row({ id: 'c', status: 'CANCELLED' }),
      { isAdmin: true, apartmentIds: [] },
      NOW,
    ),
    toReservationView(
      row({
        id: 'd',
        status: 'CONFIRMED',
        starts_at: '2026-10-01T10:00:00-05:00',
        ends_at: '2026-10-01T11:00:00-05:00',
      }),
      { isAdmin: true, apartmentIds: [] },
      NOW,
    ),
  ]
  it('proximas, pendientes e historial', () => {
    expect(filterReservations(views, 'upcoming').map((view) => view.id)).toEqual(['a', 'b'])
    expect(filterReservations(views, 'pending').map((view) => view.id)).toEqual(['a'])
    expect(filterReservations(views, 'history').map((view) => view.id)).toEqual(['d', 'c'])
  })
})

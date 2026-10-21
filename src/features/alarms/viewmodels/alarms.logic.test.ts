import { describe, expect, it } from 'vitest'
import type { AlarmDeviceWithUnit, AlarmEventWithDevice } from '@/services/alarmService'
import { filterEvents, setupExample, toDeviceView, toEventView, unitLabel } from './alarms.logic'

const unit = { id: 'a1', number: '301', building: { name: 'Torre 1' } }

const device = (overrides: Partial<AlarmDeviceWithUnit> = {}): AlarmDeviceWithUnit => ({
  id: 'd1',
  condominium_id: 'c',
  apartment_id: 'a1',
  building_id: 'b1',
  name: 'Panel sala',
  provider: 'AJAX',
  location: null,
  notes: null,
  token_hint: 'beef',
  is_active: true,
  armed_state: null,
  last_event_at: null,
  last_event_type: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  apartment: unit,
  ...overrides,
})

const event = (overrides: Partial<AlarmEventWithDevice> = {}): AlarmEventWithDevice => ({
  id: 'e1',
  condominium_id: 'c',
  device_id: 'd1',
  apartment_id: 'a1',
  building_id: 'b1',
  event_type: 'PANIC',
  severity: 'CRITICAL',
  zone: '3',
  raw_code: null,
  message: 'Boton presionado',
  occurred_at: '2026-10-20T12:00:00Z',
  received_at: '2026-10-20T12:00:00Z',
  payload: {},
  alert_id: 'al1',
  acknowledged_at: null,
  acknowledged_by: null,
  resolution_note: null,
  device: { id: 'd1', name: 'Panel sala', provider: 'AJAX', location: null },
  apartment: unit,
  ...overrides,
})

const owner = { isAdmin: false, isStaff: false, ownedApartmentIds: ['a1'] }
const neighbor = { isAdmin: false, isStaff: false, ownedApartmentIds: ['a9'] }

describe('alarmas', () => {
  it('nombre de la unidad o zona comun', () => {
    expect(unitLabel(unit)).toBe('Torre 1 · 301')
    expect(unitLabel(null, 'Porteria')).toBe('Zona comun · Porteria')
    expect(unitLabel(null)).toBe('Zona comun')
  })

  it('estado de la alarma y permisos', () => {
    expect(toDeviceView(device(), owner)).toMatchObject({
      stateLabel: 'Sin reportes',
      lastEventLabel: 'Aun no ha enviado eventos',
      tokenHint: '••••beef',
      canManage: true,
      providerLabel: 'Ajax',
    })
    expect(toDeviceView(device({ armed_state: 'ARMED' }), neighbor)).toMatchObject({
      stateLabel: 'Armada',
      canManage: false,
    })
    expect(toDeviceView(device({ is_active: false }), owner).stateLabel).toBe('Desactivada')
    expect(
      toDeviceView(device({ apartment_id: null, apartment: null, location: 'Porteria' }), owner),
    ).toMatchObject({
      unitLabel: 'Zona comun · Porteria',
      canManage: false,
    })
    expect(
      toDeviceView(device({ apartment_id: null, apartment: null }), {
        isAdmin: true,
        ownedApartmentIds: [],
      }).canManage,
    ).toBe(true)
  })

  it('eventos: atencion y quien puede atenderlos', () => {
    const panic = toEventView(event(), owner)
    expect(panic).toMatchObject({
      label: 'Boton de panico',
      detail: 'Boton presionado · Zona 3',
      needsAttention: true,
      canAcknowledge: true,
    })
    expect(toEventView(event(), neighbor).canAcknowledge).toBe(false)
    expect(toEventView(event(), { isStaff: true, ownedApartmentIds: [] }).canAcknowledge).toBe(true)
    const armed = toEventView(event({ event_type: 'ARMED', severity: 'INFO' }), owner)
    expect([armed.needsAttention, armed.canAcknowledge]).toEqual([false, false])
    const done = toEventView(event({ acknowledged_at: '2026-10-20T12:05:00Z' }), owner)
    expect([done.needsAttention, done.acknowledged]).toEqual([false, true])
  })

  it('filtros', () => {
    const views = [
      toEventView(event({ id: '1' }), owner),
      toEventView(event({ id: '2', event_type: 'LOW_BATTERY', severity: 'TECHNICAL' }), owner),
      toEventView(event({ id: '3', event_type: 'ARMED', severity: 'INFO' }), owner),
      toEventView(event({ id: '4', acknowledged_at: 'x' }), owner),
    ]
    expect(filterEvents(views, 'attention').map((e) => e.id)).toEqual(['1', '2'])
    expect(filterEvents(views, 'critical').map((e) => e.id)).toEqual(['1', '4'])
    expect(filterEvents(views, 'technical').map((e) => e.id)).toEqual(['2'])
    expect(filterEvents(views, 'activity').map((e) => e.id)).toEqual(['3'])
    expect(filterEvents(views, 'all')).toHaveLength(4)
  })

  it('ejemplo de configuracion con la URL', () => {
    expect(setupExample('https://x/alarm-webhook?key=abc')).toContain(
      '"https://x/alarm-webhook?key=abc"',
    )
  })
})

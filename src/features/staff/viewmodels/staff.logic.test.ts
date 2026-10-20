import { describe, expect, it } from 'vitest'
import type { StaffRosterRow, StaffShiftRow } from '@/types/database'
import { buildBoard, durationLabel, myOpenShift, toHistory } from './staff.logic'

const NOW = Date.parse('2026-10-19T18:00:00Z')

const member = (overrides: Partial<StaffRosterRow> = {}): StaffRosterRow => ({
  profile_id: 'p1',
  full_name: 'Luis Rojas',
  role_label: 'Vigilante',
  phone: '3001112233',
  open_shift_id: null,
  check_in_at: null,
  last_check_out_at: null,
  ...overrides,
})

const shift = (overrides: Partial<StaffShiftRow> = {}): StaffShiftRow => ({
  id: 's1',
  condominium_id: 'c',
  profile_id: null,
  person_name: 'Jardinero externo',
  role_label: 'Jardineria',
  check_in_at: '2026-10-19T14:00:00Z',
  check_out_at: null,
  check_in_by: null,
  check_out_by: null,
  notes: null,
  created_at: '',
  ...overrides,
})

describe('personal', () => {
  it('duracion legible', () => {
    expect(durationLabel('2026-10-19T14:00:00Z', '2026-10-19T14:45:00Z')).toBe('45 min')
    expect(durationLabel('2026-10-19T14:00:00Z', '2026-10-19T17:00:00Z')).toBe('3 h')
    expect(durationLabel('2026-10-19T14:00:00Z', null, NOW)).toBe('4 h')
    expect(durationLabel('2026-10-19T14:00:00Z', '2026-10-19T16:20:00Z')).toBe('2 h 20 min')
  })

  it('separa en turno y sin llegar, e incluye externos sin duplicar miembros', () => {
    const roster = [
      member({ profile_id: 'p1', open_shift_id: 's9', check_in_at: '2026-10-19T12:00:00Z' }),
      member({
        profile_id: 'p2',
        full_name: 'Marta Diaz',
        last_check_out_at: '2026-10-18T22:00:00Z',
      }),
    ]
    const shifts = [
      shift({ id: 's9', profile_id: 'p1', person_name: 'Luis Rojas' }),
      shift({ id: 's2' }),
      shift({ id: 's3', check_out_at: '2026-10-19T15:00:00Z' }),
    ]
    const board = buildBoard(roster, shifts, NOW)
    expect(board.onDuty.map((item) => [item.name, item.external, item.duration])).toEqual([
      ['Luis Rojas', false, '6 h'],
      ['Jardinero externo', true, '4 h'],
    ])
    expect(board.absent.map((item) => item.name)).toEqual(['Marta Diaz'])
    expect(board.absent[0].lastSeen).toMatch(/^Salio /)
  })

  it('historial y jornada propia', () => {
    const shifts = [
      shift({ id: 'a', profile_id: 'u1' }),
      shift({ id: 'b', check_out_at: '2026-10-19T15:00:00Z' }),
    ]
    expect(toHistory(shifts, NOW).map((item) => [item.open, item.checkOut === 'En turno'])).toEqual(
      [
        [true, true],
        [false, false],
      ],
    )
    expect(myOpenShift(shifts, 'u1')?.id).toBe('a')
    expect(myOpenShift(shifts, 'u2')).toBeNull()
  })
})

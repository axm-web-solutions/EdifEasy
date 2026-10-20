import type { StaffRosterRow, StaffShiftRow } from '@/types/database'
import { formatDateTime } from '@/utils/format'

/** "3 h 20 min", "45 min". */
export function durationLabel(fromIso: string, toIso: string | null, now = Date.now()): string {
  const end = toIso ? Date.parse(toIso) : now
  const minutes = Math.max(0, Math.round((end - Date.parse(fromIso)) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

export interface OnDutyView {
  key: string
  shiftId: string
  name: string
  roleLabel: string
  since: string
  duration: string
  external: boolean
  phone: string | null
}

export interface AbsentView {
  profileId: string
  name: string
  roleLabel: string
  phone: string | null
  lastSeen: string
}

export interface ShiftHistoryView {
  id: string
  name: string
  roleLabel: string
  checkIn: string
  checkOut: string
  duration: string
  open: boolean
  notes: string | null
}

/**
 * Tablero de porteria: quien esta en turno (miembros y externos) y quien del
 * personal no ha llegado.
 */
export function buildBoard(roster: StaffRosterRow[], shifts: StaffShiftRow[], now = Date.now()) {
  const onDuty: OnDutyView[] = roster
    .filter((member) => member.open_shift_id && member.check_in_at)
    .map((member) => ({
      key: member.profile_id,
      shiftId: member.open_shift_id as string,
      name: member.full_name,
      roleLabel: member.role_label,
      since: time(member.check_in_at as string),
      duration: durationLabel(member.check_in_at as string, null, now),
      external: false,
      phone: member.phone,
    }))

  const rosterIds = new Set(roster.map((member) => member.profile_id))
  for (const shift of shifts) {
    if (shift.check_out_at || (shift.profile_id && rosterIds.has(shift.profile_id))) continue
    onDuty.push({
      key: shift.id,
      shiftId: shift.id,
      name: shift.person_name,
      roleLabel: shift.role_label,
      since: time(shift.check_in_at),
      duration: durationLabel(shift.check_in_at, null, now),
      external: !shift.profile_id,
      phone: null,
    })
  }

  const absent: AbsentView[] = roster
    .filter((member) => !member.open_shift_id)
    .map((member) => ({
      profileId: member.profile_id,
      name: member.full_name,
      roleLabel: member.role_label,
      phone: member.phone,
      lastSeen: member.last_check_out_at
        ? `Salio ${formatDateTime(member.last_check_out_at)}`
        : 'Sin registros',
    }))

  return { onDuty, absent }
}

export function toHistory(shifts: StaffShiftRow[], now = Date.now()): ShiftHistoryView[] {
  return shifts.map((shift) => ({
    id: shift.id,
    name: shift.person_name,
    roleLabel: shift.role_label,
    checkIn: formatDateTime(shift.check_in_at),
    checkOut: shift.check_out_at ? formatDateTime(shift.check_out_at) : 'En turno',
    duration: durationLabel(shift.check_in_at, shift.check_out_at, now),
    open: !shift.check_out_at,
    notes: shift.notes,
  }))
}

/** Jornada abierta de la persona (para el boton "Marcar salida"). */
export function myOpenShift(shifts: StaffShiftRow[], userId: string | null) {
  if (!userId) return null
  return shifts.find((shift) => shift.profile_id === userId && !shift.check_out_at) ?? null
}

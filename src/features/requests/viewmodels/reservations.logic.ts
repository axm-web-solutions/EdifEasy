/**
 * Reglas puras de reservas de zonas comunes (sin React). Las horas se manejan
 * en hora de Colombia (UTC-5, sin horario de verano), igual que la base.
 * La base vuelve a validar todo; esto solo da respuesta inmediata en pantalla.
 */
import type { CommonAreaRow, ReservationStatus } from '@/types/database'
import type { BusySlot, ReservationWithRelations } from '@/services/reservationService'
import { formatCurrency } from '@/utils/format'

const OFFSET = '-05:00'
const OFFSET_MS = 5 * 3_600_000

const RESERVATION_STATUS: Record<ReservationStatus, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Por aprobar', color: 'gold' },
  PENDING_PAYMENT: { label: 'Pendiente de pago', color: 'orange' },
  CONFIRMED: { label: 'Confirmada', color: 'green' },
  REJECTED: { label: 'Rechazada', color: 'red' },
  CANCELLED: { label: 'Cancelada', color: 'default' },
}

const ACTIVE: ReservationStatus[] = ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED']

/** Fecha y hora de Colombia de un instante ISO. */
export function bogotaParts(iso: string): { date: string; time: string } {
  const local = new Date(new Date(iso).getTime() - OFFSET_MS).toISOString()
  return { date: local.slice(0, 10), time: local.slice(11, 16) }
}

/** "2026-11-02" + "14:30" (hora de Colombia) -> ISO con zona. */
export function toInstant(day: string, time: string): string {
  return `${day}T${time}:00${OFFSET}`
}

/** Dia completo en hora de Colombia, para consultar horarios ocupados. */
export function dayRange(day: string): { from: string; to: string } {
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return { from: toInstant(day, '00:00'), to: toInstant(next.toISOString().slice(0, 10), '00:00') }
}

function minutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Horas posibles de una zona, cada `step` minutos, de la apertura al cierre. */
export function timeOptions(
  area: Pick<CommonAreaRow, 'open_time' | 'close_time'>,
  step = 30,
): string[] {
  const options: string[] = []
  for (let t = minutes(area.open_time); t <= minutes(area.close_time); t += step)
    options.push(hhmm(t))
  return options
}

export function hoursLabel(area: Pick<CommonAreaRow, 'open_time' | 'close_time'>): string {
  return `${area.open_time.slice(0, 5)} a ${area.close_time.slice(0, 5)}`
}

/** Mensaje de por que el horario no sirve, o null si es valido. */
export function validateSlot(
  area: Pick<CommonAreaRow, 'open_time' | 'close_time' | 'max_hours' | 'capacity'>,
  input: { day: string; start: string; end: string; guests?: number | null },
  busy: BusySlot[],
  now = Date.now(),
): string | null {
  if (!input.day || !input.start || !input.end) return null
  const start = minutes(input.start)
  const end = minutes(input.end)
  if (end <= start) return 'La hora final debe ser despues de la inicial'
  if (start < minutes(area.open_time) || end > minutes(area.close_time))
    return `El horario de la zona es de ${hoursLabel(area)}`
  if (end - start > area.max_hours * 60) return `Maximo ${area.max_hours} hora(s) por reserva`
  const startsAt = Date.parse(toInstant(input.day, input.start))
  const endsAt = Date.parse(toInstant(input.day, input.end))
  if (startsAt <= now) return 'Elige una fecha y hora futuras'
  if (area.capacity && (input.guests ?? 0) > area.capacity)
    return `El aforo maximo es de ${area.capacity} personas`
  const clash = busy.find(
    (slot) => Date.parse(slot.starts_at) < endsAt && Date.parse(slot.ends_at) > startsAt,
  )
  if (clash) {
    return `Ese horario se cruza con otra reserva (${bogotaParts(clash.starts_at).time} - ${bogotaParts(clash.ends_at).time})`
  }
  return null
}

export function busyLabels(busy: BusySlot[]): string[] {
  return busy.map(
    (slot) => `${bogotaParts(slot.starts_at).time} - ${bogotaParts(slot.ends_at).time}`,
  )
}

/** Que pasa al crear la reserva en esta zona (texto para el formulario). */
export function areaFlowNote(area: Pick<CommonAreaRow, 'price' | 'requires_approval'>): string {
  const price = Number(area.price)
  if (area.requires_approval && price > 0)
    return `Valor ${formatCurrency(price)}. La administracion debe aprobarla; despues pagas en linea o en la administracion.`
  if (area.requires_approval) return 'Sin costo. La administracion debe aprobarla.'
  if (price > 0)
    return `Valor ${formatCurrency(price)}. Queda confirmada al pagar en linea o en la administracion.`
  return 'Sin costo. Queda confirmada de inmediato.'
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export interface ReservationView {
  id: string
  areaName: string
  unitLabel: string
  authorName: string
  dateLabel: string
  timeLabel: string
  status: ReservationStatus
  statusLabel: string
  statusColor: string
  amountLabel: string
  paymentLabel: string | null
  notes: string | null
  adminNotes: string | null
  active: boolean
  past: boolean
  canReview: boolean
  canPayOnline: boolean
  canRegisterPayment: boolean
  canCancel: boolean
}

export function toReservationView(
  row: ReservationWithRelations,
  viewer: { isAdmin: boolean; apartmentIds: string[] },
  now = Date.now(),
): ReservationView {
  const mine = viewer.apartmentIds.includes(row.apartment_id)
  const active = ACTIVE.includes(row.status)
  const past = Date.parse(row.ends_at) <= now
  const started = Date.parse(row.starts_at) <= now
  const amount = Number(row.amount)
  const building = row.apartment?.building?.name
  return {
    id: row.id,
    areaName: row.area?.name ?? 'Zona comun',
    unitLabel: row.apartment
      ? `${building ? `${building} · ` : ''}Apto ${row.apartment.number}`
      : 'Apartamento',
    authorName: row.author?.full_name ?? '',
    dateLabel: DATE_FORMAT.format(new Date(row.starts_at)),
    timeLabel: `${bogotaParts(row.starts_at).time} - ${bogotaParts(row.ends_at).time}`,
    status: row.status,
    statusLabel: RESERVATION_STATUS[row.status].label,
    statusColor: RESERVATION_STATUS[row.status].color,
    amountLabel: amount > 0 ? formatCurrency(amount) : 'Sin costo',
    paymentLabel: row.paid_at
      ? row.payment_method === 'ONLINE'
        ? 'Pagada en linea'
        : 'Pagada en la administracion'
      : null,
    notes: row.notes,
    adminNotes: row.admin_notes,
    active,
    past,
    canReview: viewer.isAdmin && row.status === 'PENDING_APPROVAL',
    canPayOnline: mine && row.status === 'PENDING_PAYMENT' && amount > 0 && !past,
    canRegisterPayment: viewer.isAdmin && row.status === 'PENDING_PAYMENT',
    canCancel: active && (viewer.isAdmin || (mine && !row.paid_at && !started)),
  }
}

export type ReservationFilter = 'upcoming' | 'pending' | 'history'

export function filterReservations(
  views: ReservationView[],
  filter: ReservationFilter,
): ReservationView[] {
  switch (filter) {
    case 'pending':
      return views.filter(
        (view) => view.status === 'PENDING_APPROVAL' || view.status === 'PENDING_PAYMENT',
      )
    case 'history':
      return views.filter((view) => view.past || !view.active).reverse()
    default:
      return views.filter((view) => view.active && !view.past)
  }
}

import dayjs, { type Dayjs } from 'dayjs'
import { ADMIN_FEE_STATUS } from '@/constants/enums'
import type { AdminFeeRow } from '@/types/database'

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  WOMPI: 'En linea (Wompi)',
  CASH: 'Efectivo / consignacion',
}

/** Dia del mes por defecto como fecha limite de pago. */
export const DEFAULT_DUE_DAY = 10

/** "2026-10-01" -> "octubre de 2026" */
export function formatPeriod(period: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}T00:00:00Z`))
}

/** Pendiente y con la fecha limite ya pasada. */
export function isOverdue(
  fee: Pick<AdminFeeRow, 'status' | 'due_date'>,
  today: Dayjs = dayjs(),
): boolean {
  return fee.status === 'PENDING' && dayjs(fee.due_date).isBefore(today, 'day')
}

/** Estado a mostrar: "Vencida" tiene prioridad sobre "Pendiente". */
export function feeStatus(fee: Pick<AdminFeeRow, 'status' | 'due_date'>): {
  label: string
  color: string
} {
  if (isOverdue(fee)) return { label: 'Vencida', color: 'red' }
  return { label: ADMIN_FEE_STATUS[fee.status].label, color: ADMIN_FEE_STATUS[fee.status].color }
}

export function paymentMethodLabel(method: string | null): string {
  return method ? (PAYMENT_METHOD_LABEL[method] ?? method) : ''
}

/** Fecha limite sugerida para el mes a cobrar. */
export function defaultDueDate(period: Dayjs): Dayjs {
  return period.startOf('month').date(DEFAULT_DUE_DAY)
}

/** Totales del propietario (su lista no se pagina: son pocas cuotas). */
export function ownerTotals(
  fees: Pick<AdminFeeRow, 'status' | 'amount' | 'period'>[],
  year = dayjs().year(),
) {
  const pending = fees.filter((fee) => fee.status === 'PENDING')
  return {
    pendingAmount: pending.reduce((sum, fee) => sum + Number(fee.amount), 0),
    pendingCount: pending.length,
    paidThisYear: fees
      .filter((fee) => fee.status === 'PAID' && dayjs(fee.period).year() === year)
      .reduce((sum, fee) => sum + Number(fee.amount), 0),
  }
}

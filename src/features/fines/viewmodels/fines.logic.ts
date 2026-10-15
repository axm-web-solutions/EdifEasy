import dayjs from 'dayjs'
import type { FineFormValues } from '@/schemas/operations'
import type { FineRow, TablesInsert } from '@/types/database'
import type { FineWithRelations } from '@/types/models'

/** Valores del formulario para una multa nueva. */
export function emptyFineForm(): FineFormValues {
  return {
    apartment_id: '',
    resident_id: null,
    reason: '',
    description: '',
    amount: 0,
    fine_date: dayjs().format('YYYY-MM-DD'),
    due_date: null,
    status: 'PENDING',
    notes: '',
  }
}

/** Multa guardada -> valores del formulario de edicion. */
export function toFineForm(fine: FineRow): FineFormValues {
  return {
    apartment_id: fine.apartment_id,
    resident_id: fine.resident_id,
    reason: fine.reason,
    description: fine.description ?? '',
    amount: fine.amount,
    fine_date: fine.fine_date,
    due_date: fine.due_date,
    status: fine.status,
    notes: fine.notes ?? '',
  }
}

/**
 * Formulario -> fila a guardar. Los textos vacios se guardan como null y al
 * editar se conserva quien creo la multa.
 */
export function toFinePayload(
  values: FineFormValues,
  condominiumId: string,
  createdBy: string | null,
): TablesInsert<'fines'> {
  return {
    condominium_id: condominiumId,
    apartment_id: values.apartment_id,
    resident_id: values.resident_id || null,
    reason: values.reason,
    description: values.description || null,
    amount: values.amount,
    fine_date: values.fine_date,
    due_date: values.due_date || null,
    status: values.status,
    notes: values.notes || null,
    created_by: createdBy,
  }
}

/** Una multa se puede pagar en linea si esta pendiente y tiene valor. */
export function isPayable(fine: Pick<FineWithRelations, 'status' | 'amount'>): boolean {
  return fine.status === 'PENDING' && Number(fine.amount) > 0
}

/** Texto del tooltip del estado: cuando y como se pago. */
export function paidHint(fine: Pick<FineRow, 'paid_at' | 'payment_method'>): string | undefined {
  if (!fine.paid_at) return undefined
  const date = dayjs(fine.paid_at).format('DD/MM/YYYY')
  return `Pagada el ${date}${fine.payment_method === 'WOMPI' ? ' en linea' : ''}`
}

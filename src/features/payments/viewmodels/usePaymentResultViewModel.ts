import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePaymentVerification } from '@/hooks/usePayments'
import { PLAN_PERIOD } from '@/constants/enums'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { PaymentKind, PlanPeriod } from '@/types/database'

/** A donde vuelve el usuario segun lo que pago. */
const RETURN_TO: Record<PaymentKind, { path: string; label: string }> = {
  ADMIN_FEE: { path: '/admin-fees', label: 'Volver a mis cuotas' },
  FINE: { path: '/fines', label: 'Volver a multas' },
  SUBSCRIPTION: { path: '/plans', label: 'Volver a planes' },
}

export type PaymentResultState =
  'missing' | 'loading' | 'error' | 'approved' | 'pending' | 'rejected'

function concept(kind: PaymentKind | undefined, planPeriod: PlanPeriod | null | undefined): string {
  if (kind === 'SUBSCRIPTION' && planPeriod)
    return `Plan ${PLAN_PERIOD[planPeriod].label.toLowerCase()}`
  if (kind === 'FINE') return 'Multa'
  return 'Cuota de administracion'
}

/**
 * ViewModel de la pantalla a la que Wompi devuelve al usuario
 * (`/payments/result?id=<transaccion>`).
 */
export function usePaymentResultViewModel() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const transactionId = params.get('id')
  const query = usePaymentVerification(transactionId)
  const payment = query.data

  let state: PaymentResultState
  if (!transactionId) state = 'missing'
  else if (query.isLoading) state = 'loading'
  else if (query.isError || !payment) state = 'error'
  else if (payment.status === 'APPROVED') state = 'approved'
  else if (payment.status === 'PENDING') state = 'pending'
  else state = 'rejected'

  const target = RETURN_TO[payment?.kind ?? 'ADMIN_FEE']

  return {
    state,
    errorMessage: query.error ? getErrorMessage(query.error) : undefined,
    detail: payment?.amount
      ? {
          concept: concept(payment.kind, payment.plan_period),
          amount: formatCurrency(payment.amount),
          reference: [
            `Referencia ${payment.reference}`,
            payment.paid_at ? formatDateTime(payment.paid_at) : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : null,
    rejectionMessage:
      payment?.status_message || 'La transaccion fue rechazada. No se hizo ningun cobro.',
    refreshing: query.isFetching,
    refresh: () => void query.refetch(),
    backLabel: target.label,
    goBack: () => navigate(target.path),
    goHome: () => navigate('/dashboard'),
  }
}

export type PaymentResultViewModel = ReturnType<typeof usePaymentResultViewModel>

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentService } from '@/services/paymentService'
import { queryKeys } from '@/lib/queryKeys'
import { toSummaryFilters } from '@/services/query'
import { notify } from '@/lib/notify'
import type { PaymentKind, PlanPeriod, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useAdminFees(condominiumId: string | null, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminFees.list(condominiumId ?? '', params),
    queryFn: () => paymentService.listAdminFees(condominiumId as string, params),
    enabled: Boolean(condominiumId) && enabled,
  })
}

/** Totales de las cuotas con los filtros de la tabla (sin paginar). */
export function useAdminFeesSummary(
  condominiumId: string | null,
  params: ListParams,
  enabled = true,
) {
  const filters = toSummaryFilters(params)
  return useQuery({
    queryKey: queryKeys.adminFees.summary(condominiumId ?? '', filters),
    queryFn: () => paymentService.adminFeesSummary(condominiumId as string, filters),
    enabled: Boolean(condominiumId) && enabled,
  })
}

export function useMyAdminFees(condominiumId: string | null, userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.adminFees.mine(condominiumId ?? ''),
    queryFn: () => paymentService.listMyAdminFees(condominiumId as string, userId as string),
    enabled: Boolean(condominiumId && userId),
  })
}

export function useSubscriptionQuote(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments.quote(condominiumId ?? ''),
    queryFn: () => paymentService.quote(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function usePayments(condominiumId: string | null, kind: PaymentKind) {
  return useQuery({
    queryKey: queryKeys.payments.list(condominiumId ?? '', kind),
    queryFn: () => paymentService.listPayments(condominiumId as string, kind),
    enabled: Boolean(condominiumId),
  })
}

/** Cada cuanto se vuelve a consultar un pago que sigue en proceso (PSE puede tardar). */
const VERIFY_POLL_MS = 4000
const VERIFY_MAX_POLLS = 15

/**
 * Resultado de una transaccion de Wompi. Mientras siga en proceso se vuelve a
 * consultar; la Edge Function lo registra en la base si el webhook no ha llegado.
 */
export function usePaymentVerification(transactionId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments.verify(transactionId ?? ''),
    queryFn: () => paymentService.verify(transactionId as string),
    enabled: Boolean(transactionId),
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' && query.state.dataUpdateCount < VERIFY_MAX_POLLS
        ? VERIFY_POLL_MS
        : false,
  })
}

export function useAdminFeeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-fees'] })

  const generate = useMutation({
    mutationFn: paymentService.generateAdminFees,
    onSuccess: (created) => {
      notify.success(
        created > 0
          ? `Se generaron ${created} cuota(s) de administracion`
          : 'Las cuotas de ese mes ya estaban generadas',
      )
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'admin_fees'> }) =>
      paymentService.updateAdminFee(id, values),
    onSuccess: () => {
      notify.success('Cuota actualizada')
      invalidate()
    },
  })

  const registerCash = useMutation({
    mutationFn: (id: string) => paymentService.registerCashPayment(id),
    onSuccess: () => {
      notify.success('Pago registrado')
      invalidate()
    },
  })

  const cancel = useMutation({
    mutationFn: (id: string) => paymentService.updateAdminFee(id, { status: 'CANCELLED' }),
    onSuccess: () => {
      notify.success('Cuota anulada')
      invalidate()
    },
  })

  return { generate, update, registerCash, cancel }
}

/** Inicia el checkout de Wompi y redirige el navegador a la pasarela. */
export function useCheckout() {
  const redirect = (url: string) => window.location.assign(url)

  const payAdminFee = useMutation({
    mutationFn: (adminFeeId: string) => paymentService.startAdminFeeCheckout(adminFeeId),
    onSuccess: redirect,
  })

  const payFine = useMutation({
    mutationFn: (fineId: string) => paymentService.startFineCheckout(fineId),
    onSuccess: redirect,
  })

  const paySubscription = useMutation({
    mutationFn: ({ condominiumId, period }: { condominiumId: string; period: PlanPeriod }) =>
      paymentService.startSubscriptionCheckout(condominiumId, period),
    onSuccess: redirect,
  })

  return { payAdminFee, payFine, paySubscription }
}

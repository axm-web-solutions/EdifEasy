import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentService } from '@/services/paymentService'
import { queryKeys } from '@/lib/queryKeys'
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

  return { generate, update }
}

/** Inicia el checkout de Wompi y redirige el navegador a la pasarela. */
export function useCheckout() {
  const redirect = (url: string) => window.location.assign(url)

  const payAdminFee = useMutation({
    mutationFn: (adminFeeId: string) => paymentService.startAdminFeeCheckout(adminFeeId),
    onSuccess: redirect,
  })

  const paySubscription = useMutation({
    mutationFn: ({ condominiumId, period }: { condominiumId: string; period: PlanPeriod }) =>
      paymentService.startSubscriptionCheckout(condominiumId, period),
    onSuccess: redirect,
  })

  return { payAdminFee, paySubscription }
}

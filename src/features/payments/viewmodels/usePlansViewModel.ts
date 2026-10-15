import { useAuth } from '@/hooks/useAuth'
import { useCheckout, usePayments, useSubscriptionQuote } from '@/hooks/usePayments'
import { PAYMENT_STATUS, PLAN_PERIOD } from '@/constants/enums'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { PlanPeriod } from '@/types/database'
import { planStatus, tariffDescription } from './plans.logic'

/**
 * ViewModel de Planes: el administrador paga EdiFeasy por todo el conjunto con
 * un unico pago mensual, semestral o anual. El precio viene de la base.
 */
export function usePlansViewModel() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const quoteQuery = useSubscriptionQuote(currentCondominiumId)
  const paymentsQuery = usePayments(currentCondominiumId, 'SUBSCRIPTION')
  const { paySubscription } = useCheckout()

  const quote = quoteQuery.data
  const current = quote?.current ?? null
  const status = planStatus(current)

  const statusFooter =
    status.state === 'active' && current
      ? `${PLAN_PERIOD[current.plan_period].label} · vence el ${formatDate(current.ends_at)} (${status.daysLeft} dias)`
      : status.state === 'expired' && current
        ? `Vencio el ${formatDate(current.ends_at)}`
        : 'Elige un plan para activar el sistema'

  return {
    loading: quoteQuery.isLoading,
    error: quoteQuery.isError ? getErrorMessage(quoteQuery.error) : null,
    retry: () => void quoteQuery.refetch(),
    condominiumName: currentMembership?.condominium_name ?? 'tu conjunto',

    status: {
      state: status.state,
      label:
        status.state === 'active' ? 'Activo' : status.state === 'expired' ? 'Vencido' : 'Sin plan',
      footer: statusFooter,
      renewNotice:
        status.state === 'active' && current
          ? `Si pagas ahora, el nuevo periodo empieza cuando termine el actual (${formatDate(current.ends_at)}).`
          : null,
    },

    pricing: {
      apartments: formatNumber(quote?.apartments_count ?? 0),
      unitPrice: `${formatCurrency(quote?.unit_price ?? 0)} / mes`,
      tariff: tariffDescription(quote?.apartments_count ?? 0),
      noApartments: (quote?.apartments_count ?? 0) === 0,
    },

    plans: (quote?.plans ?? []).map((plan) => ({
      period: plan.period,
      label: PLAN_PERIOD[plan.period].label,
      description: PLAN_PERIOD[plan.period].description,
      amount: formatCurrency(plan.amount),
      breakdown: `${formatNumber(quote?.apartments_count ?? 0)} apartamentos × ${formatCurrency(quote?.unit_price ?? 0)}`,
      duration: `${plan.months} ${plan.months === 1 ? 'mes' : 'meses'} de servicio`,
      payable: plan.amount > 0,
      paying: paySubscription.isPending && paySubscription.variables?.period === plan.period,
    })),
    paying: paySubscription.isPending,
    pay: (period: PlanPeriod) => {
      if (currentCondominiumId)
        paySubscription.mutate({ condominiumId: currentCondominiumId, period })
    },

    history: {
      loading: paymentsQuery.isLoading,
      items: (paymentsQuery.data ?? []).map((payment) => ({
        id: payment.id,
        title: payment.plan_period
          ? `Plan ${PLAN_PERIOD[payment.plan_period].label.toLowerCase()}`
          : 'Plan',
        description: [
          formatDateTime(payment.created_at),
          `${formatNumber(payment.apartments_count ?? 0)} apartamentos`,
          payment.payer?.full_name,
          `Ref. ${payment.reference}`,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: formatCurrency(payment.amount),
        status: {
          label: PAYMENT_STATUS[payment.status].label,
          color: PAYMENT_STATUS[payment.status].color,
        },
      })),
    },
  }
}

export type PlansViewModel = ReturnType<typeof usePlansViewModel>

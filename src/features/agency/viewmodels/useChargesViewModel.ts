import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyMutations,
  useAgencyRealtime,
  useLeaseCharges,
  usePaymentAccount,
} from '@/hooks/useAgency'
import { chargesSummary, periodOptions, toChargeView } from '../agency.logic'

export type ChargeFilter = 'pending' | 'overdue' | 'paid' | 'all'

/** Desde cuando se listan cobros: ultimos 6 meses. */
function sixMonthsAgo() {
  const date = new Date()
  date.setMonth(date.getMonth() - 6, 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Cobros de arriendo: generar los del mes (canon y administracion), ver lo
 * pendiente y lo vencido, y registrar pagos recibidos por fuera de la app.
 */
export function useChargesViewModel() {
  const { currentCondominiumId } = useAuth()
  const [from] = useState(sixMonthsAgo)
  const query = useLeaseCharges(currentCondominiumId, from)
  const accountQuery = usePaymentAccount(currentCondominiumId)
  const mutations = useAgencyMutations()
  useAgencyRealtime(currentCondominiumId)

  const months = periodOptions()
  const [period, setPeriod] = useState(months[2].value)
  const [filter, setFilter] = useState<ChargeFilter>('pending')
  const [selected, setSelected] = useState<string[]>([])

  const rows = useMemo(() => query.data ?? [], [query.data])
  const views = useMemo(
    () =>
      rows.map((row) => ({
        ...toChargeView(row),
        property: row.property?.title ?? 'Propiedad',
        tenant: row.lease?.tenant_name ?? '',
        phone: row.lease?.tenant_phone ?? null,
      })),
    [rows],
  )
  const visible = useMemo(
    () =>
      views.filter((view) =>
        filter === 'pending'
          ? view.isPending
          : filter === 'overdue'
            ? view.isOverdue
            : filter === 'paid'
              ? view.statusLabel === 'Pagado'
              : true,
      ),
    [views, filter],
  )
  const summary = useMemo(() => chargesSummary(views), [views])

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : 'ready',
    retry: () => void query.refetch(),
    charges: visible,
    summary,
    hasOnlinePayments: Boolean(accountQuery.data),

    periodOptions: months,
    period,
    setPeriod,
    generate: () => {
      if (currentCondominiumId)
        mutations.generateCharges.mutate({ agencyId: currentCondominiumId, period })
    },
    generating: mutations.generateCharges.isPending,

    filter,
    setFilter: (value: ChargeFilter) => {
      setFilter(value)
      setSelected([])
    },
    filterOptions: [
      { value: 'pending', label: `Pendientes (${summary.pendingCount})` },
      { value: 'overdue', label: `Vencidos (${summary.overdueCount})` },
      { value: 'paid', label: 'Pagados' },
      { value: 'all', label: 'Todos' },
    ],

    selected,
    toggle: (id: string) =>
      setSelected((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      ),
    registerPayment: (method: 'CASH' | 'TRANSFER') =>
      mutations.registerPayment.mutate(
        { chargeIds: selected, method },
        { onSuccess: () => setSelected([]) },
      ),
    registering: mutations.registerPayment.isPending,
    voidCharge: (id: string) => mutations.voidCharge.mutate(id),
  }
}

export type ChargesViewModel = ReturnType<typeof useChargesViewModel>

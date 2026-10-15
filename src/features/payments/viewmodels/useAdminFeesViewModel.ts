import { useEffect, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useAuth } from '@/hooks/useAuth'
import { useTableParams } from '@/hooks/useTableParams'
import { useExportFetcher } from '@/hooks/useExportFetcher'
import { useCondominium } from '@/hooks/useCondominiums'
import {
  useAdminFeeMutations,
  useAdminFees,
  useAdminFeesSummary,
  useCheckout,
  useMyAdminFees,
} from '@/hooks/usePayments'
import { paymentService } from '@/services/paymentService'
import { ADMIN_FEE_STATUS, toOptions } from '@/constants/enums'
import { readSetting } from '@/utils/brand'
import { apartmentLabel, formatCurrency } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { AdminFeeWithRelations } from '@/types/models'
import {
  defaultDueDate,
  feeStatus,
  formatPeriod,
  ownerTotals,
  paymentMethodLabel,
} from './adminFees.logic'

/** Que vista de cuotas ve el usuario: gestion (administracion) o pago (propietario). */
export function useAdminFeesMode() {
  const { hasPermission, loadingContext } = useAuth()
  return {
    loading: loadingContext,
    mode: hasPermission('manageFinance') ? 'manager' : 'owner',
  } as const
}

/** Presentacion comun de una cuota (lista del propietario y tabla del administrador). */
function describeFee(fee: AdminFeeWithRelations) {
  return {
    apartment: apartmentLabel(fee.apartment),
    period: formatPeriod(fee.period),
    amount: formatCurrency(fee.amount),
    status: feeStatus(fee),
    paymentMethod: paymentMethodLabel(fee.payment_method),
  }
}

// ---------------------------------------------------------------------------
// Administracion
// ---------------------------------------------------------------------------
export function useAdminFeesManagerViewModel() {
  const { currentCondominiumId } = useAuth()
  const condominiumQuery = useCondominium(currentCondominiumId)
  const table = useTableParams({ pageSize: 10 })
  const query = useAdminFees(currentCondominiumId, table.params)
  const summary = useAdminFeesSummary(currentCondominiumId, table.params)
  const exportFetcher = useExportFetcher(
    paymentService.listAdminFees,
    currentCondominiumId,
    table.params,
  )
  const { generate, registerCash, cancel } = useAdminFeeMutations()

  // Formulario de generacion. El valor por defecto es el ultimo que uso el conjunto.
  const [amount, setAmount] = useState<number | null>(null)
  const [period, setPeriodState] = useState<Dayjs>(dayjs().startOf('month'))
  const [dueDate, setDueDate] = useState<Dayjs>(defaultDueDate(dayjs()))
  const savedAmount = Number(readSetting(condominiumQuery.data?.settings, 'adminFeeAmount')) || null
  useEffect(() => {
    if (savedAmount && amount === null) setAmount(savedAmount)
  }, [savedAmount, amount])

  return {
    stats: {
      loading: summary.isLoading,
      paidAmount: summary.data?.paid_amount ?? 0,
      pendingAmount: summary.data?.pending_amount ?? 0,
      overdueCount: summary.data?.overdue_count ?? 0,
      overdueAmount: summary.data?.overdue_amount ?? 0,
    },

    generator: {
      amount,
      setAmount,
      period,
      setPeriod: (value: Dayjs) => {
        setPeriodState(value.startOf('month'))
        setDueDate(defaultDueDate(value))
      },
      dueDate,
      setDueDate,
      isDueDateDisabled: (date: Dayjs) => date.isBefore(period.startOf('month'), 'day'),
      canSubmit: Boolean(amount && currentCondominiumId),
      submitting: generate.isPending,
      submit: () => {
        if (!currentCondominiumId || !amount) return
        generate.mutate({
          condominiumId: currentCondominiumId,
          period: period.startOf('month').format('YYYY-MM-DD'),
          amount,
          dueDate: dueDate.format('YYYY-MM-DD'),
        })
      },
    },

    table: {
      rows: query.data?.data ?? [],
      total: query.data?.total ?? 0,
      loading: query.isFetching,
      isError: query.isError,
      errorMessage: query.error ? getErrorMessage(query.error) : undefined,
      retry: () => void query.refetch(),
      params: table.params,
      handlers: table,
      hasActiveFilters: table.hasActiveFilters,
      filters: [{ key: 'status', label: 'Estado', options: toOptions(ADMIN_FEE_STATUS) }],
      exportFetcher,
    },

    row: {
      describe: describeFee,
      canSettle: (fee: AdminFeeWithRelations) => fee.status === 'PENDING',
    },

    actions: {
      registerCash: async (fee: AdminFeeWithRelations) => {
        const info = describeFee(fee)
        const ok = await confirmDelete({
          title: `Registrar el pago de ${info.apartment}?`,
          content: `Se marcara como pagada la cuota de ${info.period} por ${info.amount}.`,
          okText: 'Registrar pago',
          danger: false,
        })
        if (ok) await registerCash.mutateAsync(fee.id)
      },
      cancel: async (fee: AdminFeeWithRelations) => {
        const ok = await confirmDelete({
          title: `Anular la cuota de ${describeFee(fee).apartment}?`,
          okText: 'Anular',
        })
        if (ok) await cancel.mutateAsync(fee.id)
      },
    },
  }
}

export type AdminFeesManagerViewModel = ReturnType<typeof useAdminFeesManagerViewModel>

// ---------------------------------------------------------------------------
// Propietario
// ---------------------------------------------------------------------------
export function useMyAdminFeesViewModel() {
  const { currentCondominiumId, user } = useAuth()
  const query = useMyAdminFees(currentCondominiumId, user?.id)
  const { payAdminFee } = useCheckout()

  const fees = query.data ?? []
  const totals = ownerTotals(fees)

  return {
    loading: query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    retry: () => void query.refetch(),
    year: dayjs().year(),
    totals,
    pending: fees
      .filter((fee) => fee.status === 'PENDING')
      .map((fee) => ({ fee, ...describeFee(fee) })),
    paid: fees.filter((fee) => fee.status === 'PAID').map((fee) => ({ fee, ...describeFee(fee) })),
    pay: (fee: AdminFeeWithRelations) => payAdminFee.mutate(fee.id),
    isPaying: (fee: AdminFeeWithRelations) =>
      payAdminFee.isPending && payAdminFee.variables === fee.id,
    paying: payAdminFee.isPending,
  }
}

export type MyAdminFeesViewModel = ReturnType<typeof useMyAdminFeesViewModel>

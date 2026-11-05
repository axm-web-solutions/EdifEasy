import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyProperties } from '@/hooks/useAgency'
import {
  useAgencyManagementMutations,
  useAgencyManagementRealtime,
  useAgreements,
  usePropertyExpenses,
  useSettlementLines,
  useSettlements,
} from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import { expenseSchema, type ExpenseFormValues } from '@/schemas/agency'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import { periodLabel, periodOptions } from '../agency.logic'
import { SETTLEMENT_STATUS } from '../management.logic'

const today = () => new Date().toISOString().slice(0, 10)
const money = (value: number) => formatCurrency(Number(value))

/**
 * Liquidaciones al propietario: generar las del mes (canon cobrado menos
 * comision, IVA, retencion y gastos aprobados), revisarlas, aprobarlas y
 * registrar el giro. Incluye los gastos de las propiedades.
 */
export function useSettlementsViewModel() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const settlementsQuery = useSettlements(currentCondominiumId)
  const expensesQuery = usePropertyExpenses(currentCondominiumId)
  const agreementsQuery = useAgreements(currentCondominiumId)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const mutations = useAgencyManagementMutations()
  useAgencyManagementRealtime(currentCondominiumId)

  const [tab, setTab] = useState<'settlements' | 'expenses'>('settlements')
  const months = periodOptions()
  // Lo normal es liquidar el mes que acaba de terminar.
  const [period, setPeriod] = useState(months[1].value)

  const all = useMemo(() => settlementsQuery.data ?? [], [settlementsQuery.data])
  const rows = all.filter((row) => row.period.slice(0, 7) === period.slice(0, 7))
  const sum = (key: 'gross_collected' | 'commission' | 'vat' | 'net_payable') =>
    rows.reduce((total, row) => total + Number(row[key]), 0)

  const settlements = rows.map((row) => {
    const status = SETTLEMENT_STATUS[row.status]
    return {
      id: row.id,
      agreementId: row.agreement_id,
      owner: row.owner_name,
      property: row.property?.title ?? 'Propiedad',
      gross: money(row.gross_collected),
      deductions: money(
        Number(row.commission) + Number(row.vat) + Number(row.withholding) + Number(row.expenses),
      ),
      net: money(row.net_payable),
      statusLabel: status.label,
      statusColor: status.color,
      canRegenerate: row.status === 'DRAFT',
      canApprove: row.status === 'DRAFT',
      canPay: row.status === 'APPROVED',
      canVoid: row.status === 'DRAFT' || row.status === 'APPROVED',
      paidLabel:
        row.status === 'PAID' && row.paid_at
          ? `Girada el ${formatDate(row.paid_at)}${row.transfer_reference ? ` · Ref. ${row.transfer_reference}` : ''}`
          : null,
    }
  })

  // --------------------------------------------------------------- detalle
  const [detailId, setDetailId] = useState<string | null>(null)
  const linesQuery = useSettlementLines(detailId)
  const detail = all.find((row) => row.id === detailId) ?? null
  const agreement = (agreementsQuery.data ?? []).find((item) => item.id === detail?.agreement_id)

  // ------------------------------------------------------------ pago (giro)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [reference, setReference] = useState('')

  // ----------------------------------------------------------------- gastos
  const expenses = (expensesQuery.data ?? []).map((row) => ({
    id: row.id,
    property: row.property?.title ?? 'Propiedad',
    description: row.description,
    amount: money(row.amount),
    date: formatDate(row.expense_date),
    statusLabel: row.settlement_id
      ? 'Descontado'
      : row.approved_at
        ? 'Aprobado'
        : 'Esperando al propietario',
    statusColor: row.settlement_id ? 'default' : row.approved_at ? 'green' : 'gold',
    canApprove: !row.approved_at,
    canRemove: !row.settlement_id,
  }))
  const [expenseOpen, setExpenseOpen] = useState(false)
  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: '',
      description: '',
      amount: 0,
      expense_date: today(),
      approved: false,
    },
  })
  const submitExpense = expenseForm.handleSubmit((values) => {
    if (!currentCondominiumId) return
    mutations.addExpense.mutate(
      {
        values: {
          condominium_id: currentCondominiumId,
          property_id: values.property_id,
          description: values.description,
          amount: values.amount,
          expense_date: values.expense_date,
        },
        approve: values.approved,
      },
      { onSuccess: () => setExpenseOpen(false) },
    )
  })
  const managed = new Set(
    (agreementsQuery.data ?? []).filter((item) => item.status === 'ACTIVE').map((item) => item.property_id),
  )

  return {
    status: settlementsQuery.isLoading ? 'loading' : settlementsQuery.isError ? 'error' : 'ready',
    retry: () => void settlementsQuery.refetch(),
    tab,
    setTab,
    hasAgreements: managed.size > 0,

    periodOptions: months,
    period,
    setPeriod,
    periodName: periodLabel(period),
    generate: () => {
      if (currentCondominiumId)
        mutations.generateSettlements.mutate({ agencyId: currentCondominiumId, period })
    },
    generating: mutations.generateSettlements.isPending,
    totals: [
      { label: 'Canon cobrado', value: money(sum('gross_collected')) },
      { label: 'Tu comision + IVA', value: money(sum('commission') + sum('vat')) },
      { label: 'A girar a propietarios', value: money(sum('net_payable')) },
    ],
    settlements,
    regenerate: (agreementId: string) =>
      mutations.regenerateSettlement.mutate({ agreementId, period }),
    approve: (id: string) => mutations.setSettlementStatus.mutate({ id, status: 'APPROVED' }),
    voidSettlement: (id: string) => mutations.setSettlementStatus.mutate({ id, status: 'VOID' }),
    busy: mutations.setSettlementStatus.isPending || mutations.regenerateSettlement.isPending,
    actionError: mutations.regenerateSettlement.error
      ? getErrorMessage(mutations.regenerateSettlement.error)
      : mutations.setSettlementStatus.error
        ? getErrorMessage(mutations.setSettlementStatus.error)
        : null,

    payingId,
    openPay: (id: string) => {
      setReference('')
      setPayingId(id)
    },
    closePay: () => setPayingId(null),
    reference,
    setReference,
    confirmPay: () => {
      if (!payingId) return
      mutations.setSettlementStatus.mutate(
        { id: payingId, status: 'PAID', reference },
        { onSuccess: () => setPayingId(null) },
      )
    },

    detailOpen: Boolean(detailId),
    openDetail: setDetailId,
    closeDetail: () => setDetailId(null),
    detail: detail
      ? {
          agency: currentMembership?.condominium_name ?? '',
          title: `Liquidacion de ${periodLabel(detail.period)}`,
          owner: detail.owner_name,
          property: detail.property?.title ?? '',
          bank: agreement?.bank_name
            ? `${agreement.bank_name} ${agreement.account_type?.toLowerCase() ?? ''} ${agreement.account_number ?? ''} · ${agreement.account_holder ?? detail.owner_name}`
            : null,
          lines: (linesQuery.data ?? [])
            .slice()
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((line) => ({
              id: line.id,
              description: line.description,
              amount: money(line.amount),
              negative: Number(line.amount) < 0,
            })),
          net: money(detail.net_payable),
          statusLabel: SETTLEMENT_STATUS[detail.status].label,
          generated: formatDateTime(detail.created_at),
        }
      : null,
    linesLoading: linesQuery.isLoading,
    print: () => window.print(),

    expenses,
    expenseOpen,
    openExpense: () => {
      expenseForm.reset({
        property_id: '',
        description: '',
        amount: 0,
        expense_date: today(),
        approved: false,
      })
      mutations.addExpense.reset()
      setExpenseOpen(true)
    },
    closeExpense: () => setExpenseOpen(false),
    expenseControl: expenseForm.control,
    submitExpense,
    savingExpense: mutations.addExpense.isPending,
    expenseError: mutations.addExpense.error ? getErrorMessage(mutations.addExpense.error) : null,
    propertyOptions: (propertiesQuery.data ?? [])
      .filter((property) => managed.has(property.id))
      .map((property) => ({ value: property.id, label: property.title })),
    approveExpense: (id: string) => mutations.approveExpense.mutate(id),
    removeExpense: (id: string) => mutations.removeExpense.mutate(id),
  }
}

export type SettlementsViewModel = ReturnType<typeof useSettlementsViewModel>

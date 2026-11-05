import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyManagementMutations,
  usePropertyExpenses,
  useSettlementLines,
  useSettlements,
} from '@/hooks/useAgencyManagement'
import { formatCurrency, formatDate } from '@/utils/format'
import { periodLabel } from '../agency.logic'
import { SETTLEMENT_STATUS } from '../management.logic'

const money = (value: number) => formatCurrency(Number(value))

/**
 * Propietario: sus liquidaciones (aprobadas o giradas) con el detalle de cada
 * mes, y los gastos de sus propiedades que esperan su aprobacion.
 * RLS solo devuelve lo suyo.
 */
export function useOwnerStatementsViewModel() {
  const { currentCondominiumId } = useAuth()
  const settlementsQuery = useSettlements(currentCondominiumId)
  const expensesQuery = usePropertyExpenses(currentCondominiumId)
  const mutations = useAgencyManagementMutations()
  const [openId, setOpenId] = useState<string | null>(null)
  const linesQuery = useSettlementLines(openId)

  const rows = settlementsQuery.data ?? []
  const paidThisYear = rows
    .filter((row) => row.status === 'PAID' && row.period.slice(0, 4) === String(new Date().getFullYear()))
    .reduce((sum, row) => sum + Number(row.net_payable), 0)

  return {
    status: settlementsQuery.isLoading ? 'loading' : settlementsQuery.isError ? 'error' : 'ready',
    retry: () => void settlementsQuery.refetch(),
    paidThisYear: money(paidThisYear),
    statements: rows.map((row) => ({
      id: row.id,
      title: `${periodLabel(row.period)} · ${row.property?.title ?? 'Propiedad'}`,
      gross: money(row.gross_collected),
      fee: money(Number(row.commission) + Number(row.vat)),
      withholding: Number(row.withholding) ? money(row.withholding) : null,
      expenses: Number(row.expenses) ? money(row.expenses) : null,
      net: money(row.net_payable),
      statusLabel: SETTLEMENT_STATUS[row.status].label,
      statusColor: SETTLEMENT_STATUS[row.status].color,
      paid:
        row.status === 'PAID' && row.paid_at
          ? `Girada el ${formatDate(row.paid_at)}${row.transfer_reference ? ` · Ref. ${row.transfer_reference}` : ''}`
          : 'Pendiente de giro',
      open: row.id === openId,
    })),
    toggle: (id: string) => setOpenId((current) => (current === id ? null : id)),
    lines: (linesQuery.data ?? [])
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .map((line) => ({ id: line.id, description: line.description, amount: money(line.amount) })),
    linesLoading: linesQuery.isLoading,

    pendingExpenses: (expensesQuery.data ?? [])
      .filter((row) => !row.approved_at)
      .map((row) => ({
        id: row.id,
        description: row.description,
        property: row.property?.title ?? '',
        amount: money(row.amount),
        date: formatDate(row.expense_date),
      })),
    approveExpense: (id: string) => mutations.approveExpense.mutate(id),
    approving: mutations.approveExpense.isPending,
  }
}

export type OwnerStatementsViewModel = ReturnType<typeof useOwnerStatementsViewModel>

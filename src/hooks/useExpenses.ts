import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseService } from '@/services/expenseService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useExpenses(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.expenses.list(condominiumId ?? '', params),
    queryFn: () => expenseService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useExpenseCategories(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.expenses.categories(condominiumId ?? ''),
    queryFn: () => expenseService.categories(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 120_000,
  })
}

export function useExpensesMonthly(condominiumId: string | null, months = 6) {
  return useQuery({
    queryKey: queryKeys.expenses.monthly(condominiumId ?? '', months),
    queryFn: () => expenseService.monthlySeries(condominiumId as string, months),
    enabled: Boolean(condominiumId),
  })
}

export function useExpensesByCategory(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.expenses.byCategory(condominiumId ?? ''),
    queryFn: () => expenseService.byCategory(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useExpenseMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    void queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'expenses'>) => expenseService.create(values),
    onSuccess: () => {
      notify.success('Gasto registrado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'expenses'> }) =>
      expenseService.update(id, values),
    onSuccess: () => {
      notify.success('Gasto actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => expenseService.remove(id),
    onSuccess: () => {
      notify.success('Gasto eliminado')
      invalidate()
    },
  })

  const createCategory = useMutation({
    mutationFn: (values: TablesInsert<'expense_categories'>) => expenseService.createCategory(values),
    onSuccess: () => {
      notify.success('Categoria creada')
      invalidate()
    },
  })

  const removeCategory = useMutation({
    mutationFn: (id: string) => expenseService.removeCategory(id),
    onSuccess: () => {
      notify.success('Categoria eliminada')
      invalidate()
    },
  })

  return { create, update, remove, createCategory, removeCategory }
}

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountingService, type ConnectInput } from '@/services/accountingService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { AccountingImportKind, AccountingProvider } from '@/types/database'

const enabledFor = (id: string | null, enabled = true) => Boolean(id) && enabled

export function useAccountingStatements(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.accounting.statements(condominiumId ?? ''),
    queryFn: () => accountingService.statements(condominiumId as string),
    enabled: enabledFor(condominiumId),
  })
}

export function useAccountingMovements(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.accounting.movements(apartmentId ?? ''),
    queryFn: () => accountingService.movements(apartmentId as string),
    enabled: enabledFor(apartmentId),
  })
}

export function useFinancialStatements(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.financial(condominiumId ?? ''),
    queryFn: () => accountingService.financialStatements(condominiumId as string),
    enabled: enabledFor(condominiumId, enabled),
  })
}

export function useBudgetLines(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.budget(condominiumId ?? ''),
    queryFn: () => accountingService.budget(condominiumId as string),
    enabled: enabledFor(condominiumId, enabled),
  })
}

export function usePortfolio(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.portfolio(condominiumId ?? ''),
    queryFn: () => accountingService.portfolio(condominiumId as string),
    enabled: enabledFor(condominiumId, enabled),
  })
}

export function useAccountingIntegrations(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.integrations(condominiumId ?? ''),
    queryFn: () => accountingService.integrations(condominiumId as string),
    enabled: enabledFor(condominiumId, enabled),
  })
}

export function useAccountingRuns(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.runs(condominiumId ?? ''),
    queryFn: () => accountingService.syncRuns(condominiumId as string),
    enabled: enabledFor(condominiumId, enabled),
  })
}

/** Al sincronizar o cargar un archivo, todos los que miran se actualizan solos. */
export function useAccountingRealtime(condominiumId: string | null): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!condominiumId) return
    return accountingService.subscribe(condominiumId, () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting'] })
    })
  }, [condominiumId, queryClient])
}

export function useAccountingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['accounting'] })
  return {
    importRows: useMutation({
      mutationFn: (input: {
        condominiumId: string
        kind: AccountingImportKind
        rows: Record<string, string>[]
        integrationId: string | null
      }) =>
        accountingService.importRows(
          input.condominiumId,
          input.kind,
          input.rows,
          input.integrationId,
        ),
      onSuccess: invalidate,
    }),
    connect: useMutation({
      mutationFn: (input: ConnectInput) => accountingService.connect(input),
      onSuccess: () => {
        notify.success('Contabilidad conectada y sincronizada')
        invalidate()
      },
    }),
    sync: useMutation({
      mutationFn: (integrationId: string) => accountingService.sync(integrationId),
      onSuccess: () => {
        notify.success('Sincronizacion completa')
        invalidate()
      },
      onError: invalidate,
    }),
    disconnect: useMutation({
      mutationFn: async (input: { integrationId: string; mode: 'API' | 'FILE' }) => {
        if (input.mode === 'API') await accountingService.disconnect(input.integrationId)
        else await accountingService.removeFileIntegration(input.integrationId)
      },
      onSuccess: () => {
        notify.success('Conexion eliminada')
        invalidate()
      },
    }),
    addFile: useMutation({
      mutationFn: (input: { condominiumId: string; provider: AccountingProvider }) =>
        accountingService.addFileIntegration(input.condominiumId, input.provider),
      onSuccess: invalidate,
    }),
    link: useMutation({
      mutationFn: (input: { condominiumId: string; code: string; apartmentId: string }) =>
        accountingService.link(input.condominiumId, input.code, input.apartmentId),
      onSuccess: () => {
        notify.success('Codigo enlazado con la unidad')
        invalidate()
      },
    }),
  }
}

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { financialReportService } from '@/services/financialReportService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { FinancialReportRow, TablesInsert, TaxObligationRow } from '@/types/database'

export function useFinancialReports(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.accounting.reports(condominiumId ?? ''),
    queryFn: () => financialReportService.reports(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useTaxObligations(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accounting.obligations(condominiumId ?? ''),
    queryFn: () => financialReportService.obligations(condominiumId as string),
    enabled: Boolean(condominiumId) && enabled,
  })
}

/** Al publicar un reporte, quien este mirando lo ve sin recargar. */
export function useFinancialReportsRealtime(condominiumId: string | null): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!condominiumId) return
    return financialReportService.subscribe(condominiumId, () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting', 'reports'] })
      void queryClient.invalidateQueries({ queryKey: ['accounting', 'obligations'] })
    })
  }, [condominiumId, queryClient])
}

export function useFinancialReportMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounting', 'reports'] })
    void queryClient.invalidateQueries({ queryKey: ['accounting', 'obligations'] })
  }
  return {
    saveReport: useMutation({
      mutationFn: async (input: {
        id: string | null
        values: TablesInsert<'financial_reports'>
        file: File | null
      }) => {
        const values = { ...input.values }
        if (input.file) {
          values.file_path = await financialReportService.uploadFile(
            values.condominium_id,
            'reports',
            input.file,
          )
        }
        return financialReportService.saveReport(input.id, values)
      },
      onSuccess: (report) => {
        notify.success(report.status === 'PUBLISHED' ? 'Reporte publicado' : 'Borrador guardado')
        invalidate()
      },
    }),
    setReportStatus: useMutation({
      mutationFn: (input: { id: string; status: 'DRAFT' | 'PUBLISHED' }) =>
        financialReportService.setReportStatus(input.id, input.status),
      onSuccess: (_data, input) => {
        notify.success(input.status === 'PUBLISHED' ? 'Reporte publicado' : 'Reporte retirado')
        invalidate()
      },
    }),
    removeReport: useMutation({
      mutationFn: (report: Pick<FinancialReportRow, 'id' | 'file_path'>) =>
        financialReportService.removeReport(report),
      onSuccess: () => {
        notify.success('Reporte eliminado')
        invalidate()
      },
    }),
    saveObligation: useMutation({
      mutationFn: async (input: {
        id: string | null
        values: TablesInsert<'tax_obligations'>
        file: File | null
      }) => {
        const values = { ...input.values }
        if (input.file) {
          values.file_path = await financialReportService.uploadFile(
            values.condominium_id,
            'fiscal',
            input.file,
          )
        }
        await financialReportService.saveObligation(input.id, values)
      },
      onSuccess: () => {
        notify.success('Obligacion guardada')
        invalidate()
      },
    }),
    setObligationStatus: useMutation({
      mutationFn: (input: { id: string; status: TaxObligationRow['status'] }) =>
        financialReportService.setObligationStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
    removeObligation: useMutation({
      mutationFn: (row: Pick<TaxObligationRow, 'id' | 'file_path'>) =>
        financialReportService.removeObligation(row),
      onSuccess: () => {
        notify.success('Obligacion eliminada')
        invalidate()
      },
    }),
    openFile: useMutation({
      mutationFn: (path: string) => financialReportService.openFile(path),
      onSuccess: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    }),
  }
}

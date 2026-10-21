import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useBudgetLines, useFinancialStatements, usePortfolio } from '@/hooks/useAccounting'
import {
  useFinancialReportMutations,
  useFinancialReports,
  useFinancialReportsRealtime,
} from '@/hooks/useFinancialReports'
import { getErrorMessage } from '@/lib/errors'
import { financialReportSchema, type FinancialReportFormValues } from '@/schemas/financialReports'
import type { FinancialReportCategory, FinancialReportRow } from '@/types/database'
import {
  budgetView,
  budgetYears,
  financialLines,
  financialPeriods,
  portfolioView,
} from './finances.logic'
import {
  CATEGORIES,
  REPORT_TYPES,
  categoryCounts,
  defaultCategory,
  groupReports,
  toReportView,
} from './reports.logic'

const EMPTY: FinancialReportFormValues = {
  title: '',
  category: 'FINANCIAL_STATEMENTS',
  report_type: 'BALANCE',
  period: '',
  year: null,
  summary: '',
  publish: false,
}

/**
 * Reportes financieros. Los propietarios ven los publicados, agrupados por
 * categoria, y al abrir uno ven su contenido. El contador y la administracion
 * los configuran (tipo, periodo, notas, PDF) y deciden cuando publicarlos.
 */
export function useReportsViewModel(canManage: boolean) {
  const { currentCondominiumId } = useAuth()
  useFinancialReportsRealtime(currentCondominiumId)
  const reportsQuery = useFinancialReports(currentCondominiumId)
  const financialQuery = useFinancialStatements(currentCondominiumId, true)
  const budgetQuery = useBudgetLines(currentCondominiumId, true)
  const portfolioQuery = usePortfolio(currentCondominiumId, true)
  const mutations = useFinancialReportMutations()

  const rows = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data])
  const reports = useMemo(() => rows.map(toReportView), [rows])
  const [category, setCategory] = useState<FinancialReportCategory | 'ALL'>('ALL')
  const groups = useMemo(() => groupReports(reports, category), [reports, category])

  // ----------------------------------------------------------- visor
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewing = reports.find((report) => report.id === viewingId) ?? null
  const content = useMemo(() => {
    if (!viewing) return null
    if (viewing.type === 'BALANCE' || viewing.type === 'RESULTS') {
      return {
        kind: 'statement' as const,
        ...financialLines(financialQuery.data ?? [], viewing.period, viewing.type),
      }
    }
    if (viewing.type === 'BUDGET')
      return { kind: 'budget' as const, budget: budgetView(budgetQuery.data ?? [], viewing.year) }
    if (viewing.type === 'PORTFOLIO')
      return { kind: 'portfolio' as const, portfolio: portfolioView(portfolioQuery.data ?? []) }
    return { kind: 'document' as const }
  }, [viewing, financialQuery.data, budgetQuery.data, portfolioQuery.data])

  // ----------------------------------------------------------- editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialReportRow | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const form = useForm<FinancialReportFormValues>({
    resolver: zodResolver(financialReportSchema),
    defaultValues: EMPTY,
  })
  const reportType = useWatch({ control: form.control, name: 'report_type' })
  const yearValue = useWatch({ control: form.control, name: 'year' })

  const openNew = () => {
    form.reset(EMPTY)
    setEditing(null)
    setFile(null)
    setFileError(null)
    mutations.saveReport.reset()
    setEditorOpen(true)
  }

  const openEdit = (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    form.reset({
      title: row.title,
      category: row.category,
      report_type: row.report_type,
      period: row.period ?? '',
      year: row.year,
      summary: row.summary ?? '',
      publish: row.status === 'PUBLISHED',
    })
    setEditing(row)
    setFile(null)
    setFileError(null)
    mutations.saveReport.reset()
    setEditorOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    if (values.report_type === 'DOCUMENT' && !file && !editing?.file_path) {
      setFileError('Sube el PDF del informe')
      return
    }
    mutations.saveReport.mutate(
      {
        id: editing?.id ?? null,
        file,
        values: {
          condominium_id: currentCondominiumId,
          title: values.title,
          category: values.category,
          report_type: values.report_type,
          period: ['BALANCE', 'RESULTS'].includes(values.report_type) ? values.period : null,
          year: values.report_type === 'BUDGET' ? values.year : null,
          summary: values.summary || null,
          status: values.publish ? 'PUBLISHED' : 'DRAFT',
        },
      },
      { onSuccess: () => setEditorOpen(false) },
    )
  })

  const periods = financialPeriods(financialQuery.data ?? [])
  const years = budgetYears(budgetQuery.data ?? [])

  return {
    canManage,
    status: reportsQuery.isLoading
      ? 'loading'
      : reportsQuery.isError
        ? 'error'
        : reports.length
          ? 'ready'
          : 'empty',
    retry: () => void reportsQuery.refetch(),
    groups,
    category,
    setCategory,
    categoryOptions: [
      { value: 'ALL', label: `Todos (${reports.length})` },
      ...categoryCounts(reports).map((item) => ({
        value: item.value,
        label: `${item.label} (${item.count})`,
      })),
    ],
    drafts: reports.filter((report) => report.isDraft).length,

    // visor
    viewing,
    content,
    openReport: (id: string) => setViewingId(id),
    closeReport: () => setViewingId(null),
    openFile: (path: string) => mutations.openFile.mutate(path),
    openingFile: mutations.openFile.isPending,

    // acciones del contador
    publish: (id: string) => mutations.setReportStatus.mutate({ id, status: 'PUBLISHED' }),
    unpublish: (id: string) => mutations.setReportStatus.mutate({ id, status: 'DRAFT' }),
    remove: (id: string) => {
      const row = rows.find((item) => item.id === id)
      if (row) mutations.removeReport.mutate({ id: row.id, file_path: row.file_path })
    },

    // editor
    editorOpen,
    isEditing: Boolean(editing),
    openNew,
    openEdit,
    closeEditor: () => setEditorOpen(false),
    control: form.control,
    reportType,
    typeHint: REPORT_TYPES.find((t) => t.value === reportType)?.hint ?? '',
    onTypeChange: (value: string | string[] | null) => {
      if (typeof value === 'string' && !editing) {
        form.setValue(
          'category',
          defaultCategory(value as FinancialReportFormValues['report_type']),
        )
      }
    },
    typeOptions: REPORT_TYPES.map((t) => ({ value: t.value, label: t.label })),
    categoryFormOptions: CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    periodOptions: periods,
    yearOptions: years.map((year) => ({ value: String(year), label: String(year) })),
    noDataHint:
      (reportType === 'BALANCE' || reportType === 'RESULTS') && periods.length === 0
        ? 'Aun no hay estados financieros cargados: subelos en "Carga contable".'
        : reportType === 'BUDGET' && years.length === 0
          ? 'Aun no hay presupuesto cargado: subelo en "Carga contable".'
          : null,
    setYear: (value: string) =>
      form.setValue('year', value ? Number(value) : null, { shouldValidate: true }),
    yearValue,
    file,
    existingFile: editing?.file_path ?? null,
    setFile: (next: File | null) => {
      setFile(next)
      setFileError(null)
    },
    fileError,
    submit,
    submitting: mutations.saveReport.isPending,
    submitError: mutations.saveReport.error ? getErrorMessage(mutations.saveReport.error) : null,
  }
}

export type ReportsViewModel = ReturnType<typeof useReportsViewModel>

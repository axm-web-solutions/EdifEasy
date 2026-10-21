import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useFinancialReportMutations, useTaxObligations } from '@/hooks/useFinancialReports'
import { getErrorMessage } from '@/lib/errors'
import { taxObligationSchema, type TaxObligationFormValues } from '@/schemas/financialReports'
import type { TaxObligationRow } from '@/types/database'
import { AUTHORITIES, TAX_PRESETS, obligationsSummary, toObligationView } from './reports.logic'

const EMPTY: TaxObligationFormValues = {
  name: '',
  authority: 'DIAN',
  period_label: '',
  due_date: '',
  status: 'PENDING',
  amount: null,
  reference: '',
  notes: '',
}

export type ObligationFilter = 'pending' | 'done' | 'all'

/**
 * Obligaciones fiscales del conjunto: el contador las registra con su
 * vencimiento y soporte; la administracion y el vocero las consultan.
 */
export function useTaxObligationsViewModel(canManage: boolean) {
  const { currentCondominiumId } = useAuth()
  const query = useTaxObligations(currentCondominiumId, true)
  const mutations = useFinancialReportMutations()

  const rows = useMemo(() => query.data ?? [], [query.data])
  const views = useMemo(() => rows.map((row) => toObligationView(row)), [rows])
  const [filter, setFilter] = useState<ObligationFilter>('pending')
  const visible = useMemo(
    () =>
      filter === 'all'
        ? views
        : filter === 'pending'
          ? views.filter((view) => view.isPending)
          : [...views.filter((view) => !view.isPending)].reverse(),
    [views, filter],
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaxObligationRow | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const form = useForm<TaxObligationFormValues>({
    resolver: zodResolver(taxObligationSchema),
    defaultValues: EMPTY,
  })

  const openNew = (presetName?: string) => {
    const preset = TAX_PRESETS.find((item) => item.name === presetName)
    form.reset({ ...EMPTY, name: preset?.name ?? '', authority: preset?.authority ?? 'DIAN' })
    setEditing(null)
    setFile(null)
    mutations.saveObligation.reset()
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    form.reset({
      name: row.name,
      authority: row.authority,
      period_label: row.period_label ?? '',
      due_date: row.due_date,
      status: row.status,
      amount: row.amount === null ? null : Number(row.amount),
      reference: row.reference ?? '',
      notes: row.notes ?? '',
    })
    setEditing(row)
    setFile(null)
    mutations.saveObligation.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    mutations.saveObligation.mutate(
      {
        id: editing?.id ?? null,
        file,
        values: {
          condominium_id: currentCondominiumId,
          name: values.name,
          authority: values.authority,
          period_label: values.period_label || null,
          due_date: values.due_date,
          status: values.status,
          amount: values.amount,
          reference: values.reference || null,
          notes: values.notes || null,
        },
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  return {
    canManage,
    status: query.isLoading ? 'loading' : query.isError ? 'error' : 'ready',
    retry: () => void query.refetch(),
    obligations: visible,
    summary: obligationsSummary(views),
    filter,
    setFilter,
    filterOptions: [
      { value: 'pending', label: 'Pendientes' },
      { value: 'done', label: 'Cumplidas' },
      { value: 'all', label: 'Todas' },
    ],
    presets: TAX_PRESETS.map((preset) => preset.name),

    markFiled: (id: string) => mutations.setObligationStatus.mutate({ id, status: 'FILED' }),
    markPaid: (id: string) => mutations.setObligationStatus.mutate({ id, status: 'PAID' }),
    remove: (id: string) => {
      const row = rows.find((item) => item.id === id)
      if (row) mutations.removeObligation.mutate({ id: row.id, file_path: row.file_path })
    },
    openFile: (path: string) => mutations.openFile.mutate(path),

    formOpen,
    isEditing: Boolean(editing),
    openNew,
    openEdit,
    closeForm: () => setFormOpen(false),
    control: form.control,
    authorityOptions: AUTHORITIES,
    statusOptions: [
      { value: 'PENDING', label: 'Pendiente' },
      { value: 'FILED', label: 'Presentada' },
      { value: 'PAID', label: 'Pagada' },
      { value: 'NOT_APPLICABLE', label: 'No aplica' },
    ],
    file,
    existingFile: editing?.file_path ?? null,
    setFile,
    submit,
    submitting: mutations.saveObligation.isPending,
    submitError: mutations.saveObligation.error
      ? getErrorMessage(mutations.saveObligation.error)
      : null,
  }
}

export type TaxObligationsViewModel = ReturnType<typeof useTaxObligationsViewModel>

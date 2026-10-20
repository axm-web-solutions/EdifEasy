import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllApartments } from '@/hooks/useApartments'
import { useLogbook, useLogbookMutations } from '@/hooks/useLogbook'
import { getErrorMessage } from '@/lib/errors'
import {
  GUARD_LOG_CATEGORIES,
  logbookEntrySchema,
  type LogbookEntryFormValues,
} from '@/schemas/logbook'
import type { GuardLogCategory } from '@/types/database'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  filterEntries,
  groupByDay,
  periodStart,
  summarize,
  toEntryView,
  type LogbookFilters,
  type LogbookPeriod,
} from './logbook.logic'

/** Textos sugeridos para las anotaciones rapidas (se pueden editar). */
const QUICK_TEXT: Partial<Record<GuardLogCategory, string>> = {
  TURNO_INICIO: 'Recibo el turno sin novedad.',
  TURNO_FIN: 'Entrego el turno sin novedad.',
  RONDA: 'Ronda perimetral sin novedad.',
}

const QUICK_ACTIONS: GuardLogCategory[] = [
  'TURNO_INICIO',
  'RONDA',
  'VISITANTE',
  'PAQUETE',
  'NOVEDAD',
  'TURNO_FIN',
]

const EMPTY: LogbookEntryFormValues = {
  category: 'NOVEDAD',
  priority: 'NORMAL',
  description: '',
  apartment_id: null,
}

/**
 * Minuta digital de porteria: el personal de seguridad anota todo lo que pasa
 * en el turno; la administracion y el vocero la consultan. No se edita ni borra.
 */
export function useLogbookViewModel() {
  const { currentCondominiumId, hasRole } = useAuth()
  const canWrite = hasRole(['SECURITY', 'ADMINISTRATOR', 'SUPER_ADMIN'])

  const [period, setPeriod] = useState<LogbookPeriod>('today')
  const [filters, setFilters] = useState<LogbookFilters>({
    category: 'ALL',
    onlyImportant: false,
    search: '',
  })
  // El inicio del periodo se fija al cambiarlo (no en cada render) para no
  // invalidar la clave de la consulta.
  const from = useMemo(() => periodStart(period), [period])

  const query = useLogbook(currentCondominiumId, from)
  const apartmentsQuery = useAllApartments(canWrite ? currentCondominiumId : null)
  const { create } = useLogbookMutations()

  const entries = useMemo(() => (query.data ?? []).map(toEntryView), [query.data])
  const visible = useMemo(() => filterEntries(entries, filters), [entries, filters])
  const groups = useMemo(() => groupByDay(visible), [visible])
  const summary = useMemo(() => summarize(entries), [entries])

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const form = useForm<LogbookEntryFormValues>({
    resolver: zodResolver(logbookEntrySchema),
    defaultValues: EMPTY,
  })

  const openForm = (category: GuardLogCategory = 'NOVEDAD') => {
    form.reset({ ...EMPTY, category, description: QUICK_TEXT[category] ?? '' })
    create.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    create.mutate(
      {
        condominium_id: currentCondominiumId,
        category: values.category,
        priority: values.priority,
        description: values.description,
        apartment_id: values.apartment_id,
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  let status: 'loading' | 'error' | 'empty' | 'ready'
  if (query.isLoading) status = 'loading'
  else if (query.isError) status = 'error'
  else if (visible.length === 0) status = 'empty'
  else status = 'ready'

  const filtered =
    filters.category !== 'ALL' || filters.onlyImportant || filters.search.trim().length > 0

  return {
    canWrite,
    status,
    retry: () => void query.refetch(),
    groups,
    filtered,
    summary: {
      ...summary,
      shiftLabel: summary.shiftOpen
        ? `Turno abierto${summary.shiftOwner ? ` por ${summary.shiftOwner}` : ''}`
        : 'Sin turno abierto',
    },

    period,
    setPeriod,
    periodOptions: [
      { value: 'today', label: 'Hoy' },
      { value: '3d', label: '3 dias' },
      { value: '7d', label: '7 dias' },
      { value: '30d', label: '30 dias' },
    ],
    filters,
    setCategory: (category: GuardLogCategory | 'ALL') =>
      setFilters((current) => ({ ...current, category })),
    setOnlyImportant: (onlyImportant: boolean) =>
      setFilters((current) => ({ ...current, onlyImportant })),
    setSearch: (search: string) => setFilters((current) => ({ ...current, search })),
    clearFilters: () => setFilters({ category: 'ALL', onlyImportant: false, search: '' }),
    categoryFilterOptions: [
      { value: 'ALL', label: 'Todos los tipos' },
      ...GUARD_LOG_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
    ],

    quickActions: QUICK_ACTIONS.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
    })),

    // formulario
    formOpen,
    openForm,
    closeForm: () => setFormOpen(false),
    control: form.control,
    categoryOptions: GUARD_LOG_CATEGORIES.map((value) => ({
      value,
      label: CATEGORY_LABELS[value],
    })),
    priorityOptions: (['NORMAL', 'IMPORTANTE', 'URGENTE'] as const).map((value) => ({
      value,
      label: PRIORITY_LABELS[value],
    })),
    apartmentOptions: (apartmentsQuery.data ?? []).map((apartment) => ({
      value: apartment.id,
      label: `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`,
    })),
    submit,
    submitting: create.isPending,
    submitError: create.error ? getErrorMessage(create.error) : null,
  }
}

export type LogbookViewModel = ReturnType<typeof useLogbookViewModel>

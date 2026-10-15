import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useAuth } from '@/hooks/useAuth'
import { useTableParams } from '@/hooks/useTableParams'
import { useFormDrawerState } from '@/hooks/useFormDrawerState'
import { useExportFetcher } from '@/hooks/useExportFetcher'
import { useFineMutations, useFines, useFinesSummary } from '@/hooks/useFines'
import { useCheckout } from '@/hooks/usePayments'
import { useAllApartments } from '@/hooks/useApartments'
import { useResidentsByApartment } from '@/hooks/useResidents'
import { fineSchema, type FineFormValues } from '@/schemas/operations'
import { fineService } from '@/services/fineService'
import { FINE_STATUS, toOptions } from '@/constants/enums'
import { apartmentLabel } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { FineRow } from '@/types/database'
import type { FineWithRelations } from '@/types/models'
import { emptyFineForm, isPayable, paidHint, toFineForm, toFinePayload } from './fines.logic'

/**
 * ViewModel de Multas. La administracion crea, edita y elimina; los residentes
 * ven las multas de su apartamento y pagan en linea las pendientes.
 */
export function useFinesViewModel() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageFines')

  // ----------------------------------------------------------------- tabla
  const table = useTableParams({ pageSize: 10 })
  const query = useFines(currentCondominiumId, table.params)
  const summary = useFinesSummary(currentCondominiumId, table.params)
  const apartmentsQuery = useAllApartments(currentCondominiumId)
  const exportFetcher = useExportFetcher(fineService.list, currentCondominiumId, table.params)

  const apartmentOptions = (apartmentsQuery.data ?? []).map((apartment) => ({
    value: apartment.id,
    label: apartmentLabel(apartment),
  }))

  // ------------------------------------------------------------ formulario
  const drawer = useFormDrawerState<FineRow>()
  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: emptyFineForm(),
  })
  const selectedApartment = useWatch({ control: form.control, name: 'apartment_id' })
  const residentsQuery = useResidentsByApartment(selectedApartment || null)
  const { create, update, remove } = useFineMutations()

  const { open: drawerOpen, editing } = drawer
  useEffect(() => {
    if (drawerOpen) form.reset(editing ? toFineForm(editing) : emptyFineForm())
  }, [drawerOpen, editing, form])

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    const payload = toFinePayload(
      values,
      currentCondominiumId,
      editing?.created_by ?? user?.id ?? null,
    )
    if (editing) await update.mutateAsync({ id: editing.id, values: payload })
    else await create.mutateAsync(payload)
    drawer.close()
  })

  // ---------------------------------------------------------------- pagos
  const { payFine } = useCheckout()

  return {
    permissions: { canManage, canPay: !canManage },

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
      filters: [
        { key: 'status', label: 'Estado', options: toOptions(FINE_STATUS) },
        { key: 'apartment_id', label: 'Apartamento', width: 190, options: apartmentOptions },
      ],
      exportFetcher,
    },

    /** Totales de TODAS las multas que cumplen los filtros (no solo la pagina). */
    stats: {
      loading: summary.isLoading,
      pendingAmount: summary.data?.pending_amount ?? 0,
      pendingCount: summary.data?.pending_count ?? 0,
      paidAmount: summary.data?.paid_amount ?? 0,
      paidCount: summary.data?.paid_count ?? 0,
    },

    form: {
      open: drawer.open,
      title: drawer.isEditing ? 'Editar multa' : 'Nueva multa',
      control: form.control,
      submit: () => void submit(),
      submitting: create.isPending || update.isPending,
      apartmentOptions,
      apartmentsLoading: apartmentsQuery.isLoading,
      residentOptions: (residentsQuery.data ?? []).map((resident) => ({
        value: resident.id,
        label: resident.full_name,
      })),
      residentsLoading: residentsQuery.isLoading,
      residentDisabled: !selectedApartment,
      statusOptions: toOptions(FINE_STATUS),
    },

    row: {
      isPayable: (fine: FineWithRelations) => isPayable(fine),
      paidHint: (fine: FineWithRelations) => paidHint(fine),
      isPaying: (fine: FineWithRelations) => payFine.isPending && payFine.variables === fine.id,
    },

    actions: {
      openCreate: drawer.openCreate,
      openEdit: (fine: FineRow) => drawer.openEdit(fine),
      close: drawer.close,
      remove: async (fine: FineRow) => {
        const ok = await confirmDelete({ title: `Eliminar la multa "${fine.reason}"?` })
        if (ok) await remove.mutateAsync(fine.id)
      },
      pay: (fine: FineWithRelations) => payFine.mutate(fine.id),
      paying: payFine.isPending,
    },
  }
}

export type FinesViewModel = ReturnType<typeof useFinesViewModel>

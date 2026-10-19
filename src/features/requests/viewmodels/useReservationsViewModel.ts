import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllApartments } from '@/hooks/useApartments'
import {
  useBusySlots,
  useCommonAreas,
  useReservationList,
  useReservationMutations,
} from '@/hooks/useReservations'
import { useCheckout } from '@/hooks/usePayments'
import { reservationSchema, type ReservationFormValues } from '@/schemas/reservations'
import { getErrorMessage } from '@/lib/errors'
import {
  areaFlowNote,
  busyLabels,
  dayRange,
  filterReservations,
  hoursLabel,
  timeOptions,
  toInstant,
  toReservationView,
  validateSlot,
  type ReservationFilter,
} from './reservations.logic'

const EMPTY: ReservationFormValues = {
  common_area_id: '',
  apartment_id: '',
  day: '',
  start: '',
  end: '',
  guests: null,
  notes: '',
}

/** Desde cuando se listan reservas: los ultimos 60 dias y todo lo futuro. */
const HISTORY_FROM = new Date(Date.now() - 60 * 86_400_000).toISOString()

/**
 * Reservas de zonas comunes (pestana "Reservas" de Solicitudes). Residentes
 * reservan para su apartamento y pagan en linea; la administracion aprueba,
 * registra pagos en efectivo y cancela.
 */
export function useReservationsViewModel() {
  const { currentCondominiumId, hasRole, apartmentIds } = useAuth()
  const isAdmin = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])

  const areasQuery = useCommonAreas(currentCondominiumId)
  const listQuery = useReservationList(currentCondominiumId, HISTORY_FROM)
  const apartmentsQuery = useAllApartments(currentCondominiumId)
  const mutations = useReservationMutations()
  const { payReservation } = useCheckout()

  const [filter, setFilter] = useState<ReservationFilter>(isAdmin ? 'pending' : 'upcoming')
  const [formOpen, setFormOpen] = useState(false)

  const activeAreas = useMemo(
    () => (areasQuery.data ?? []).filter((area) => area.is_active),
    [areasQuery.data],
  )

  const views = useMemo(
    () => (listQuery.data ?? []).map((row) => toReservationView(row, { isAdmin, apartmentIds })),
    [listQuery.data, isAdmin, apartmentIds],
  )
  const visible = useMemo(() => filterReservations(views, filter), [views, filter])
  const pendingCount = useMemo(() => filterReservations(views, 'pending').length, [views])

  // ------------------------------------------------------------ formulario
  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: EMPTY,
  })
  const [areaId, day, start, end, guests] = useWatch({
    control: form.control,
    name: ['common_area_id', 'day', 'start', 'end', 'guests'],
  })
  const area = activeAreas.find((item) => item.id === areaId) ?? null
  const range = day ? dayRange(day) : null
  const busyQuery = useBusySlots(area?.id ?? null, day || null, range)
  const busy = busyQuery.data ?? []
  const slotError = area ? validateSlot(area, { day, start, end, guests }, busy) : null

  const apartmentOptions = useMemo(
    () =>
      (apartmentsQuery.data ?? [])
        .filter((apartment) => isAdmin || apartmentIds.includes(apartment.id))
        .map((apartment) => ({
          value: apartment.id,
          label: `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`,
        })),
    [apartmentsQuery.data, isAdmin, apartmentIds],
  )

  const openForm = () => {
    form.reset({
      ...EMPTY,
      common_area_id: activeAreas.length === 1 ? activeAreas[0].id : '',
      apartment_id: apartmentOptions.length === 1 ? apartmentOptions[0].value : '',
    })
    mutations.create.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId || slotError) return
    mutations.create.mutate(
      {
        condominium_id: currentCondominiumId,
        common_area_id: values.common_area_id,
        apartment_id: values.apartment_id,
        starts_at: toInstant(values.day, values.start),
        ends_at: toInstant(values.day, values.end),
        guests: values.guests,
        notes: values.notes || null,
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  let status: 'loading' | 'error' | 'no-areas' | 'empty' | 'ready'
  if (listQuery.isLoading || areasQuery.isLoading) status = 'loading'
  else if (listQuery.isError) status = 'error'
  else if (activeAreas.length === 0 && views.length === 0) status = 'no-areas'
  else if (visible.length === 0) status = 'empty'
  else status = 'ready'

  return {
    isAdmin,
    status,
    retry: () => void listQuery.refetch(),
    reservations: visible,
    filter,
    setFilter,
    filterOptions: [
      { value: 'upcoming', label: 'Proximas' },
      { value: 'pending', label: pendingCount > 0 ? `Pendientes (${pendingCount})` : 'Pendientes' },
      { value: 'history', label: 'Historial' },
    ],
    canReserve: activeAreas.length > 0 && (isAdmin || apartmentIds.length > 0),
    noApartmentHint: !isAdmin && apartmentIds.length === 0,

    // formulario
    formOpen,
    openForm,
    closeForm: () => setFormOpen(false),
    control: form.control,
    areaOptions: activeAreas.map((item) => ({ value: item.id, label: item.name })),
    apartmentOptions,
    showApartment: apartmentOptions.length !== 1,
    area: area
      ? {
          hours: hoursLabel(area),
          maxHours: area.max_hours,
          capacity: area.capacity,
          flowNote: areaFlowNote(area),
          description: area.description,
          rules: area.rules,
        }
      : null,
    timeOptions: area ? timeOptions(area) : [],
    busyLabels: busyLabels(busy),
    busyLoading: busyQuery.isLoading && Boolean(area && day),
    slotError,
    submit,
    submitting: mutations.create.isPending,
    submitError: mutations.create.error ? getErrorMessage(mutations.create.error) : null,

    // acciones
    approve: (id: string, notes: string | null) =>
      mutations.review.mutate({ id, approve: true, notes }),
    reject: (id: string, notes: string | null) =>
      mutations.review.mutate({ id, approve: false, notes }),
    registerPayment: (id: string) => mutations.registerPayment.mutate(id),
    cancel: (id: string, reason: string | null) => mutations.cancel.mutate({ id, reason }),
    payOnline: (id: string) => payReservation.mutate(id),
    paying: payReservation.isPending ? payReservation.variables : null,
  }
}

export type ReservationsViewModel = ReturnType<typeof useReservationsViewModel>

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllApartments } from '@/hooks/useApartments'
import {
  useAlarmDevices,
  useAlarmEvents,
  useAlarmMutations,
  useAlarmsRealtime,
} from '@/hooks/useAlarms'
import { alarmWebhookUrl } from '@/services/alarmService'
import { getErrorMessage } from '@/lib/errors'
import { ALARM_PROVIDERS, alarmDeviceSchema, type AlarmDeviceFormValues } from '@/schemas/alarms'
import {
  PROVIDER_LABELS,
  PROVIDER_SETUP,
  filterEvents,
  setupExample,
  toDeviceView,
  toEventView,
  type EventFilter,
} from './alarms.logic'

const COMMON = 'COMMON'

const EMPTY: AlarmDeviceFormValues = {
  apartment_id: '',
  name: '',
  provider: 'GENERIC',
  location: '',
  notes: '',
  is_active: true,
}

/** Eventos de los ultimos 30 dias. */
function monthAgo() {
  return new Date(Date.now() - 30 * 86_400_000).toISOString()
}

export interface AlarmCredentials {
  deviceName: string
  url: string
  setup: string
  example: string
}

/**
 * Alarmas conectadas. La administracion conecta las de cualquier unidad y las
 * de zonas comunes; cada propietario, las de su casa o apartamento. Porteria y
 * administracion ven y atienden todos los eventos; cada residente, los suyos.
 */
export function useAlarmsViewModel() {
  const { currentCondominiumId, hasRole, role, apartmentIds } = useAuth()
  const isAdmin = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])
  const isStaff = hasRole(['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SUPER_ADMIN'])
  // La base valida la propiedad (user_owns_apartment); aqui solo se decide que mostrar.
  const ownedApartmentIds = useMemo(
    () => (role === 'OWNER' ? apartmentIds : []),
    [role, apartmentIds],
  )
  const canAdd = isAdmin || ownedApartmentIds.length > 0

  const [from] = useState(monthAgo)
  const devicesQuery = useAlarmDevices(currentCondominiumId)
  const eventsQuery = useAlarmEvents(currentCondominiumId, from)
  const apartmentsQuery = useAllApartments(canAdd ? currentCondominiumId : null)
  const mutations = useAlarmMutations()
  useAlarmsRealtime(currentCondominiumId)

  const devices = useMemo(
    () => (devicesQuery.data ?? []).map((d) => toDeviceView(d, { isAdmin, ownedApartmentIds })),
    [devicesQuery.data, isAdmin, ownedApartmentIds],
  )
  const events = useMemo(
    () => (eventsQuery.data ?? []).map((e) => toEventView(e, { isStaff, ownedApartmentIds })),
    [eventsQuery.data, isStaff, ownedApartmentIds],
  )
  const [filter, setFilter] = useState<EventFilter>('all')
  const visibleEvents = useMemo(() => filterEvents(events, filter), [events, filter])
  const attentionCount = useMemo(() => filterEvents(events, 'attention').length, [events])

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<AlarmCredentials | null>(null)
  const form = useForm<AlarmDeviceFormValues>({
    resolver: zodResolver(alarmDeviceSchema),
    defaultValues: EMPTY,
  })
  const provider = useWatch({ control: form.control, name: 'provider' })
  const unitChoice = useWatch({ control: form.control, name: 'apartment_id' })

  const unitOptions = useMemo(() => {
    const units = (apartmentsQuery.data ?? [])
      .filter((apartment) => isAdmin || ownedApartmentIds.includes(apartment.id))
      .map((apartment) => ({
        value: apartment.id,
        label: `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`,
      }))
    return isAdmin
      ? [{ value: COMMON, label: 'Zona comun (porteria, parqueadero...)' }, ...units]
      : units
  }, [apartmentsQuery.data, isAdmin, ownedApartmentIds])

  const showCredentials = (
    deviceName: string,
    token: string,
    deviceProvider: keyof typeof PROVIDER_SETUP,
  ) => {
    const url = alarmWebhookUrl(token)
    setCredentials({
      deviceName,
      url,
      setup: PROVIDER_SETUP[deviceProvider],
      example: setupExample(url),
    })
  }

  const openNew = () => {
    form.reset({ ...EMPTY, apartment_id: unitOptions.length === 1 ? unitOptions[0].value : '' })
    setEditingId(null)
    mutations.create.reset()
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const device = devicesQuery.data?.find((item) => item.id === id)
    if (!device) return
    form.reset({
      apartment_id: device.apartment_id ?? COMMON,
      name: device.name,
      provider: device.provider,
      location: device.location ?? '',
      notes: device.notes ?? '',
      is_active: device.is_active,
    })
    setEditingId(id)
    mutations.update.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const payload = {
      name: values.name,
      provider: values.provider,
      location: values.location || null,
      notes: values.notes || null,
    }
    if (editingId) {
      mutations.update.mutate(
        { deviceId: editingId, values: { ...payload, is_active: values.is_active } },
        { onSuccess: () => setFormOpen(false) },
      )
      return
    }
    mutations.create.mutate(
      {
        condominiumId: currentCondominiumId,
        apartmentId: values.apartment_id === COMMON ? null : values.apartment_id,
        values: payload,
      },
      {
        onSuccess: (result) => {
          setFormOpen(false)
          showCredentials(values.name, result.token, values.provider)
        },
      },
    )
  })

  const rotate = (id: string) => {
    const device = devicesQuery.data?.find((item) => item.id === id)
    if (!device) return
    mutations.rotate.mutate(id, {
      onSuccess: (token) => showCredentials(device.name, token, device.provider),
    })
  }

  const submitError = mutations.create.error ?? mutations.update.error

  let status: 'loading' | 'error' | 'ready'
  if (devicesQuery.isLoading || eventsQuery.isLoading) status = 'loading'
  else if (devicesQuery.isError || eventsQuery.isError) status = 'error'
  else status = 'ready'

  return {
    status,
    retry: () => {
      void devicesQuery.refetch()
      void eventsQuery.refetch()
    },
    isStaff,
    canAdd,
    devices,
    activeDevices: devices.filter((device) => device.isActive).length,
    events: visibleEvents,
    attentionCount,
    filter,
    setFilter,
    filterOptions: [
      { value: 'all', label: 'Todos' },
      {
        value: 'attention',
        label: attentionCount ? `Por atender (${attentionCount})` : 'Por atender',
      },
      { value: 'critical', label: 'Emergencias' },
      { value: 'technical', label: 'Fallas tecnicas' },
      { value: 'activity', label: 'Armado y desarmado' },
    ],

    // formulario
    formOpen,
    isEditing: Boolean(editingId),
    openNew,
    openEdit,
    closeForm: () => setFormOpen(false),
    control: form.control,
    unitOptions,
    unitIsCommon: unitChoice === COMMON,
    providerOptions: ALARM_PROVIDERS.map((value) => ({ value, label: PROVIDER_LABELS[value] })),
    providerSetup: PROVIDER_SETUP[provider],
    submit,
    submitting: mutations.create.isPending || mutations.update.isPending,
    submitError: submitError ? getErrorMessage(submitError) : null,

    // URL secreta (se muestra una sola vez)
    credentials,
    closeCredentials: () => setCredentials(null),

    // acciones
    test: (id: string) => mutations.test.mutate(id),
    rotate,
    remove: (id: string) => mutations.remove.mutate(id),
    toggleActive: (id: string) => {
      const device = devicesQuery.data?.find((item) => item.id === id)
      if (!device) return
      mutations.update.mutate({
        deviceId: id,
        values: {
          name: device.name,
          provider: device.provider,
          location: device.location,
          notes: device.notes,
          is_active: !device.is_active,
        },
      })
    },
    acknowledge: (eventId: string, note: string | null) =>
      mutations.acknowledge.mutate({ eventId, note }),
    busyDevice:
      (mutations.test.isPending && mutations.test.variables) ||
      (mutations.rotate.isPending && mutations.rotate.variables) ||
      null,
  }
}

export type AlarmsViewModel = ReturnType<typeof useAlarmsViewModel>

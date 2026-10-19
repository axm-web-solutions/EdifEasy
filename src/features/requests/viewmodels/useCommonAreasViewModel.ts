import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useCommonAreaMutations, useCommonAreas } from '@/hooks/useReservations'
import { commonAreaSchema, type CommonAreaFormValues } from '@/schemas/reservations'
import type { CommonAreaRow } from '@/types/database'
import { formatCurrency } from '@/utils/format'
import { hoursLabel } from './reservations.logic'

const EMPTY: CommonAreaFormValues = {
  name: '',
  description: '',
  rules: '',
  price: 0,
  capacity: null,
  open_time: '08:00',
  close_time: '22:00',
  max_hours: 4,
  requires_approval: true,
  is_active: true,
}

/** Configuracion de zonas comunes (solo administracion). */
export function useCommonAreasViewModel() {
  const { currentCondominiumId, hasRole } = useAuth()
  const canManage = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])
  const areasQuery = useCommonAreas(canManage ? currentCondominiumId : null)
  const mutations = useCommonAreaMutations()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommonAreaRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const form = useForm<CommonAreaFormValues>({
    resolver: zodResolver(commonAreaSchema),
    defaultValues: EMPTY,
  })

  const areas = useMemo(
    () =>
      (areasQuery.data ?? []).map((area) => ({
        row: area,
        id: area.id,
        name: area.name,
        detail: [
          Number(area.price) > 0 ? formatCurrency(Number(area.price)) : 'Sin costo',
          hoursLabel(area),
          `max. ${area.max_hours} h`,
          area.capacity ? `${area.capacity} personas` : null,
          area.requires_approval ? 'Requiere aprobacion' : 'Confirmacion inmediata',
        ]
          .filter(Boolean)
          .join(' · '),
        active: area.is_active,
      })),
    [areasQuery.data],
  )

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const payload = {
      name: values.name,
      description: values.description || null,
      rules: values.rules || null,
      price: values.price,
      capacity: values.capacity || null,
      open_time: values.open_time,
      close_time: values.close_time,
      max_hours: values.max_hours,
      requires_approval: values.requires_approval,
      is_active: values.is_active,
    }
    if (editing)
      mutations.update.mutate({ id: editing.id, values: payload }, { onSuccess: closeForm })
    else
      mutations.create.mutate(
        { ...payload, condominium_id: currentCondominiumId },
        { onSuccess: closeForm },
      )
  })

  return {
    canManage,
    open,
    show: () => setOpen(true),
    hide: () => {
      setOpen(false)
      closeForm()
    },
    loading: areasQuery.isLoading,
    areas,
    formOpen,
    formTitle: editing ? `Editar ${editing.name}` : 'Nueva zona comun',
    editingId: editing?.id ?? null,
    control: form.control,
    openNew: () => {
      setEditing(null)
      form.reset(EMPTY)
      setFormOpen(true)
    },
    openEdit: (area: CommonAreaRow) => {
      setEditing(area)
      form.reset({
        name: area.name,
        description: area.description ?? '',
        rules: area.rules ?? '',
        price: Number(area.price),
        capacity: area.capacity,
        open_time: area.open_time.slice(0, 5),
        close_time: area.close_time.slice(0, 5),
        max_hours: area.max_hours,
        requires_approval: area.requires_approval,
        is_active: area.is_active,
      })
      setFormOpen(true)
    },
    closeForm,
    submit,
    submitting: mutations.create.isPending || mutations.update.isPending,
    removeEditing: () => {
      if (editing) mutations.remove.mutate(editing.id, { onSuccess: closeForm })
    },
  }
}

export type CommonAreasViewModel = ReturnType<typeof useCommonAreasViewModel>

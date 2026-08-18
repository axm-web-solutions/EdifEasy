import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { alertSchema, type AlertFormValues } from '@/schemas/communication'
import { ALERT_STATUS, ALERT_TYPE, AUDIENCE_TYPE, PRIORITY_LEVEL, toOptions } from '@/constants/enums'
import { useAllBuildings } from '@/hooks/useBuildings'
import { useAllApartments } from '@/hooks/useApartments'
import { useRoles } from '@/hooks/useMembers'
import type { AlertRow, TablesInsert } from '@/types/database'

const EMPTY: AlertFormValues = {
  title: '',
  description: '',
  type: 'OTHER',
  priority: 'MEDIUM',
  status: 'ACTIVE',
  audience: 'CONDOMINIUM',
  building_id: null,
  apartment_id: null,
  audience_role_id: null,
  start_at: dayjs().toISOString(),
  end_at: null,
}

export function AlertForm({
  open,
  alert,
  condominiumId,
  createdBy,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  alert: AlertRow | null
  condominiumId: string
  createdBy: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'alerts'>) => void
}) {
  const buildingsQuery = useAllBuildings(condominiumId)
  const apartmentsQuery = useAllApartments(condominiumId)
  const rolesQuery = useRoles()

  const { control, handleSubmit, reset } = useForm<AlertFormValues>({
    resolver: zodResolver(alertSchema),
    defaultValues: EMPTY,
  })

  const audience = useWatch({ control, name: 'audience' })

  useEffect(() => {
    if (!open) return
    reset(
      alert
        ? {
            title: alert.title,
            description: alert.description,
            type: alert.type,
            priority: alert.priority,
            status: alert.status,
            audience: alert.audience,
            building_id: alert.building_id,
            apartment_id: alert.apartment_id,
            audience_role_id: alert.audience_role_id,
            start_at: alert.start_at,
            end_at: alert.end_at,
          }
        : EMPTY,
    )
  }, [open, alert, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      condominium_id: condominiumId,
      title: values.title,
      description: values.description,
      type: values.type,
      priority: values.priority,
      status: values.status,
      audience: values.audience,
      building_id: values.audience === 'BUILDING' ? (values.building_id || null) : null,
      apartment_id: values.audience === 'APARTMENT' ? (values.apartment_id || null) : null,
      audience_role_id: values.audience === 'ROLE' ? (values.audience_role_id || null) : null,
      start_at: values.start_at,
      end_at: values.end_at || null,
      created_by: createdBy,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={alert ? 'Editar alerta' : 'Nueva alerta'}
      description="Las alertas se envian en tiempo real a los destinatarios seleccionados."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      width={560}
      submitLabel={alert ? 'Guardar cambios' : 'Publicar alerta'}
    >
      <form onSubmit={submit} noValidate>
        <TextField control={control} name="title" label="Titulo" required maxLength={150} />
        <TextAreaField
          control={control}
          name="description"
          label="Descripcion"
          required
          rows={4}
          maxLength={2000}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField control={control} name="type" label="Tipo" options={toOptions(ALERT_TYPE)} required />
          <SelectField
            control={control}
            name="priority"
            label="Prioridad"
            options={toOptions(PRIORITY_LEVEL)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name="audience"
            label="Destinatarios"
            options={toOptions(AUDIENCE_TYPE)}
            required
          />
          <SelectField
            control={control}
            name="status"
            label="Estado"
            options={toOptions(ALERT_STATUS)}
            required
          />
        </div>

        {audience === 'BUILDING' ? (
          <SelectField
            control={control}
            name="building_id"
            label="Bloque destinatario"
            required
            loading={buildingsQuery.isLoading}
            options={(buildingsQuery.data ?? []).map((building) => ({
              value: building.id,
              label: building.name,
            }))}
          />
        ) : null}

        {audience === 'APARTMENT' ? (
          <SelectField
            control={control}
            name="apartment_id"
            label="Apartamento destinatario"
            required
            loading={apartmentsQuery.isLoading}
            options={(apartmentsQuery.data ?? []).map((apartment) => ({
              value: apartment.id,
              label: `${apartment.building?.name ?? ''} · Apto ${apartment.number}`,
            }))}
          />
        ) : null}

        {audience === 'ROLE' ? (
          <SelectField
            control={control}
            name="audience_role_id"
            label="Rol destinatario"
            required
            loading={rolesQuery.isLoading}
            options={(rolesQuery.data ?? [])
              .filter((role) => role.code !== 'SUPER_ADMIN')
              .map((role) => ({ value: role.id, label: role.name }))}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <DateField control={control} name="start_at" label="Inicio" showTime required />
          <DateField control={control} name="end_at" label="Fin (opcional)" showTime />
        </div>
      </form>
    </FormDrawer>
  )
}

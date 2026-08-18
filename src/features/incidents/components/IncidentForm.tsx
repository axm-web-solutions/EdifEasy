import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import {
  AttachmentsField,
  parseAttachments,
  useAttachmentUploader,
} from '@/components/forms/AttachmentsField'
import { incidentSchema, type IncidentFormValues } from '@/schemas/operations'
import { INCIDENT_STATUS, INCIDENT_TYPE, PRIORITY_LEVEL, toOptions } from '@/constants/enums'
import { useAllApartments } from '@/hooks/useApartments'
import { useAllMembers } from '@/hooks/useMembers'
import type { IncidentRow, TablesInsert } from '@/types/database'

const EMPTY: IncidentFormValues = {
  title: '',
  description: '',
  type: 'OTHER',
  priority: 'MEDIUM',
  status: 'OPEN',
  location: '',
  occurred_at: dayjs().toISOString(),
  apartment_id: null,
  building_id: null,
  assigned_to: null,
  resolution: '',
}

export function IncidentForm({
  open,
  incident,
  condominiumId,
  reportedBy,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  incident: IncidentRow | null
  condominiumId: string
  reportedBy: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'incidents'>) => void
}) {
  const apartmentsQuery = useAllApartments(condominiumId)
  const membersQuery = useAllMembers(condominiumId)
  const uploader = useAttachmentUploader(condominiumId, 'incident-evidence', 'incidents')

  const { control, handleSubmit, reset } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    uploader.reset(parseAttachments(incident?.evidence))
    reset(
      incident
        ? {
            title: incident.title,
            description: incident.description,
            type: incident.type,
            priority: incident.priority,
            status: incident.status,
            location: incident.location ?? '',
            occurred_at: incident.occurred_at,
            apartment_id: incident.apartment_id,
            building_id: incident.building_id,
            assigned_to: incident.assigned_to,
            resolution: incident.resolution ?? '',
          }
        : EMPTY,
    )
    // `uploader.reset` es estable; solo debe correr al abrir el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, incident, reset])

  const submit = handleSubmit(async (values) => {
    const apartment = (apartmentsQuery.data ?? []).find((item) => item.id === values.apartment_id)
    const evidence = await uploader.commit()

    onSubmit({
      evidence,
      condominium_id: condominiumId,
      title: values.title,
      description: values.description,
      type: values.type,
      priority: values.priority,
      status: values.status,
      location: values.location || null,
      occurred_at: values.occurred_at,
      apartment_id: values.apartment_id || null,
      building_id: apartment?.building_id ?? null,
      assigned_to: values.assigned_to || null,
      resolution: values.resolution || null,
      reported_by: incident?.reported_by ?? reportedBy,
    })
  })

  const assignable = (membersQuery.data ?? [])
    .filter((member) => ['ADMINISTRATOR', 'SECURITY', 'SERVICE_STAFF'].includes(member.role?.code ?? ''))
    .map((member) => ({
      value: member.profile?.id ?? '',
      label: `${member.profile?.full_name ?? ''} · ${member.role?.name ?? ''}`,
    }))

  return (
    <FormDrawer
      open={open}
      title={incident ? `Editar incidente ${incident.code ?? ''}` : 'Registrar incidente'}
      description="Eventos de seguridad y convivencia dentro del condominio."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting || uploader.uploading}
      width={560}
    >
      <form onSubmit={submit} noValidate>
        <TextField control={control} name="title" label="Titulo" required maxLength={150} />
        <TextAreaField
          control={control}
          name="description"
          label="Descripcion"
          required
          rows={5}
          maxLength={4000}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name="type"
            label="Tipo"
            options={toOptions(INCIDENT_TYPE)}
            required
          />
          <SelectField
            control={control}
            name="priority"
            label="Prioridad"
            options={toOptions(PRIORITY_LEVEL)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="location" label="Ubicacion" placeholder="Sotano, terraza..." />
          <DateField control={control} name="occurred_at" label="Fecha del incidente" showTime required />
        </div>

        <SelectField
          control={control}
          name="apartment_id"
          label="Apartamento relacionado"
          allowClear
          loading={apartmentsQuery.isLoading}
          options={(apartmentsQuery.data ?? []).map((apartment) => ({
            value: apartment.id,
            label: `${apartment.building?.name ?? ''} · Apto ${apartment.number}`,
          }))}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name="status"
            label="Estado"
            options={toOptions(INCIDENT_STATUS)}
            required
          />
          <SelectField
            control={control}
            name="assigned_to"
            label="Asignado a"
            allowClear
            loading={membersQuery.isLoading}
            options={assignable}
          />
        </div>

        <AttachmentsField
          uploader={uploader}
          label="Evidencias (fotos o documentos)"
          help="Se almacenan en el bucket privado `incident-evidence`. Maximo 25 MB por archivo."
          disabled={submitting}
        />

        <TextAreaField control={control} name="resolution" label="Resolucion" rows={3} maxLength={2000} />
      </form>
    </FormDrawer>
  )
}

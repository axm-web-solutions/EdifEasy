import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import {
  AttachmentsField,
  parseAttachments,
  useAttachmentUploader,
} from '@/components/forms/AttachmentsField'
import { requestSchema, type RequestFormValues } from '@/schemas/operations'
import { PRIORITY_LEVEL, REQUEST_STATUS, REQUEST_TYPE, toOptions } from '@/constants/enums'
import { useAllApartments } from '@/hooks/useApartments'
import { useAllMembers } from '@/hooks/useMembers'
import type { RequestRow, TablesInsert } from '@/types/database'

const EMPTY: RequestFormValues = {
  title: '',
  description: '',
  type: 'MAINTENANCE',
  priority: 'MEDIUM',
  status: 'OPEN',
  apartment_id: null,
  building_id: null,
  assigned_to: null,
}

export function RequestForm({
  open,
  request,
  condominiumId,
  createdBy,
  canAssign,
  defaultApartmentId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  request: RequestRow | null
  condominiumId: string
  createdBy: string
  canAssign: boolean
  defaultApartmentId?: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'requests'>) => void
}) {
  const apartmentsQuery = useAllApartments(condominiumId)
  const membersQuery = useAllMembers(canAssign ? condominiumId : null)
  const uploader = useAttachmentUploader(condominiumId, 'documents', 'requests')

  const { control, handleSubmit, reset } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    uploader.reset(parseAttachments(request?.attachments))
    reset(
      request
        ? {
            title: request.title,
            description: request.description,
            type: request.type,
            priority: request.priority,
            status: request.status,
            apartment_id: request.apartment_id,
            building_id: request.building_id,
            assigned_to: request.assigned_to,
          }
        : { ...EMPTY, apartment_id: defaultApartmentId ?? null },
    )
    // `uploader.reset` es estable; solo debe correr al abrir el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request, defaultApartmentId, reset])

  const submit = handleSubmit(async (values) => {
    const apartment = (apartmentsQuery.data ?? []).find((item) => item.id === values.apartment_id)
    const attachments = await uploader.commit()

    onSubmit({
      condominium_id: condominiumId,
      title: values.title,
      description: values.description,
      type: values.type,
      priority: values.priority,
      status: values.status,
      apartment_id: values.apartment_id || null,
      building_id: apartment?.building_id ?? null,
      assigned_to: values.assigned_to || null,
      attachments,
      created_by: request?.created_by ?? createdBy,
    })
  })

  const assignableMembers = (membersQuery.data ?? [])
    .filter((member) =>
      ['ADMINISTRATOR', 'SERVICE_STAFF', 'SECURITY'].includes(member.role?.code ?? ''),
    )
    .map((member) => ({
      value: member.profile?.id ?? '',
      label: `${member.profile?.full_name ?? ''} · ${member.role?.name ?? ''}`,
    }))

  return (
    <FormDrawer
      open={open}
      title={request ? `Editar solicitud ${request.code ?? ''}` : 'Nueva solicitud'}
      description="Reporta una necesidad o requerimiento a la administracion."
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
            options={toOptions(REQUEST_TYPE)}
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

        <AttachmentsField
          uploader={uploader}
          label="Adjuntos (imagenes o documentos)"
          disabled={submitting}
        />

        {canAssign ? (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <SelectField
              control={control}
              name="status"
              label="Estado"
              options={toOptions(REQUEST_STATUS)}
              required
            />
            <SelectField
              control={control}
              name="assigned_to"
              label="Asignar a"
              allowClear
              loading={membersQuery.isLoading}
              options={assignableMembers}
            />
          </div>
        ) : null}
      </form>
    </FormDrawer>
  )
}

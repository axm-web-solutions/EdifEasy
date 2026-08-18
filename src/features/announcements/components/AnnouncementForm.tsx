import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import dayjs from 'dayjs'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { announcementSchema, type AnnouncementFormValues } from '@/schemas/communication'
import { ANNOUNCEMENT_STATUS, AUDIENCE_TYPE, toOptions } from '@/constants/enums'
import { useAllBuildings } from '@/hooks/useBuildings'
import { useRoles } from '@/hooks/useMembers'
import type { AnnouncementRow, TablesInsert } from '@/types/database'

const EMPTY: AnnouncementFormValues = {
  title: '',
  content: '',
  image_url: '',
  audience: 'CONDOMINIUM',
  building_id: null,
  apartment_id: null,
  audience_role_id: null,
  status: 'PUBLISHED',
  published_at: dayjs().toISOString(),
  expires_at: null,
}

export function AnnouncementForm({
  open,
  announcement,
  condominiumId,
  createdBy,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  announcement: AnnouncementRow | null
  condominiumId: string
  createdBy: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'announcements'>) => void
}) {
  const buildingsQuery = useAllBuildings(condominiumId)
  const rolesQuery = useRoles()

  const { control, handleSubmit, reset } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: EMPTY,
  })

  const audience = useWatch({ control, name: 'audience' })

  useEffect(() => {
    if (!open) return
    reset(
      announcement
        ? {
            title: announcement.title,
            content: announcement.content,
            image_url: announcement.image_url ?? '',
            audience: announcement.audience,
            building_id: announcement.building_id,
            apartment_id: announcement.apartment_id,
            audience_role_id: announcement.audience_role_id,
            status: announcement.status,
            published_at: announcement.published_at,
            expires_at: announcement.expires_at,
          }
        : EMPTY,
    )
  }, [open, announcement, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      condominium_id: condominiumId,
      title: values.title,
      content: values.content,
      image_url: values.image_url || null,
      audience: values.audience,
      building_id: values.audience === 'BUILDING' ? (values.building_id || null) : null,
      audience_role_id: values.audience === 'ROLE' ? (values.audience_role_id || null) : null,
      status: values.status,
      published_at: values.published_at,
      expires_at: values.expires_at || null,
      created_by: createdBy,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={announcement ? 'Editar comunicado' : 'Nuevo comunicado'}
      description="Informacion general dirigida a la comunidad."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      width={620}
    >
      <form onSubmit={submit} noValidate>
        <TextField control={control} name="title" label="Titulo" required maxLength={150} />
        <TextAreaField
          control={control}
          name="content"
          label="Contenido"
          required
          rows={8}
          maxLength={8000}
        />
        <TextField control={control} name="image_url" label="Imagen (URL)" placeholder="https://..." />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name="audience"
            label="Destinatarios"
            options={toOptions(AUDIENCE_TYPE).filter((option) => option.value !== 'APARTMENT')}
            required
          />
          <SelectField
            control={control}
            name="status"
            label="Estado"
            options={toOptions(ANNOUNCEMENT_STATUS)}
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
          <DateField control={control} name="published_at" label="Fecha de publicacion" showTime required />
          <DateField control={control} name="expires_at" label="Fecha de expiracion" showTime />
        </div>
      </form>
    </FormDrawer>
  )
}

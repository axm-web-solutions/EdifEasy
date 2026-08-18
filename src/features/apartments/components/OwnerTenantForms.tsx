import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, NumberField, SelectField, SwitchField } from '@/components/forms/fields'
import {
  apartmentOwnerSchema,
  apartmentTenantSchema,
  type ApartmentOwnerFormValues,
  type ApartmentTenantFormValues,
} from '@/schemas/people'
import { useAllMembers } from '@/hooks/useMembers'
import type { TablesInsert } from '@/types/database'
import dayjs from 'dayjs'

function useProfileOptions(condominiumId: string | null) {
  const membersQuery = useAllMembers(condominiumId)
  const options = (membersQuery.data ?? [])
    .filter((member) => member.profile)
    .map((member) => ({
      value: member.profile?.id ?? '',
      label: `${member.profile?.full_name ?? ''} · ${member.role?.name ?? ''}`,
    }))

  const unique = options.filter(
    (option, index, list) => list.findIndex((candidate) => candidate.value === option.value) === index,
  )

  return { options: unique, loading: membersQuery.isLoading }
}

export function OwnerForm({
  open,
  apartmentId,
  condominiumId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  apartmentId: string
  condominiumId: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'apartment_owners'>) => void
}) {
  const { options, loading } = useProfileOptions(condominiumId)

  const { control, handleSubmit, reset } = useForm<ApartmentOwnerFormValues>({
    resolver: zodResolver(apartmentOwnerSchema),
    defaultValues: {
      profile_id: '',
      ownership_percentage: 100,
      is_primary: true,
      start_date: dayjs().format('YYYY-MM-DD'),
      end_date: null,
      is_active: true,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        profile_id: '',
        ownership_percentage: 100,
        is_primary: true,
        start_date: dayjs().format('YYYY-MM-DD'),
        end_date: null,
        is_active: true,
      })
    }
  }, [open, reset])

  const submit = handleSubmit((values) => {
    onSubmit({ ...values, apartment_id: apartmentId, end_date: values.end_date || null })
  })

  return (
    <FormDrawer
      open={open}
      title="Asignar propietario"
      description="El usuario debe estar vinculado al condominio."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
    >
      <form onSubmit={submit} noValidate>
        <SelectField
          control={control}
          name="profile_id"
          label="Usuario"
          required
          loading={loading}
          options={options}
          placeholder="Selecciona un usuario del condominio"
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NumberField
            control={control}
            name="ownership_percentage"
            label="Porcentaje de propiedad"
            min={0}
            max={100}
            step={1}
            required
          />
          <DateField control={control} name="start_date" label="Fecha de inicio" required />
        </div>
        <DateField control={control} name="end_date" label="Fecha de fin (opcional)" />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SwitchField control={control} name="is_primary" label="Propietario principal" />
          <SwitchField control={control} name="is_active" label="Activo" />
        </div>
      </form>
    </FormDrawer>
  )
}

export function TenantForm({
  open,
  apartmentId,
  condominiumId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  apartmentId: string
  condominiumId: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'apartment_tenants'>) => void
}) {
  const { options, loading } = useProfileOptions(condominiumId)

  const { control, handleSubmit, reset } = useForm<ApartmentTenantFormValues>({
    resolver: zodResolver(apartmentTenantSchema),
    defaultValues: {
      profile_id: '',
      lease_start: dayjs().format('YYYY-MM-DD'),
      lease_end: null,
      monthly_rent: null,
      is_active: true,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        profile_id: '',
        lease_start: dayjs().format('YYYY-MM-DD'),
        lease_end: null,
        monthly_rent: null,
        is_active: true,
      })
    }
  }, [open, reset])

  const submit = handleSubmit((values) => {
    onSubmit({ ...values, apartment_id: apartmentId, lease_end: values.lease_end || null })
  })

  return (
    <FormDrawer
      open={open}
      title="Asignar arrendatario"
      description="El usuario debe estar vinculado al condominio."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
    >
      <form onSubmit={submit} noValidate>
        <SelectField
          control={control}
          name="profile_id"
          label="Usuario"
          required
          loading={loading}
          options={options}
          placeholder="Selecciona un usuario del condominio"
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <DateField control={control} name="lease_start" label="Inicio del contrato" required />
          <DateField control={control} name="lease_end" label="Fin del contrato" />
        </div>
        <NumberField
          control={control}
          name="monthly_rent"
          label="Canon mensual"
          min={0}
          step={50000}
          addonBefore="$"
        />
        <SwitchField control={control} name="is_active" label="Contrato activo" />
      </form>
    </FormDrawer>
  )
}

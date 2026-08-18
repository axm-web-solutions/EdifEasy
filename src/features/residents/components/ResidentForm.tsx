import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { residentSchema, type ResidentFormValues } from '@/schemas/people'
import { RESIDENT_RELATIONSHIP, toOptions } from '@/constants/enums'
import { useAllApartments } from '@/hooks/useApartments'
import { emptyToNull } from '@/utils/format'
import type { ResidentRow, TablesInsert } from '@/types/database'

const EMPTY: ResidentFormValues = {
  apartment_id: '',
  full_name: '',
  document_number: '',
  relationship: 'FAMILY',
  birth_date: null,
  phone: '',
  email: '',
  emergency_phone: '',
  notes: '',
  is_active: true,
}

export function ResidentForm({
  open,
  resident,
  condominiumId,
  fixedApartmentId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  resident: ResidentRow | null
  condominiumId: string
  fixedApartmentId?: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'residents'>) => void
}) {
  const apartmentsQuery = useAllApartments(fixedApartmentId ? null : condominiumId)

  const { control, handleSubmit, reset } = useForm<ResidentFormValues>({
    resolver: zodResolver(residentSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    reset(
      resident
        ? {
            apartment_id: resident.apartment_id,
            full_name: resident.full_name,
            document_number: resident.document_number ?? '',
            relationship: resident.relationship,
            birth_date: resident.birth_date,
            phone: resident.phone ?? '',
            email: resident.email ?? '',
            emergency_phone: resident.emergency_phone ?? '',
            notes: resident.notes ?? '',
            is_active: resident.is_active,
          }
        : { ...EMPTY, apartment_id: fixedApartmentId ?? '' },
    )
  }, [open, resident, fixedApartmentId, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(emptyToNull(values) as Omit<TablesInsert<'residents'>, 'condominium_id'>),
      condominium_id: condominiumId,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={resident ? 'Editar residente' : 'Nuevo residente'}
      description="Personas que habitan el apartamento."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
    >
      <form onSubmit={submit} noValidate>
        {fixedApartmentId ? null : (
          <SelectField
            control={control}
            name="apartment_id"
            label="Apartamento"
            required
            loading={apartmentsQuery.isLoading}
            options={(apartmentsQuery.data ?? []).map((apartment) => ({
              value: apartment.id,
              label: `${apartment.building?.name ?? ''} · Apto ${apartment.number}`,
            }))}
          />
        )}

        <TextField control={control} name="full_name" label="Nombre completo" required />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="document_number" label="Documento" />
          <SelectField
            control={control}
            name="relationship"
            label="Relacion"
            options={toOptions(RESIDENT_RELATIONSHIP)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="phone" label="Telefono" />
          <TextField control={control} name="emergency_phone" label="Telefono de emergencia" />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="email" label="Correo" type="email" />
          <DateField control={control} name="birth_date" label="Fecha de nacimiento" />
        </div>

        <TextAreaField control={control} name="notes" label="Observaciones" maxLength={500} rows={3} />
        <SwitchField control={control} name="is_active" label="Residente activo" />
      </form>
    </FormDrawer>
  )
}

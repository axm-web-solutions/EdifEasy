import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { visitorSchema, type VisitorFormValues } from '@/schemas/visitors'
import { VISITOR_STATUS, VISITOR_TYPE, toOptions } from '@/constants/enums'
import { useAllApartments } from '@/hooks/useApartments'
import { useAuth } from '@/hooks/useAuth'
import { emptyToNull } from '@/utils/format'
import type { VisitorRow, TablesInsert } from '@/types/database'

const EMPTY: VisitorFormValues = {
  full_name: '',
  document_number: '',
  phone: '',
  type: 'VISIT',
  status: 'EXPECTED',
  apartment_id: '',
  company: '',
  plate: '',
  scheduled_at: null,
  notes: '',
}

export function VisitorForm({
  open,
  visitor,
  condominiumId,
  registeredBy,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  visitor: VisitorRow | null
  condominiumId: string
  registeredBy: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'visitors'>) => void
}) {
  const apartmentsQuery = useAllApartments(condominiumId)
  const { apartmentIds, hasRole } = useAuth()

  const { control, handleSubmit, reset } = useForm<VisitorFormValues>({
    resolver: zodResolver(visitorSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    reset(
      visitor
        ? {
            full_name: visitor.full_name,
            document_number: visitor.document_number ?? '',
            phone: visitor.phone ?? '',
            type: visitor.type,
            status: visitor.status,
            apartment_id: visitor.apartment_id,
            company: visitor.company ?? '',
            plate: visitor.plate ?? '',
            scheduled_at: visitor.scheduled_at,
            notes: visitor.notes ?? '',
          }
        : EMPTY,
    )
  }, [open, visitor, reset])

  const seeAllApartments = hasRole(['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])

  const apartmentOptions = (apartmentsQuery.data ?? [])
    .filter((apartment) => seeAllApartments || apartmentIds.includes(apartment.id))
    .map((apartment) => ({
      value: apartment.id,
      label: `${apartment.building?.name ?? 'Bloque'} · Apto ${apartment.number}`,
    }))

  const submit = handleSubmit(async (values) => {
    const now = new Date().toISOString()
    onSubmit({
      condominium_id: condominiumId,
      registered_by: registeredBy,
      ...emptyToNull(values),
      status: values.status,
      entry_at: values.status === 'INSIDE' ? now : null,
      exit_at: values.status === 'LEFT' ? now : null,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={visitor ? 'Editar visitante' : 'Registrar visitante'}
      description="Personas externas que ingresan a un apartamento del condominio."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      width={560}
    >
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="full_name" label="Nombre" required maxLength={120} />
          <SelectField
            control={control}
            name="type"
            label="Tipo de persona"
            options={toOptions(VISITOR_TYPE)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            control={control}
            name="document_number"
            label="Documento"
            placeholder="Numero de identificacion"
            maxLength={30}
          />
          <TextField control={control} name="phone" label="Telefono" maxLength={30} />
        </div>

        <SelectField
          control={control}
          name="apartment_id"
          label="Apartamento de destino"
          required
          loading={apartmentsQuery.isLoading}
          options={apartmentOptions}
          placeholder={apartmentOptions.length === 0 ? 'Sin apartamentos disponibles' : 'Selecciona un apartamento'}
          disabled={apartmentOptions.length === 0}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="company" label="Empresa" maxLength={120} />
          <TextField
            control={control}
            name="plate"
            label="Placa del vehiculo"
            placeholder="Ej. ABC-123"
            maxLength={20}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <DateField control={control} name="scheduled_at" label="Fecha programada" showTime />
          <SelectField
            control={control}
            name="status"
            label="Estado"
            options={toOptions(VISITOR_STATUS)}
            required
          />
        </div>

        <TextAreaField control={control} name="notes" label="Notas" rows={3} maxLength={1000} />
      </form>
    </FormDrawer>
  )
}
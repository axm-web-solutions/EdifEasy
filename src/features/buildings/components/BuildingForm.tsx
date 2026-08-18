import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { buildingSchema, type BuildingFormValues } from '@/schemas/structure'
import { BUILDING_STATUS, toOptions } from '@/constants/enums'
import { emptyToNull } from '@/utils/format'
import type { BuildingRow, TablesInsert } from '@/types/database'

const EMPTY: BuildingFormValues = {
  name: '',
  number: '',
  description: '',
  floors: 1,
  status: 'ACTIVE',
}

export function BuildingForm({
  open,
  building,
  condominiumId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  building: BuildingRow | null
  condominiumId: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'buildings'>) => void
}) {
  const { control, handleSubmit, reset } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    reset(
      building
        ? {
            name: building.name,
            number: building.number,
            description: building.description ?? '',
            floors: building.floors,
            status: building.status,
          }
        : EMPTY,
    )
  }, [open, building, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(emptyToNull(values) as Omit<TablesInsert<'buildings'>, 'condominium_id'>),
      condominium_id: condominiumId,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={building ? 'Editar bloque' : 'Nuevo bloque'}
      description="Los bloques agrupan los apartamentos del condominio."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
    >
      <form onSubmit={submit} noValidate>
        <TextField control={control} name="name" label="Nombre" placeholder="Bloque A" required />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            control={control}
            name="number"
            label="Identificador"
            placeholder="A"
            required
            help="Debe ser unico dentro del condominio."
          />
          <NumberField control={control} name="floors" label="Numero de pisos" min={1} max={100} required />
        </div>
        <SelectField
          control={control}
          name="status"
          label="Estado"
          options={toOptions(BUILDING_STATUS)}
          required
        />
        <TextAreaField control={control} name="description" label="Descripcion" maxLength={500} />
      </form>
    </FormDrawer>
  )
}

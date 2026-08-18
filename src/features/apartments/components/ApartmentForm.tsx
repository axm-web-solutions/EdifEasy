import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { apartmentSchema, type ApartmentFormValues } from '@/schemas/structure'
import { APARTMENT_STATUS, toOptions } from '@/constants/enums'
import { useAllBuildings } from '@/hooks/useBuildings'
import { emptyToNull } from '@/utils/format'
import type { ApartmentRow, TablesInsert } from '@/types/database'

const EMPTY: ApartmentFormValues = {
  building_id: '',
  number: '',
  floor: 1,
  area: null,
  bedrooms: null,
  bathrooms: null,
  parking_spots: 0,
  coefficient: null,
  status: 'VACANT',
  description: '',
}

export function ApartmentForm({
  open,
  apartment,
  condominiumId,
  defaultBuildingId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  apartment: ApartmentRow | null
  condominiumId: string
  defaultBuildingId?: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'apartments'>) => void
}) {
  const buildingsQuery = useAllBuildings(condominiumId)

  const { control, handleSubmit, reset } = useForm<ApartmentFormValues>({
    resolver: zodResolver(apartmentSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    reset(
      apartment
        ? {
            building_id: apartment.building_id,
            number: apartment.number,
            floor: apartment.floor,
            area: apartment.area,
            bedrooms: apartment.bedrooms,
            bathrooms: apartment.bathrooms,
            parking_spots: apartment.parking_spots,
            coefficient: apartment.coefficient,
            status: apartment.status,
            description: apartment.description ?? '',
          }
        : { ...EMPTY, building_id: defaultBuildingId ?? '' },
    )
  }, [open, apartment, defaultBuildingId, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(emptyToNull(values) as Omit<TablesInsert<'apartments'>, 'condominium_id'>),
      condominium_id: condominiumId,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={apartment ? `Editar apartamento ${apartment.number}` : 'Nuevo apartamento'}
      description="Informacion fisica y estado del inmueble."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      width={560}
    >
      <form onSubmit={submit} noValidate>
        <SelectField
          control={control}
          name="building_id"
          label="Bloque"
          required
          loading={buildingsQuery.isLoading}
          options={(buildingsQuery.data ?? []).map((building) => ({
            value: building.id,
            label: `${building.name} (${building.number})`,
          }))}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="number" label="Numero" placeholder="A101" required />
          <NumberField control={control} name="floor" label="Piso" min={0} max={100} required />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <NumberField control={control} name="area" label="Area (m2)" min={0} step={0.5} precision={2} />
          <NumberField
            control={control}
            name="coefficient"
            label="Coeficiente (%)"
            min={0}
            max={100}
            step={0.001}
            precision={5}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <NumberField control={control} name="bedrooms" label="Habitaciones" min={0} max={20} />
          <NumberField control={control} name="bathrooms" label="Banos" min={0} max={20} />
          <NumberField control={control} name="parking_spots" label="Parqueaderos" min={0} max={20} />
        </div>

        <SelectField
          control={control}
          name="status"
          label="Estado"
          options={toOptions(APARTMENT_STATUS)}
          required
        />

        <TextAreaField control={control} name="description" label="Descripcion" maxLength={500} />
      </form>
    </FormDrawer>
  )
}

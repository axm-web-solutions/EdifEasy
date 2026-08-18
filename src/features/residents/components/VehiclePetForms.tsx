import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  NumberField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { petSchema, vehicleSchema, type PetFormValues, type VehicleFormValues } from '@/schemas/people'
import { PET_TYPE, VEHICLE_TYPE, toOptions } from '@/constants/enums'
import { useAllApartments } from '@/hooks/useApartments'
import { emptyToNull } from '@/utils/format'
import type { PetRow, TablesInsert, VehicleRow } from '@/types/database'

const EMPTY_VEHICLE: VehicleFormValues = {
  apartment_id: '',
  type: 'CAR',
  plate: '',
  brand: '',
  model: '',
  color: '',
  parking_spot: '',
  is_active: true,
}

const EMPTY_PET: PetFormValues = {
  apartment_id: '',
  name: '',
  type: 'DOG',
  breed: '',
  color: '',
  weight: null,
  vaccinated: false,
  notes: '',
  is_active: true,
}

export function VehicleForm({
  open,
  vehicle,
  condominiumId,
  fixedApartmentId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  vehicle: VehicleRow | null
  condominiumId: string
  fixedApartmentId?: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'vehicles'>) => void
}) {
  const apartmentsQuery = useAllApartments(fixedApartmentId ? null : condominiumId)

  const { control, handleSubmit, reset } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: EMPTY_VEHICLE,
  })

  useEffect(() => {
    if (!open) return
    reset(
      vehicle
        ? {
            apartment_id: vehicle.apartment_id,
            type: vehicle.type,
            plate: vehicle.plate,
            brand: vehicle.brand ?? '',
            model: vehicle.model ?? '',
            color: vehicle.color ?? '',
            parking_spot: vehicle.parking_spot ?? '',
            is_active: vehicle.is_active,
          }
        : { ...EMPTY_VEHICLE, apartment_id: fixedApartmentId ?? '' },
    )
  }, [open, vehicle, fixedApartmentId, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(emptyToNull(values) as Omit<TablesInsert<'vehicles'>, 'condominium_id'>),
      condominium_id: condominiumId,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={vehicle ? 'Editar vehiculo' : 'Nuevo vehiculo'}
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

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="plate" label="Placa" required placeholder="ABC123" />
          <SelectField
            control={control}
            name="type"
            label="Tipo"
            options={toOptions(VEHICLE_TYPE)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="brand" label="Marca" />
          <TextField control={control} name="model" label="Modelo" />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="color" label="Color" />
          <TextField control={control} name="parking_spot" label="Parqueadero" />
        </div>

        <SwitchField control={control} name="is_active" label="Vehiculo activo" />
      </form>
    </FormDrawer>
  )
}

export function PetForm({
  open,
  pet,
  condominiumId,
  fixedApartmentId,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  pet: PetRow | null
  condominiumId: string
  fixedApartmentId?: string
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'pets'>) => void
}) {
  const apartmentsQuery = useAllApartments(fixedApartmentId ? null : condominiumId)

  const { control, handleSubmit, reset } = useForm<PetFormValues>({
    resolver: zodResolver(petSchema),
    defaultValues: EMPTY_PET,
  })

  useEffect(() => {
    if (!open) return
    reset(
      pet
        ? {
            apartment_id: pet.apartment_id,
            name: pet.name,
            type: pet.type,
            breed: pet.breed ?? '',
            color: pet.color ?? '',
            weight: pet.weight,
            vaccinated: pet.vaccinated,
            notes: pet.notes ?? '',
            is_active: pet.is_active,
          }
        : { ...EMPTY_PET, apartment_id: fixedApartmentId ?? '' },
    )
  }, [open, pet, fixedApartmentId, reset])

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(emptyToNull(values) as Omit<TablesInsert<'pets'>, 'condominium_id'>),
      condominium_id: condominiumId,
    })
  })

  return (
    <FormDrawer
      open={open}
      title={pet ? 'Editar mascota' : 'Nueva mascota'}
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

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="name" label="Nombre" required />
          <SelectField control={control} name="type" label="Tipo" options={toOptions(PET_TYPE)} required />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <TextField control={control} name="breed" label="Raza" />
          <TextField control={control} name="color" label="Color" />
          <NumberField control={control} name="weight" label="Peso (kg)" min={0} step={0.5} precision={2} />
        </div>

        <TextAreaField control={control} name="notes" label="Observaciones" maxLength={300} rows={3} />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SwitchField control={control} name="vaccinated" label="Vacunas al dia" />
          <SwitchField control={control} name="is_active" label="Mascota activa" />
        </div>
      </form>
    </FormDrawer>
  )
}

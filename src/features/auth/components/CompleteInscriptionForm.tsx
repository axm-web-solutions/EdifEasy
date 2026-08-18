import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Divider } from 'antd'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { getErrorMessage } from '@/lib/errors'
import { registrationService } from '@/services/registrationService'
import { SELF_REGISTER_ROLES, type SelfRegisterRole } from '@/schemas/auth'
import { OrganizationPicker } from './OrganizationPicker'

const inscriptionSchema = z.object({
  userType: z.enum(SELF_REGISTER_ROLES, {
    errorMap: () => ({ message: 'Selecciona tu tipo de usuario' }),
  }),
  condominiumId: z.string().uuid('Selecciona tu condominio'),
  buildingId: z.string().uuid('Selecciona tu edificio'),
  apartmentId: z.string().uuid('Selecciona tu apartamento'),
  note: z.string().max(500).optional().or(z.literal('')),
  vehicles: z
    .array(
      z.object({
        plate: z.string().trim().min(3, 'Ingresa la placa').max(12),
        type: z.enum(['CAR', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'OTHER']).optional(),
      }),
    )
    .optional()
    .default([]),
})

type InscriptionValues = z.infer<typeof inscriptionSchema>

const USER_TYPE_OPTIONS = [
  { value: 'OWNER', label: 'Propietario / Dueno' },
  { value: 'TENANT', label: 'Arrendatario' },
  { value: 'BOTH', label: 'Propietario y arrendatario' },
]

const VEHICLE_TYPE_OPTIONS = [
  { value: 'CAR', label: 'Automovil' },
  { value: 'MOTORCYCLE', label: 'Motocicleta' },
  { value: 'BICYCLE', label: 'Bicicleta' },
  { value: 'TRUCK', label: 'Camioneta' },
  { value: 'OTHER', label: 'Otro' },
]

/**
 * Envia la SOLICITUD de inscripcion de un usuario ya autenticado que aun no
 * pertenece a ningun condominio. Elige condominio, edificio y apartamento de
 * catalogos existentes; el acceso lo concede despues un administrador.
 */
export function CompleteInscriptionForm({
  defaultUserType,
  onSubmitted,
}: {
  defaultUserType?: SelfRegisterRole
  onSubmitted?: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<InscriptionValues>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: {
      userType: defaultUserType ?? 'OWNER',
      condominiumId: '',
      buildingId: '',
      apartmentId: '',
      note: '',
      vehicles: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'vehicles' })
  const userType = watch('userType')

  // Si venia del autoregistro, precargamos lo que ya habia elegido.
  useEffect(() => {
    const pending = registrationService.loadPending()
    if (!pending) {
      if (defaultUserType) setValue('userType', defaultUserType)
      return
    }
    reset({
      userType: pending.userType,
      condominiumId: pending.condominiumId,
      buildingId: pending.buildingId,
      apartmentId: pending.apartmentId,
      note: pending.note ?? '',
      vehicles: pending.vehicles.map((vehicle) => ({
        plate: vehicle.plate,
        type: vehicle.type ?? 'CAR',
      })),
    })
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await registrationService.request({
        condominiumId: values.condominiumId,
        buildingId: values.buildingId,
        apartmentId: values.apartmentId,
        userType: values.userType,
        vehicles: values.vehicles.filter((vehicle) => vehicle.plate.trim().length > 0),
        note: values.note || undefined,
      })
      registrationService.clearPending()
      onSubmitted?.()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="text-left">
      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          className="mb-4"
          closable
          onClose={() => setError(null)}
        />
      ) : null}

      <SelectField
        control={control}
        name="userType"
        label="Tipo de usuario"
        required
        showSearch={false}
        options={USER_TYPE_OPTIONS}
        placeholder="Selecciona tu tipo de usuario"
      />

      <OrganizationPicker control={control} setValue={setValue} watch={watch} userType={userType} />

      <TextAreaField
        control={control}
        name="note"
        label="Mensaje para la administracion (opcional)"
        rows={2}
        maxLength={500}
      />

      <Divider plain orientation="left" style={{ color: '#64748b', fontSize: 12 }}>
        VEHICULOS (OPCIONAL)
      </Divider>

      {fields.map((field, index) => (
        <div key={field.id} className="mb-2 rounded-lg border border-slate-100 p-3">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <TextField
              control={control}
              name={`vehicles.${index}.plate`}
              label="Placa"
              placeholder="Ej: ABC123"
              required
            />
            <SelectField
              control={control}
              name={`vehicles.${index}.type`}
              label="Tipo"
              options={VEHICLE_TYPE_OPTIONS}
            />
          </div>
          <Button type="text" size="small" danger onClick={() => remove(index)}>
            Quitar vehiculo
          </Button>
        </div>
      ))}

      <Button type="dashed" block onClick={() => append({ plate: '', type: 'CAR' })}>
        + Agregar vehiculo
      </Button>

      <Button type="primary" htmlType="submit" block size="large" loading={isSubmitting} className="!mt-4">
        Enviar solicitud de inscripcion
      </Button>

      <p className="mt-3 mb-0 text-center text-xs text-slate-500">
        La administracion del condominio revisara tu solicitud. Recibiras una notificacion cuando sea
        aprobada.
      </p>
    </form>
  )
}

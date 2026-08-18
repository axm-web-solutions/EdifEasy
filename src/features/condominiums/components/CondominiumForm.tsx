import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { condominiumSchema, type CondominiumFormValues } from '@/schemas/structure'
import { CONDOMINIUM_STATUS, toOptions } from '@/constants/enums'
import { emptyToNull } from '@/utils/format'
import type { CondominiumRow, TablesInsert } from '@/types/database'

const EMPTY: CondominiumFormValues = {
  name: '',
  nit: '',
  address: '',
  city: '',
  country: 'Colombia',
  phone: '',
  email: '',
  logo_url: '',
  description: '',
  status: 'ACTIVE',
}

export function CondominiumForm({
  open,
  condominium,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  condominium: CondominiumRow | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TablesInsert<'condominiums'>) => void
}) {
  const { control, handleSubmit, reset } = useForm<CondominiumFormValues>({
    resolver: zodResolver(condominiumSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    reset(
      condominium
        ? {
            name: condominium.name,
            nit: condominium.nit ?? '',
            address: condominium.address ?? '',
            city: condominium.city ?? '',
            country: condominium.country,
            phone: condominium.phone ?? '',
            email: condominium.email ?? '',
            logo_url: condominium.logo_url ?? '',
            description: condominium.description ?? '',
            status: condominium.status,
          }
        : EMPTY,
    )
  }, [open, condominium, reset])

  const submit = handleSubmit((values) => {
    onSubmit(emptyToNull(values) as TablesInsert<'condominiums'>)
  })

  return (
    <FormDrawer
      open={open}
      title={condominium ? 'Editar condominio' : 'Nuevo condominio'}
      description="Datos generales del conjunto residencial."
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      width={560}
    >
      <form onSubmit={submit} noValidate>
        <TextField control={control} name="name" label="Nombre" required />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="nit" label="NIT" placeholder="900123456-7" />
          <TextField control={control} name="phone" label="Telefono" />
        </div>

        <TextField control={control} name="address" label="Direccion" />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="city" label="Ciudad" />
          <TextField control={control} name="country" label="Pais" />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="email" label="Correo" type="email" />
          <SelectField
            control={control}
            name="status"
            label="Estado"
            options={toOptions(CONDOMINIUM_STATUS)}
            required
          />
        </div>

        <TextField control={control} name="logo_url" label="URL del logo" placeholder="https://..." />
        <TextAreaField control={control} name="description" label="Descripcion" maxLength={1000} />
      </form>
    </FormDrawer>
  )
}

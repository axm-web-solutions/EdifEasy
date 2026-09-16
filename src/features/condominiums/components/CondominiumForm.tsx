import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { ColorField, SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { condominiumSchema, type CondominiumFormValues } from '@/schemas/structure'
import { CONDOMINIUM_STATUS, toOptions } from '@/constants/enums'
import { emptyToNull } from '@/utils/format'
import { DEFAULT_BRAND_COLOR, mergeSetting, readSetting, resolvePrimaryColor } from '@/utils/brand'
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
  primary_color: DEFAULT_BRAND_COLOR,
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
            primary_color: resolvePrimaryColor(readSetting(condominium.settings, 'primaryColor')),
            description: condominium.description ?? '',
            status: condominium.status,
          }
        : EMPTY,
    )
  }, [open, condominium, reset])

  const submit = handleSubmit((values) => {
    const { primary_color, ...rest } = values
    onSubmit({
      ...(emptyToNull(rest) as TablesInsert<'condominiums'>),
      settings: mergeSetting(condominium?.settings, 'primaryColor', resolvePrimaryColor(primary_color)),
    })
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

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Marca e imagen
        </p>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <ColorField control={control} name="primary_color" label="Color principal" />
          <TextField
            control={control}
            name="logo_url"
            label="URL del logo"
            placeholder="https://..."
          />
        </div>
        <TextAreaField control={control} name="description" label="Descripcion" maxLength={1000} />
      </form>
    </FormDrawer>
  )
}

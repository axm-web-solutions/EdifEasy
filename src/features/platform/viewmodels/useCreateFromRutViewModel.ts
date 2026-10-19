import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useProvisionCondominium, useReadRut } from '@/hooks/useProvisioning'
import { provisionSchema, type ProvisionFormValues } from '@/schemas/platform'
import type { ProvisionResult } from '@/services/provisioningService'
import { EXPORTERS } from '@/utils/export'
import { getErrorMessage } from '@/lib/errors'
import {
  CREDENTIAL_COLUMNS,
  RESIDENT_EMAIL_DOMAIN,
  emailSlug,
  parseRut,
  planUnits,
  unitCount,
  type ProvisionedAccount,
  type RutData,
  type UnitLayout,
} from './rut.logic'

const EMPTY: ProvisionFormValues = {
  name: '',
  nit: '',
  address: '',
  city: '',
  department: '',
  phone: '',
  email: '',
  admin_name: '',
  admin_email: '',
  kind: 'HOUSES',
  houses: 0,
  towers: 1,
  floors: 5,
  units_per_floor: 4,
  email_slug: '',
}

const FIELD_LABELS: Record<keyof RutData, string> = {
  nit: 'NIT',
  businessName: 'Razon social',
  taxpayerType: 'Tipo de contribuyente',
  department: 'Departamento',
  city: 'Ciudad',
  address: 'Direccion',
  email: 'Correo',
  phone: 'Telefono',
  legalRepresentative: 'Representante legal',
}

export type CreateFromRutStep = 'upload' | 'review' | 'done'

/** Igual al limite de `provision_condominium`. */
const MAX_UNITS = 3000

function toLayout(values: Pick<ProvisionFormValues, 'kind' | 'houses' | 'towers' | 'floors' | 'units_per_floor'>): UnitLayout {
  return values.kind === 'HOUSES'
    ? { kind: 'HOUSES', houses: Math.max(0, Number(values.houses) || 0) }
    : {
        kind: 'TOWERS',
        towers: Math.max(0, Number(values.towers) || 0),
        floors: Math.max(0, Number(values.floors) || 0),
        unitsPerFloor: Math.max(0, Number(values.units_per_floor) || 0),
      }
}

/**
 * Alta de un conjunto desde el RUT:
 * 1. upload: se sube el PDF y se lee en el navegador.
 * 2. review: se revisan los datos y se indica torres/apartamentos o casas.
 * 3. done:   credenciales creadas (se muestran una sola vez y se descargan).
 */
export function useCreateFromRutViewModel() {
  const readRut = useReadRut()
  const provision = useProvisionCondominium()

  const [step, setStep] = useState<CreateFromRutStep>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [readNotice, setReadNotice] = useState<{ type: 'success' | 'warning'; text: string } | null>(null)
  const [result, setResult] = useState<ProvisionResult | null>(null)

  const form = useForm<ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: EMPTY,
  })
  const [kind, houses, towers, floors, unitsPerFloor, slug] = useWatch({
    control: form.control,
    name: ['kind', 'houses', 'towers', 'floors', 'units_per_floor', 'email_slug'],
  })

  const layout = toLayout({ kind, houses, towers, floors, units_per_floor: unitsPerFloor })
  const unitTotal = unitCount(layout)
  // La muestra solo se arma con un total valido (evita listas enormes al escribir).
  const sampleUnits = useMemo(() => {
    if (unitTotal < 1 || unitTotal > MAX_UNITS) return []
    const units = planUnits(layout, slug || 'conjunto')
    return units.length > 3 ? [units[0], units[1], units[units.length - 1]] : units
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, houses, towers, floors, unitsPerFloor, slug, unitTotal])

  const readFile = (file: File) => {
    setFileName(file.name)
    readRut.mutate(file, {
      onSuccess: (items) => {
        const parsed = parseRut(items)
        const { data } = parsed
        form.reset({
          ...EMPTY,
          name: data.businessName,
          nit: data.nit,
          address: data.address,
          city: data.city,
          department: data.department,
          phone: data.phone,
          email: data.email,
          admin_name: data.legalRepresentative,
          admin_email: data.email,
          email_slug: emailSlug(data.businessName),
        })
        if (parsed.unreadable) {
          setReadNotice({
            type: 'warning',
            text: 'No se pudo leer texto del PDF (parece escaneado o no es un RUT de la DIAN). Llena los datos a mano.',
          })
        } else if (parsed.missing.length > 0) {
          setReadNotice({
            type: 'warning',
            text: `Revisa y completa: ${parsed.missing.map((key) => FIELD_LABELS[key]).join(', ')}.`,
          })
        } else {
          const juridical = /jur[ií]dica/i.test(data.taxpayerType)
          setReadNotice({
            type: juridical ? 'success' : 'warning',
            text: juridical
              ? 'Datos leidos del RUT. Revisalos antes de crear el conjunto.'
              : `El RUT es de "${data.taxpayerType || 'tipo desconocido'}", no de una persona juridica. Verifica que sea el RUT del conjunto.`,
          })
        }
        setStep('review')
      },
    })
  }

  const submit = form.handleSubmit((values) => {
    provision.mutate(
      {
        condominium: {
          name: values.name,
          nit: values.nit,
          address: values.address,
          city: values.city,
          department: values.department,
          phone: values.phone,
          email: values.email,
        },
        admin: { full_name: values.admin_name, email: values.admin_email },
        layout:
          values.kind === 'HOUSES'
            ? { kind: 'HOUSES', houses: values.houses }
            : {
                kind: 'TOWERS',
                towers: values.towers,
                floors: values.floors,
                units_per_floor: values.units_per_floor,
              },
        email_slug: values.email_slug,
      },
      {
        onSuccess: (data) => {
          setResult(data)
          setStep('done')
        },
      },
    )
  })

  const accounts = useMemo<(ProvisionedAccount & { existing: boolean })[]>(
    () =>
      result
        ? [
            {
              unit: 'Administracion',
              role: 'Administrador',
              email: result.admin.email,
              password: result.admin.password,
              existing: result.admin.existing,
            },
            ...result.accounts.map((account) => ({
              unit: account.unit,
              role: 'Propietario',
              email: account.email,
              password: account.password,
              existing: account.existing,
            })),
          ]
        : [],
    [result],
  )

  return {
    step,
    // upload
    fileName,
    reading: readRut.isPending,
    readError: readRut.error ? getErrorMessage(readRut.error) : null,
    readFile,
    fillManually: () => {
      form.reset(EMPTY)
      setReadNotice(null)
      setStep('review')
    },
    // review
    readNotice,
    control: form.control,
    kind,
    kindOptions: [
      { value: 'HOUSES', label: 'Casas' },
      { value: 'TOWERS', label: 'Torres de apartamentos' },
    ],
    unitTotal,
    tooManyUnits: unitTotal > MAX_UNITS,
    sampleUnits,
    emailDomain: RESIDENT_EMAIL_DOMAIN,
    regenerateSlug: () =>
      form.setValue('email_slug', emailSlug(form.getValues('name')), { shouldValidate: true }),
    submit,
    submitting: provision.isPending,
    submitError: provision.error ? getErrorMessage(provision.error) : null,
    backToUpload: () => {
      provision.reset()
      readRut.reset()
      setStep('upload')
    },
    // done
    condominiumName: result?.condominium_name ?? '',
    condominiumId: result?.condominium_id ?? null,
    accounts,
    downloadCredentials: () =>
      EXPORTERS.csv.run(accounts, CREDENTIAL_COLUMNS, `credenciales-${slug || 'conjunto'}`),
    startOver: () => {
      form.reset(EMPTY)
      setResult(null)
      setReadNotice(null)
      setFileName(null)
      provision.reset()
      readRut.reset()
      setStep('upload')
    },
  }
}

export type CreateFromRutViewModel = ReturnType<typeof useCreateFromRutViewModel>

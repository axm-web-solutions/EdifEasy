import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button } from 'antd'
import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form'
import type { PathValue } from 'react-hook-form'
import { SelectField } from '@/components/forms/fields'
import { registrationService } from '@/services/registrationService'
import { getErrorMessage } from '@/lib/errors'
import type { SelfRegisterRole } from '@/schemas/auth'

/** Campos que el formulario debe exponer para el selector en cascada. */
export interface OrganizationFields extends FieldValues {
  condominiumId: string
  buildingId: string
  apartmentId: string
}

const CONDOMINIUM = 'condominiumId'
const BUILDING = 'buildingId'
const APARTMENT = 'apartmentId'

/**
 * Selector Condominio -> Edificio -> Apartamento.
 *
 * Los tres niveles se alimentan de catalogos de solo-lectura del servidor:
 * el usuario NUNCA escribe texto libre, solo puede elegir registros que ya
 * existen. Los apartamentos ya reclamados aparecen deshabilitados.
 */
export function OrganizationPicker<T extends OrganizationFields>({
  control,
  setValue,
  watch,
  userType,
}: {
  control: Control<T>
  setValue: UseFormSetValue<T>
  watch: UseFormWatch<T>
  userType: SelfRegisterRole
}) {
  const condominiumField = CONDOMINIUM as FieldPath<T>
  const buildingField = BUILDING as FieldPath<T>
  const apartmentField = APARTMENT as FieldPath<T>

  const condominiumId = watch(condominiumField) as string
  const buildingId = watch(buildingField) as string

  const condominiums = useQuery({
    queryKey: ['registration', 'condominiums'],
    queryFn: () => registrationService.catalog(),
    staleTime: 5 * 60_000,
  })

  const buildings = useQuery({
    queryKey: ['registration', 'buildings', condominiumId],
    queryFn: () => registrationService.buildings(condominiumId),
    enabled: Boolean(condominiumId),
    staleTime: 5 * 60_000,
  })

  const apartments = useQuery({
    queryKey: ['registration', 'apartments', buildingId],
    queryFn: () => registrationService.apartments(buildingId),
    enabled: Boolean(buildingId),
  })

  const empty = '' as PathValue<T, FieldPath<T>>

  // Al cambiar de condominio o edificio, los niveles inferiores dejan de ser validos.
  useEffect(() => {
    setValue(buildingField, empty, { shouldValidate: false })
    setValue(apartmentField, empty, { shouldValidate: false })
    // Solo debe reaccionar al cambio de condominio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominiumId])

  useEffect(() => {
    setValue(apartmentField, empty, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId])

  const wantsOwner = userType === 'OWNER' || userType === 'BOTH'
  const wantsTenant = userType === 'TENANT' || userType === 'BOTH'

  const apartmentOptions = (apartments.data ?? []).map((apartment) => {
    const takenAsOwner = wantsOwner && apartment.claimed_by_owner
    const takenAsTenant = wantsTenant && apartment.claimed_by_tenant
    const pending = apartment.has_pending_request

    let suffix = ''
    if (pending) suffix = ' - solicitud en revision'
    else if (takenAsOwner) suffix = ' - ya tiene propietario'
    else if (takenAsTenant) suffix = ' - ya tiene arrendatario'

    return {
      value: apartment.id,
      label: `Apto ${apartment.number} (piso ${apartment.floor})${suffix}`,
      disabled: pending || takenAsOwner || takenAsTenant,
    }
  })

  const availableCount = apartmentOptions.filter((option) => !option.disabled).length

  return (
    <>
      {/*
        Un solo aviso a la vez: si la consulta fallo NO tiene sentido decir
        tambien que no hay condominios, porque no se llego a saber.
      */}
      {condominiums.isError ? (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message="No se pudo cargar la lista de condominios"
          description={getErrorMessage(condominiums.error)}
          action={
            <Button size="small" onClick={() => void condominiums.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : !condominiums.isLoading && (condominiums.data ?? []).length === 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Todavia no hay condominios habilitados"
          description="Contacta a la administracion para que registre tu conjunto antes de inscribirte."
        />
      ) : null}

      <SelectField
        control={control}
        name={condominiumField}
        label="Condominio"
        required
        placeholder="Selecciona tu condominio"
        loading={condominiums.isLoading}
        options={(condominiums.data ?? []).map((condominium) => ({
          value: condominium.id,
          label: [condominium.name, condominium.city].filter(Boolean).join(' - '),
        }))}
      />

      <SelectField
        control={control}
        name={buildingField}
        label="Edificio / Bloque"
        required
        placeholder={condominiumId ? 'Selecciona tu edificio' : 'Elige primero el condominio'}
        disabled={!condominiumId}
        loading={buildings.isLoading}
        options={(buildings.data ?? []).map((building) => ({
          value: building.id,
          label: building.name ? `${building.name} (${building.number})` : building.number,
        }))}
      />

      <SelectField
        control={control}
        name={apartmentField}
        label="Apartamento"
        required
        placeholder={buildingId ? 'Selecciona tu apartamento' : 'Elige primero el edificio'}
        disabled={!buildingId}
        loading={apartments.isLoading}
        options={apartmentOptions}
        help={
          buildingId && !apartments.isLoading
            ? availableCount === 0
              ? 'No hay apartamentos disponibles en este edificio. Contacta a la administracion.'
              : `${availableCount} apartamento(s) disponible(s).`
            : undefined
        }
      />
    </>
  )
}

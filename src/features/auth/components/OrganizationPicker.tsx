import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Form } from 'antd'
import { useController } from 'react-hook-form'
import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form'
import type { PathValue } from 'react-hook-form'
import { SelectField } from '@/components/forms/fields'
import { BuildingPlan, type PlanUnit } from '@/components/ui/BuildingPlan'
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

  /*
   * El apartamento se elige en el plano, no en un desplegable, asi que el campo
   * se controla a mano. useController mantiene intacta la validacion de Zod:
   * el valor sigue viviendo en el formulario y el error sale del mismo sitio.
   */
  const apartment = useController({ control, name: apartmentField })

  const units: PlanUnit[] = (apartments.data ?? []).map((unit) => {
    const takenAsOwner = wantsOwner && unit.claimed_by_owner
    const takenAsTenant = wantsTenant && unit.claimed_by_tenant

    let state: PlanUnit['state'] = 'available'
    let hint: string | undefined

    if (unit.has_pending_request) {
      state = 'pending'
      hint = 'Ya hay una solicitud en revision para este apartamento.'
    } else if (takenAsOwner) {
      state = 'taken'
      hint = 'Este apartamento ya tiene un propietario registrado.'
    } else if (takenAsTenant) {
      state = 'taken'
      hint = 'Este apartamento ya tiene un arrendatario registrado.'
    }

    return { id: unit.id, number: unit.number, floor: unit.floor, state, hint }
  })

  const availableCount = units.filter((unit) => unit.state === 'available').length
  const selectedUnit = units.find((unit) => unit.id === apartment.field.value)

  const buildings_ = buildings.data ?? []
  const currentBuilding = buildings_.find((building) => building.id === buildingId)
  const buildingLabel = currentBuilding
    ? currentBuilding.name ?? `Bloque ${currentBuilding.number}`
    : 'Plano del edificio'

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

      {/*
        El texto informativo va DENTRO del campo, no en `help`.
        Medido en el navegador: antd 5 acompana cada mensaje de ayuda con un
        `ant-form-item-margin-offset` de margen negativo que compensa su altura
        para que el formulario no salte. Eso anula el margen inferior del campo
        y el divisor de la seccion siguiente acaba pegado al texto (hueco de 0px,
        con margenes de 24px y 16px declarados). `help` se reserva para el error.
      */}
      <Form.Item
        label="Apartamento"
        required
        layout="vertical"
        validateStatus={apartment.fieldState.error ? 'error' : undefined}
        help={apartment.fieldState.error?.message}
      >
        {buildingId ? (
          <>
            <BuildingPlan
              units={units}
              value={apartment.field.value as string}
              onSelect={(unitId) =>
                apartment.field.onChange(unitId as PathValue<T, FieldPath<T>>)
              }
              buildingLabel={buildingLabel}
              loading={apartments.isLoading}
            />
            {!apartments.isLoading ? (
              <p className="mb-0 mt-2 text-xs text-slate-500">
                {selectedUnit
                  ? `Elegiste el apartamento ${selectedUnit.number}, piso ${selectedUnit.floor}.`
                  : availableCount === 0
                    ? 'No hay apartamentos disponibles en este edificio. Contacta a la administracion.'
                    : 'Toca tu apartamento en el plano.'}
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Elige primero el condominio y el edificio para ver el plano.
          </div>
        )}
      </Form.Item>
    </>
  )
}

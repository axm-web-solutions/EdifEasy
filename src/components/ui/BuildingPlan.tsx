import { useMemo } from 'react'
import { Empty, Skeleton, Tooltip } from 'antd'
import { Check, DoorOpen, Lock, Timer } from 'lucide-react'

/**
 * Estado de una unidad en el plano.
 *
 *   available -> se puede elegir
 *   taken     -> ya tiene propietario o arrendatario para el rol solicitado
 *   pending   -> alguien la solicito y espera aprobacion
 *   blocked   -> fuera de servicio (inactiva, en mantenimiento)
 */
export type PlanUnitState = 'available' | 'taken' | 'pending' | 'blocked'

export interface PlanUnit {
  id: string
  number: string
  floor: number
  state: PlanUnitState
  /** Motivo, cuando no se puede elegir. Se muestra al pasar el cursor. */
  hint?: string
}

const STATE_STYLE: Record<PlanUnitState, { box: string; label: string }> = {
  available: {
    box: 'border-brand-300 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:shadow-card',
    label: 'Disponible',
  },
  taken: {
    box: 'border-slate-200 bg-slate-100 text-slate-400',
    label: 'Ocupado',
  },
  pending: {
    box: 'border-amber-300 bg-amber-50 text-amber-700',
    label: 'En revision',
  },
  blocked: {
    box: 'border-slate-200 bg-slate-50 text-slate-300',
    label: 'No disponible',
  },
}

const LEGEND: PlanUnitState[] = ['available', 'taken', 'pending', 'blocked']

function StateIcon({ state }: { state: PlanUnitState }) {
  if (state === 'pending') return <Timer size={12} />
  if (state === 'taken' || state === 'blocked') return <Lock size={12} />
  return null
}

/**
 * Plano de un edificio: una fila por piso, del ultimo al primero, con las
 * unidades como botones.
 *
 * Por que un plano y no una lista desplegable: elegir "Apto 302" en un menu
 * obliga a saber de memoria como se numeran las unidades del conjunto. Viendo
 * la fachada se reconoce el propio apartamento por su posicion, y de paso se
 * ve de un golpe cuantos quedan libres.
 *
 * Es solo presentacion: no consulta datos ni conoce el formulario.
 */
export function BuildingPlan({
  units,
  value,
  onSelect,
  buildingLabel,
  loading = false,
  emptyText = 'Este edificio todavia no tiene apartamentos registrados.',
}: {
  units: PlanUnit[]
  value?: string | null
  onSelect?: (unitId: string) => void
  buildingLabel?: string
  loading?: boolean
  emptyText?: string
}) {
  /** Pisos de mayor a menor, para que el plano se lea como una fachada. */
  const floors = useMemo(() => {
    const grouped = new Map<number, PlanUnit[]>()
    for (const unit of units) {
      const current = grouped.get(unit.floor)
      if (current) current.push(unit)
      else grouped.set(unit.floor, [unit])
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => b - a)
      .map(([floor, list]) => ({
        floor,
        units: [...list].sort((a, b) => a.number.localeCompare(b.number, 'es', { numeric: true })),
      }))
  }, [units])

  const availableCount = units.filter((unit) => unit.state === 'available').length

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 py-6">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Cubierta: da la lectura de "esto es un edificio" y nombra el bloque. */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-800 px-4 py-2.5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{buildingLabel ?? 'Plano del edificio'}</span>
          <span className="text-xs text-slate-300">
            {availableCount} de {units.length} disponible{availableCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 bg-slate-50 p-3">
        {floors.map(({ floor, units: floorUnits }) => (
          <div
            key={floor}
            role="group"
            aria-label={`Piso ${floor}`}
            className="flex items-stretch gap-2"
          >
            <div className="flex w-11 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-xs font-semibold text-slate-500">
              P{floor}
            </div>

            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {floorUnits.map((unit) => {
                const selectable = unit.state === 'available' && Boolean(onSelect)
                const selected = value === unit.id
                const style = STATE_STYLE[unit.state]

                const button = (
                  <button
                    type="button"
                    onClick={selectable ? () => onSelect?.(unit.id) : undefined}
                    disabled={!selectable}
                    aria-pressed={selected}
                    aria-label={`Apartamento ${unit.number}, piso ${floor}. ${unit.hint ?? style.label}`}
                    className={[
                      'flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5',
                      'rounded-lg border px-1 py-1.5 text-sm font-medium transition-colors',
                      selectable ? 'cursor-pointer' : 'cursor-not-allowed',
                      selected
                        ? 'border-brand-600 bg-brand-600 text-white shadow-elevated ring-2 ring-brand-200'
                        : style.box,
                    ].join(' ')}
                  >
                    <span className="leading-none">{unit.number}</span>
                    <span className="flex h-3.5 items-center leading-none">
                      {selected ? <Check size={13} /> : <StateIcon state={unit.state} />}
                    </span>
                  </button>
                )

                // El motivo solo aporta cuando explica por que NO se puede elegir.
                return unit.hint && !selectable ? (
                  <Tooltip key={unit.id} title={unit.hint}>
                    {button}
                  </Tooltip>
                ) : (
                  <span key={unit.id}>{button}</span>
                )
              })}
            </div>
          </div>
        ))}

        {/* Portal: cierra la fachada por abajo. */}
        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-slate-200/70 py-1.5 text-xs text-slate-500">
          <DoorOpen size={13} /> Porteria
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-2.5">
        {LEGEND.map((state) => (
          <span key={state} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-3 w-3 rounded border ${STATE_STYLE[state].box}`} />
            {STATE_STYLE[state].label}
          </span>
        ))}
      </div>
    </div>
  )
}

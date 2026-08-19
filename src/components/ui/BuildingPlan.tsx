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

interface StateStyle {
  /** Aspecto del boton de la unidad. */
  tile: string
  /** Color del cuadrado de la leyenda. */
  swatch: string
  label: string
}

const STATE_STYLE: Record<PlanUnitState, StateStyle> = {
  available: {
    tile: 'border-brand-200 bg-white text-slate-700 shadow-card hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-elevated',
    swatch: 'border-brand-200 bg-white',
    label: 'Disponible',
  },
  taken: {
    tile: 'border-slate-200 bg-slate-100 text-slate-400',
    swatch: 'border-slate-200 bg-slate-100',
    label: 'Ocupado',
  },
  pending: {
    tile: 'border-amber-200 bg-amber-50 text-amber-700',
    swatch: 'border-amber-200 bg-amber-50',
    label: 'En revision',
  },
  blocked: {
    tile: 'border-slate-200 bg-slate-50 text-slate-300',
    swatch: 'border-slate-200 bg-slate-50',
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
 * la fachada se reconoce el propio apartamento por su posicion, y de paso se ve
 * de un golpe cuantos quedan libres.
 *
 * El marco imita una fachada (remate de cubierta, muros laterales, portal al
 * pie) porque el reconocimiento es inmediato: sin esas pistas el mismo contenido
 * se lee como una tabla cualquiera.
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 py-6">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {/* Remate de cubierta: nombra el bloque y da la lectura de "edificio". */}
      {/*
        Sin adornos de azotea sobresaliendo: el marco lleva `overflow-hidden`,
        asi que cualquier elemento con desplazamiento negativo se recorta y solo
        queda markup invisible. La franja ya se lee como cubierta.
      */}
      <div className="bg-gradient-to-br from-slate-900 via-brand-900 to-brand-800 px-4 pb-3 pt-3.5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm font-semibold tracking-tight">
            {buildingLabel ?? 'Plano del edificio'}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-brand-50 ring-1 ring-inset ring-white/15">
            {availableCount} de {units.length} disponible{availableCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/*
        Muros laterales: los `border-x` de 6px encuadran las plantas y son lo que
        convierte una rejilla suelta en una fachada.
      */}
      <div className="border-x-[6px] border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-50 px-2.5 py-3">
        <div className="space-y-2">
          {floors.map(({ floor, units: floorUnits }) => (
            <div
              key={floor}
              role="group"
              aria-label={`Piso ${floor}`}
              className="flex items-stretch gap-2"
            >
              <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md bg-white/70 text-[11px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-200">
                <span className="leading-none">P{floor}</span>
              </div>

              <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
                {floorUnits.map((unit) => {
                  const selectable = unit.state === 'available' && Boolean(onSelect)
                  const selected = value === unit.id
                  const style = STATE_STYLE[unit.state]

                  const tile = (
                    <button
                      type="button"
                      onClick={selectable ? () => onSelect?.(unit.id) : undefined}
                      disabled={!selectable}
                      aria-pressed={selected}
                      aria-label={`Apartamento ${unit.number}, piso ${floor}. ${unit.hint ?? style.label}`}
                      className={[
                        'group relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1',
                        'rounded-lg border px-1 py-2 text-sm font-semibold transition-all duration-150',
                        selectable ? 'cursor-pointer' : 'cursor-not-allowed',
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white shadow-elevated ring-2 ring-brand-200'
                          : style.tile,
                      ].join(' ')}
                    >
                      {/* Ventana de la unidad: dos hojas y su division */}
                      <span
                        aria-hidden="true"
                        className={[
                          'flex h-2.5 w-6 overflow-hidden rounded-sm border',
                          selected
                            ? 'border-white/50 bg-white/25'
                            : unit.state === 'available'
                              ? 'border-brand-200 bg-brand-50'
                              : 'border-slate-300/70 bg-slate-200/60',
                        ].join(' ')}
                      >
                        <span
                          className={`w-1/2 border-r ${selected ? 'border-white/50' : 'border-slate-300/70'}`}
                        />
                      </span>

                      <span className="leading-none">{unit.number}</span>

                      <span className="flex h-3 items-center leading-none">
                        {selected ? <Check size={13} /> : <StateIcon state={unit.state} />}
                      </span>
                    </button>
                  )

                  // El motivo solo aporta cuando explica por que NO se puede elegir.
                  return unit.hint && !selectable ? (
                    <Tooltip key={unit.id} title={unit.hint}>
                      {tile}
                    </Tooltip>
                  ) : (
                    <span key={unit.id}>{tile}</span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Planta baja: cierra la fachada y ubica la entrada. */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-md bg-slate-800 py-2 text-xs font-medium text-slate-300">
          <DoorOpen size={13} /> Porteria
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 bg-white px-4 py-3">
        {LEGEND.map((state) => (
          <span key={state} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-3 w-3 rounded border ${STATE_STYLE[state].swatch}`} />
            {STATE_STYLE[state].label}
          </span>
        ))}
      </div>
    </div>
  )
}

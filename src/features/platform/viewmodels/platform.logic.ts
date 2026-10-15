import { PLAN_PERIOD } from '@/constants/enums'
import type { ListParams, PlatformCondominium } from '@/types/models'

export type PlanFilter = 'ACTIVE' | 'EXPIRED' | 'NONE'

/** Estado del plan de un conjunto para mostrar y filtrar. */
export function planState(condominium: PlatformCondominium): PlanFilter {
  if (!condominium.plan) return 'NONE'
  return condominium.plan.active ? 'ACTIVE' : 'EXPIRED'
}

export const PLAN_STATE_META: Record<PlanFilter, { label: string; color: string }> = {
  ACTIVE: { label: 'Al dia', color: 'green' },
  EXPIRED: { label: 'Vencido', color: 'red' },
  NONE: { label: 'Sin plan', color: 'default' },
}

export function planLabel(condominium: PlatformCondominium): string {
  return condominium.plan ? PLAN_PERIOD[condominium.plan.period].label : '—'
}

const SORTERS: Record<string, (a: PlatformCondominium, b: PlatformCondominium) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'es'),
  apartments: (a, b) => a.apartments - b.apartments,
  members: (a, b) => a.members - b.members,
  created_at: (a, b) => a.created_at.localeCompare(b.created_at),
}

/**
 * Busqueda, filtros, orden y paginacion en memoria: el resumen de la
 * plataforma trae todos los conjuntos en una sola consulta.
 */
export function queryCondominiums(rows: PlatformCondominium[], params: ListParams) {
  const term = params.search?.trim().toLowerCase() ?? ''
  const status = params.filters?.status
  const plan = params.filters?.plan

  let result = rows.filter((row) => {
    if (typeof status === 'string' && status && row.status !== status) return false
    if (typeof plan === 'string' && plan && planState(row) !== plan) return false
    if (!term) return true
    return [
      row.name,
      row.city ?? '',
      ...row.admins.flatMap((admin) => [admin.full_name, admin.email]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  const sorter = params.sortBy ? SORTERS[params.sortBy] : undefined
  if (sorter) {
    result = [...result].sort(sorter)
    if (params.sortDir === 'desc') result.reverse()
  }

  const start = (params.page - 1) * params.pageSize
  return { all: result, page: result.slice(start, start + params.pageSize), total: result.length }
}

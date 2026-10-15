import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTableParams } from '@/hooks/useTableParams'
import { usePlatformOverview } from '@/hooks/usePlatform'
import { CONDOMINIUM_STATUS, toOptions } from '@/constants/enums'
import { formatNumber } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { PlatformCondominium } from '@/types/models'
import {
  PLAN_STATE_META,
  planLabel,
  planState,
  queryCondominiums,
  type PlanFilter,
} from './platform.logic'

/**
 * ViewModel del panel de plataforma (solo SUPER_ADMIN): todos los conjuntos con
 * su tamano, administradores y estado del plan, y acceso directo a cada uno.
 */
export function usePlatformViewModel() {
  const { isSuperAdmin, setCurrentCondominium } = useAuth()
  const navigate = useNavigate()
  const table = useTableParams({ pageSize: 10, sortBy: 'name', sortDir: 'asc' })
  const query = usePlatformOverview(isSuperAdmin)

  const rows = query.data?.condominiums
  const result = useMemo(() => queryCondominiums(rows ?? [], table.params), [rows, table.params])
  const totals = query.data?.totals

  return {
    allowed: isSuperAdmin,
    stats: {
      loading: query.isLoading,
      condominiums: formatNumber(totals?.condominiums ?? 0),
      activeCondominiums: `${formatNumber(totals?.active_condominiums ?? 0)} activos`,
      apartments: formatNumber(totals?.apartments ?? 0),
      users: formatNumber(totals?.users ?? 0),
      upToDate: formatNumber(totals?.active_subscriptions ?? 0),
      withoutPlan: formatNumber(totals?.expired_or_none ?? 0),
    },
    table: {
      rows: result.page,
      total: result.total,
      loading: query.isFetching,
      isError: query.isError,
      errorMessage: query.error ? getErrorMessage(query.error) : undefined,
      retry: () => void query.refetch(),
      params: table.params,
      handlers: table,
      hasActiveFilters: table.hasActiveFilters,
      filters: [
        { key: 'status', label: 'Estado', options: toOptions(CONDOMINIUM_STATUS) },
        {
          key: 'plan',
          label: 'Plan',
          options: (Object.keys(PLAN_STATE_META) as PlanFilter[]).map((value) => ({
            value,
            label: PLAN_STATE_META[value].label,
          })),
        },
      ],
      exportFetcher: async () => result.all,
    },
    row: {
      plan: (condominium: PlatformCondominium) => ({
        ...PLAN_STATE_META[planState(condominium)],
        period: planLabel(condominium),
        endsAt: condominium.plan?.ends_at ?? null,
      }),
      status: (condominium: PlatformCondominium) => CONDOMINIUM_STATUS[condominium.status],
      admins: (condominium: PlatformCondominium) =>
        condominium.admins.length > 0
          ? condominium.admins.map((admin) => admin.full_name).join(', ')
          : 'Sin administrador',
    },
    /** Cambia al conjunto y abre su dashboard para configurarlo. */
    open: (condominium: PlatformCondominium) => {
      setCurrentCondominium(condominium.id)
      navigate('/dashboard')
    },
  }
}

export type PlatformViewModel = ReturnType<typeof usePlatformViewModel>

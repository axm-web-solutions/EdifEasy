import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useModuleAccess } from '@/hooks/useModules'
import { useResidentDashboard } from '@/hooks/useDashboard'
import { useActiveAlerts } from '@/hooks/useAlerts'
import type { ModuleKey } from '@/constants/modules'
import { formatCompactCurrency, formatNumber } from '@/utils/format'

export type QuickAccessKey = 'alerts' | 'requests' | 'messages' | 'fines' | 'apartment'

interface QuickAccess {
  key: QuickAccessKey
  title: string
  value: string
  footer?: string
  to: string
  module?: ModuleKey
}

/**
 * Lo personal del residente junto al feed: alertas importantes y accesos
 * rapidos con sus contadores. Solo aplica a propietarios y arrendatarios.
 */
export function useResidentSummaryViewModel() {
  const { currentCondominiumId, role } = useAuth()
  const { isModuleEnabled } = useModuleAccess()
  // Rol activo, no hasRole: hasRole siempre es true para el SUPER_ADMIN.
  const isResident = role === 'OWNER' || role === 'TENANT'

  const statsQuery = useResidentDashboard(isResident ? currentCondominiumId : null)
  const alertsQuery = useActiveAlerts(
    isResident && isModuleEnabled('alerts') ? currentCondominiumId : null,
    5,
  )
  const stats = statsQuery.data

  const criticalAlerts = useMemo(
    () =>
      (alertsQuery.data ?? [])
        .filter((alert) => alert.priority === 'CRITICAL' || alert.priority === 'HIGH')
        .map((alert) => ({
          id: alert.id,
          title: alert.title,
          description: alert.description.slice(0, 140),
        })),
    [alertsQuery.data],
  )

  const quickAccess = useMemo<QuickAccess[]>(() => {
    const items: QuickAccess[] = [
      {
        key: 'apartment',
        title: 'Mi apartamento',
        value: formatNumber(stats?.apartments?.length ?? 0),
        to: '/my-apartment',
      },
      {
        key: 'alerts',
        title: 'Alertas',
        value: formatNumber(stats?.active_alerts ?? 0),
        to: '/alerts',
        module: 'alerts',
      },
      {
        key: 'fines',
        title: 'Multas',
        value: formatNumber(stats?.pending_fines ?? 0),
        footer: formatCompactCurrency(stats?.pending_fines_amount ?? 0),
        to: '/fines',
        module: 'fines',
      },
      {
        key: 'requests',
        title: 'Solicitudes',
        value: formatNumber(stats?.open_requests ?? 0),
        to: '/requests',
        module: 'requests',
      },
      {
        key: 'messages',
        title: 'Mensajes',
        value: formatNumber(stats?.unread_messages ?? 0),
        to: '/messages',
        module: 'messages',
      },
    ]
    return items.filter((item) => !item.module || isModuleEnabled(item.module))
  }, [stats, isModuleEnabled])

  return {
    visible: isResident,
    loading: statsQuery.isLoading,
    criticalAlerts,
    quickAccess,
    showMarketplace: isModuleEnabled('marketplace'),
  }
}

export type ResidentSummaryViewModel = ReturnType<typeof useResidentSummaryViewModel>

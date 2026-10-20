import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useModuleAccess } from '@/hooks/useModules'
import { useResidentDashboard } from '@/hooks/useDashboard'
import { useActiveAlerts } from '@/hooks/useAlerts'
import { useMySurveyBallots, useSurveys } from '@/hooks/useSurveys'
import { noticeSignature } from './feed.logic'
import type { ModuleKey } from '@/constants/modules'
import { formatCompactCurrency, formatNumber } from '@/utils/format'

export type QuickAccessKey =
  | 'alerts'
  | 'requests'
  | 'reservations'
  | 'messages'
  | 'fines'
  | 'apartment'
  | 'surveys'
  | 'services'

const NOTICE_KEY = 'edifeasy:alerts-notice-dismissed'

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(NOTICE_KEY)
  } catch {
    return null
  }
}

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
  const { currentCondominiumId, role, user } = useAuth()
  const { isModuleEnabled } = useModuleAccess()
  // Rol activo, no hasRole: hasRole siempre es true para el SUPER_ADMIN.
  const isResident = role === 'OWNER' || role === 'TENANT'

  const statsQuery = useResidentDashboard(isResident ? currentCondominiumId : null)
  const alertsQuery = useActiveAlerts(
    isResident && isModuleEnabled('alerts') ? currentCondominiumId : null,
    5,
  )
  const surveysEnabled = isResident && isModuleEnabled('surveys')
  const surveysQuery = useSurveys(surveysEnabled ? currentCondominiumId : null)
  const ballotsQuery = useMySurveyBallots(surveysEnabled ? (user?.id ?? null) : null)
  const stats = statsQuery.data

  const pendingSurveys = useMemo(() => {
    const voted = new Set(ballotsQuery.data ?? [])
    const now = Date.now()
    return (surveysQuery.data ?? []).filter(
      (survey) =>
        survey.status === 'OPEN' &&
        !voted.has(survey.id) &&
        !(survey.closes_at && Date.parse(survey.closes_at) <= now),
    ).length
  }, [surveysQuery.data, ballotsQuery.data])

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
        key: 'reservations',
        title: 'Reservar zona comun',
        value: '',
        to: '/requests?tab=reservas',
        module: 'reservations',
      },
      {
        key: 'surveys',
        title: 'Encuestas',
        value: pendingSurveys > 0 ? formatNumber(pendingSurveys) : '',
        footer: pendingSurveys > 0 ? 'por votar' : undefined,
        to: '/surveys',
        module: 'surveys',
      },
      {
        key: 'services',
        title: 'Mapa y alrededores',
        value: '',
        footer: 'Servicios y contactos',
        to: '/nearby',
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
  }, [stats, isModuleEnabled, pendingSurveys])

  // Aviso suave de alertas: colapsado y descartable durante la sesion.
  const signature = noticeSignature(criticalAlerts.map((alert) => alert.id))
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)
  const [expanded, setExpanded] = useState(false)

  return {
    visible: isResident,
    condominiumId: currentCondominiumId,
    loading: statsQuery.isLoading,
    notice:
      criticalAlerts.length > 0 && dismissed !== signature
        ? {
            title:
              criticalAlerts.length === 1
                ? 'Hay un aviso importante del conjunto'
                : `Hay ${criticalAlerts.length} avisos importantes del conjunto`,
            alerts: criticalAlerts,
            expanded,
          }
        : null,
    toggleNotice: () => setExpanded((value) => !value),
    dismissNotice: () => {
      setDismissed(signature)
      try {
        sessionStorage.setItem(NOTICE_KEY, signature)
      } catch {
        // Sin almacenamiento: se descarta solo hasta recargar.
      }
    },
    quickAccess,
    showMarketplace: isModuleEnabled('marketplace'),
  }
}

export type ResidentSummaryViewModel = ReturnType<typeof useResidentSummaryViewModel>

import { useMemo, useState } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { HelpCircle, PlayCircle, RotateCcw } from 'lucide-react'
import { useTour } from '@/providers/TourProvider'
import { useAuth } from '@/hooks/useAuth'
import { TOURS, getRouteForTour, getTourIdForRoute } from '@/config/tours'
import { visibleNavPaths } from '@/constants/navigation'
import { useModuleAccess } from '@/hooks/useModules'

interface TourButtonProps {
  /** ID del tour a iniciar (si no se especifica, muestra el menú de todos los tours) */
  tourId?: string
  /** Clases CSS adicionales */
  className?: string
}

const TOUR_LABELS: Record<string, string> = {
  'dashboard-admin': 'Dashboard',
  'dashboard-resident': 'Dashboard',
  'dashboard-operational': 'Dashboard',
  condominiums: 'Condominios',
  buildings: 'Bloques',
  apartments: 'Apartamentos',
  users: 'Usuarios',
  approvals: 'Aprobaciones',
  residents: 'Residentes',
  visitors: 'Visitantes',
  alerts: 'Alertas',
  announcements: 'Comunicados',
  messages: 'Mensajes',
  requests: 'Solicitudes',
  incidents: 'Incidentes',
  fines: 'Multas',
  'admin-fees': 'Cuotas de administración',
  plans: 'Planes',
  platform: 'Plataforma',
  'platform-modules': 'Módulos por rol',
  expenses: 'Gastos',
  purchases: 'Compras',
  documents: 'Documentos',
  reports: 'Reportes',
  activity: 'Auditoría',
  settings: 'Configuración',
  'my-apartment': 'Mi Apartamento',
}

function tourLabel(tourId: string): string {
  return TOUR_LABELS[tourId] ?? tourId
}

/**
 * Boton de ayuda de la barra superior. Al elegir un tour lleva al usuario a la
 * pagina que explica y alli lo inicia (si ya esta en ella, arranca de una vez).
 * Solo lista las secciones a las que el rol activo tiene acceso.
 */
export function TourButton({ tourId, className }: TourButtonProps) {
  const { startTourForced, resetAllTours, isTourCompleted, requestTour } = useTour()
  const { role, hasRole, hasPermission } = useAuth()
  const { isModuleEnabled } = useModuleAccess()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const goToTour = (id: string) => {
    setOpen(false)
    const tour = TOURS.find((t) => t.id === id)
    const route = getRouteForTour(id)
    if (!tour || !route) return

    if (location.pathname === route) {
      startTourForced(tour)
      return
    }
    // `TourAutoStart` lo inicia cuando la pagina destino termine de cargar.
    requestTour(id)
    navigate(route)
  }

  const currentTourId = getTourIdForRoute(location.pathname, role)

  // Tours de las secciones visibles en el menu, en el mismo orden del menu.
  const availableTourIds = useMemo(() => {
    const paths = visibleNavPaths(hasRole, hasPermission, isModuleEnabled)
    const dashboardTour = getTourIdForRoute('/dashboard', role)
    return TOURS.map((tour) => tour.id).filter((id) => {
      if (id.startsWith('dashboard-')) return id === dashboardTour
      const route = getRouteForTour(id)
      return Boolean(route && paths.has(route))
    })
  }, [hasRole, hasPermission, role, isModuleEnabled])

  if (tourId) {
    if (!TOURS.some((t) => t.id === tourId)) return null
    return (
      <Tooltip title="Ver tour guiado">
        <Button
          type="text"
          icon={<HelpCircle size={18} />}
          onClick={() => goToTour(tourId)}
          className={className}
          aria-label="Iniciar tour guiado"
        />
      </Tooltip>
    )
  }

  const sectionItems = availableTourIds
    .filter((id) => id !== currentTourId)
    .map((id) => ({
      key: id,
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>{tourLabel(id)}</span>
          {isTourCompleted(id) ? <span className="text-xs text-green-600">✓</span> : null}
        </div>
      ),
      onClick: () => goToTour(id),
    }))

  const menuItems: MenuProps['items'] = [
    ...(currentTourId && availableTourIds.includes(currentTourId)
      ? [
          {
            key: `current-${currentTourId}`,
            icon: <PlayCircle size={14} />,
            label: <strong>Tour de esta página</strong>,
            onClick: () => goToTour(currentTourId),
          },
          { type: 'divider' as const },
        ]
      : []),
    {
      type: 'group' as const,
      key: 'sections',
      label: 'Ir a una sección y ver su tour',
      children: sectionItems,
    },
    { type: 'divider' as const },
    {
      key: 'reset',
      label: 'Reiniciar todos los tours',
      icon: <RotateCcw size={14} />,
      onClick: () => {
        resetAllTours()
        setOpen(false)
      },
    },
  ]

  return (
    <Dropdown
      menu={{ items: menuItems, style: { maxHeight: '70vh', overflowY: 'auto' } }}
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title="Tours guiados">
        <Button
          type="text"
          icon={<HelpCircle size={18} />}
          className={className}
          aria-label="Abrir menú de tours"
        />
      </Tooltip>
    </Dropdown>
  )
}

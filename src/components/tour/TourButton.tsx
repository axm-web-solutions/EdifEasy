import { useState } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import { HelpCircle, RotateCcw } from 'lucide-react'
import { useTour } from '@/providers/TourProvider'
import { TOURS } from '@/config/tours'
import type { TourConfig } from '@/hooks/useDriver'

interface TourButtonProps {
  /** ID del tour a iniciar (si no se especifica, muestra el menú de todos los tours) */
  tourId?: string
  /** Clases CSS adicionales */
  className?: string
}

export function TourButton({ tourId, className }: TourButtonProps) {
  const { startTourForced, resetAllTours, isTourCompleted } = useTour()
  const [open, setOpen] = useState(false)

  const handleSelectTour = (selectedTourId: string) => {
    const tour = TOURS.find((t) => t.id === selectedTourId)
    if (tour) {
      startTourForced(tour)
    }
    setOpen(false)
  }

  const handleResetTours = () => {
    resetAllTours()
    setOpen(false)
  }

  // Si se especifica un tourId, muestra un botón simple
  if (tourId) {
    const tour = TOURS.find((t) => t.id === tourId)
    if (!tour) return null

    return (
      <Tooltip title="Ver tour guiado">
        <Button
          type="text"
          icon={<HelpCircle size={18} />}
          onClick={() => startTourForced(tour)}
          className={className}
          aria-label="Iniciar tour guiado"
        />
      </Tooltip>
    )
  }

  // Si no se especifica tourId, muestra el menú de todos los tours
  const menuItems = [
    ...TOURS.map((tour) => ({
      key: tour.id,
      label: (
        <div className="flex items-center justify-between gap-2">
          <span>{getTourLabel(tour)}</span>
          {isTourCompleted(tour.id) && (
            <span className="text-xs text-green-600">✓</span>
          )}
        </div>
      ),
      onClick: () => handleSelectTour(tour.id),
    })),
    { type: 'divider' as const },
    {
      key: 'reset',
      label: 'Reiniciar todos los tours',
      icon: <RotateCcw size={14} />,
      onClick: handleResetTours,
    },
  ]

  return (
    <Dropdown
      menu={{ items: menuItems }}
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

function getTourLabel(tour: TourConfig): string {
  const labels: Record<string, string> = {
    'dashboard-admin': 'Dashboard Administrativo',
    'dashboard-resident': 'Dashboard Residente',
    'dashboard-operational': 'Dashboard Operativo',
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
    expenses: 'Gastos',
    purchases: 'Compras',
    documents: 'Documentos',
    reports: 'Reportes',
    activity: 'Auditoría',
    settings: 'Configuración',
    'my-apartment': 'Mi Apartamento',
  }
  return labels[tour.id] ?? tour.id
}

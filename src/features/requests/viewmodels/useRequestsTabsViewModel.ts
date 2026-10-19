import { useSearchParams } from 'react-router-dom'
import { useModuleAccess } from '@/hooks/useModules'

export type RequestsTab = 'solicitudes' | 'reservas'

/** Pestana activa de Solicitudes (en la URL: ?tab=reservas, para volver desde Wompi). */
export function useRequestsTabsViewModel() {
  const [params, setParams] = useSearchParams()
  const { isModuleEnabled } = useModuleAccess()
  const showReservations = isModuleEnabled('reservations')
  const tab: RequestsTab =
    showReservations && params.get('tab') === 'reservas' ? 'reservas' : 'solicitudes'

  return {
    tab,
    showReservations,
    setTab: (key: string) =>
      setParams(key === 'reservas' ? { tab: 'reservas' } : {}, { replace: true }),
  }
}

import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { ClassifiedsTab } from './classifieds.logic'

export type MarketplaceTab = 'clasificados' | 'mias' | 'revisar' | 'servicios'

/** Pestana activa del marketplace (en la URL: ?tab=, para los enlaces de las notificaciones). */
export function useMarketplaceTabsViewModel() {
  const [params, setParams] = useSearchParams()
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])

  const requested = params.get('tab') as MarketplaceTab | null
  const tab: MarketplaceTab =
    requested === 'mias' || requested === 'servicios' || (requested === 'revisar' && isAdmin)
      ? requested
      : 'clasificados'

  const classifiedsTab: ClassifiedsTab =
    tab === 'mias' ? 'mias' : tab === 'revisar' ? 'revisar' : 'explorar'

  return {
    tab,
    isAdmin,
    classifiedsTab,
    setTab: (key: string) =>
      setParams(key === 'clasificados' ? {} : { tab: key }, { replace: true }),
  }
}

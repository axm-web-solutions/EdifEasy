import { Badge, Tabs } from 'antd'
import { PageHeader } from '@/components/ui/PageHeader'
import { ClassifiedsPanel } from '../components/ClassifiedsPanel'
import { ServicesPanel } from '../components/ServicesPanel'
import { useClassifiedsViewModel } from '../viewmodels/useClassifiedsViewModel'
import { useMarketplaceTabsViewModel } from '../viewmodels/useMarketplaceTabsViewModel'

/**
 * Marketplace del conjunto: clasificados de los vecinos (moderados por la
 * administracion) y servicios cercanos (recomendados y del mapa).
 */
export function MarketplacePage() {
  const tabs = useMarketplaceTabsViewModel()
  const classifieds = useClassifiedsViewModel(tabs.classifiedsTab)

  return (
    <>
      <PageHeader
        title="Marketplace"
        subtitle="Compra, vende y arrienda entre vecinos, y encuentra servicios cerca del conjunto."
        dataTour="page-header"
      />

      <Tabs
        activeKey={tabs.tab}
        onChange={tabs.setTab}
        items={[
          { key: 'clasificados', label: 'Clasificados' },
          {
            key: 'mias',
            label: `Mis publicaciones${classifieds.myCount ? ` (${classifieds.myCount})` : ''}`,
          },
          ...(tabs.isAdmin
            ? [
                {
                  key: 'revisar',
                  label: (
                    <Badge count={classifieds.pendingCount} size="small" offset={[10, 0]}>
                      Por aprobar
                    </Badge>
                  ),
                },
              ]
            : []),
          { key: 'servicios', label: 'Servicios cercanos' },
        ]}
      />

      {tabs.tab === 'servicios' ? (
        <ServicesPanel />
      ) : (
        <ClassifiedsPanel vm={classifieds} tab={tabs.classifiedsTab} />
      )}
    </>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { NearbyPlacesCard } from '@/features/dashboard/components/NearbyPlacesCard'

/** Mapa del conjunto y sus alrededores, para todos los perfiles. */
export function NearbyPage() {
  const { currentCondominiumId, hasPermission } = useAuth()
  return (
    <div>
      <PageHeader
        title="Mapa y alrededores"
        subtitle="Comercios, emergencias y servicios cerca del conjunto, con telefono, WhatsApp y como llegar."
        dataTour="nearby-header"
      />
      <NearbyPlacesCard
        condominiumId={currentCondominiumId}
        editAddressPath={hasPermission('manageCondominium') ? '/settings' : undefined}
        dataTour="nearby-map"
      />
    </div>
  )
}

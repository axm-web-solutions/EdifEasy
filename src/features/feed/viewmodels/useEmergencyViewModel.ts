import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCondominium } from '@/hooks/useCondominiums'
import { useCondominiumPlaces } from '@/hooks/usePlaces'
import { useDirectory } from '@/hooks/useDirectory'
import { NATIONAL_EMERGENCY_LINES } from '@/constants/directory'
import { telHref } from '@/utils/phone'
import { nearestEmergencyPlaces, toEmergencyContacts } from './feed.logic'

/**
 * Tarjeta de emergencias del inicio:
 * 1. Numeros propios del conjunto (cuadrante de policia, porteria...).
 * 2. Lineas nacionales (123, 112, 119, 132...).
 * 3. Policia, hospitales y bomberos mas cercanos segun el mapa del conjunto.
 */
export function useEmergencyViewModel() {
  const { currentCondominiumId, hasRole } = useAuth()
  const condominiumQuery = useCondominium(currentCondominiumId)
  const placesQuery = useCondominiumPlaces(currentCondominiumId)
  const directoryQuery = useDirectory(currentCondominiumId)

  // Cada vista conserva su fila para abrirla en el formulario de edicion.
  const condoContacts = useMemo(() => {
    const contacts = directoryQuery.data ?? []
    const byId = new Map(contacts.map((contact) => [contact.id, contact]))
    return toEmergencyContacts(contacts).map((view) => ({ ...view, row: byId.get(view.id)! }))
  }, [directoryQuery.data])
  const nearby = useMemo(() => nearestEmergencyPlaces(placesQuery.data ?? []), [placesQuery.data])

  const condominium = condominiumQuery.data
  const city = condominium?.city ?? null

  return {
    loading: directoryQuery.isLoading || placesQuery.isLoading,
    /** Lineas que se muestran como botones grandes (123, 112, 119, 132). */
    primaryLines: NATIONAL_EMERGENCY_LINES.slice(0, 4).map((line) => ({
      ...line,
      href: telHref(line.number) as string,
    })),
    otherLines: NATIONAL_EMERGENCY_LINES.slice(4).map((line) => ({
      ...line,
      href: telHref(line.number) as string,
    })),
    condoContacts,
    nearby,
    nearbyTitle: city ? `Cerca del conjunto (${city})` : 'Cerca del conjunto',
    hasLocation: condominium?.latitude != null,
    canManage: hasRole(['ADMINISTRATOR', 'SUPER_ADMIN']),
  }
}

export type EmergencyViewModel = ReturnType<typeof useEmergencyViewModel>

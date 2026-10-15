import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useCondominium } from '@/hooks/useCondominiums'
import { useCondominiumPlaces, useRefreshCondominiumLocation } from '@/hooks/usePlaces'
import {
  PLACE_CATEGORIES,
  PLACES_MAX_AGE_DAYS,
  locationSourceKey,
  type NearbyPlace,
  type PlaceCategory,
} from '@/services/placesService'
import { getErrorMessage } from '@/lib/errors'

export const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
]

/** Cuantos lugares se listan como maximo (el mapa los muestra todos). */
export const LIST_LIMIT = 60

/**
 * Estados de la tarjeta:
 * - loading:          cargando datos o ubicando el conjunto por primera vez.
 * - no-address:       el conjunto no tiene direccion ni ciudad.
 * - pending-location: aun no esta ubicado y el usuario no puede ubicarlo.
 * - not-found:        el mapa no encontro la direccion.
 * - error:            fallo la consulta o la actualizacion.
 * - ready:            hay coordenadas para mostrar el mapa.
 */
export type NearbyPlacesStatus =
  'loading' | 'no-address' | 'pending-location' | 'not-found' | 'error' | 'ready'

export interface MapPoint {
  lat: number
  lon: number
  label: string
  approximate: boolean
}

/**
 * ViewModel de la tarjeta "Ubicacion y alrededores". La vista solo dibuja lo
 * que devuelve este hook (y maneja el mapa de Leaflet).
 *
 * Los datos salen de la base. Si quien mira es administrador del conjunto y la
 * ubicacion falta, cambio la direccion o los lugares tienen mas de 7 dias, se
 * actualizan automaticamente una vez por sesion.
 */
export function useNearbyPlacesViewModel(condominiumId: string | null) {
  const { hasPermission } = useAuth()
  const canRefresh = hasPermission('manageCondominium')

  const [radius, setRadius] = useState(1000)
  const [hidden, setHidden] = useState<Set<PlaceCategory>>(new Set())

  const condominiumQuery = useCondominium(condominiumId)
  const placesQuery = useCondominiumPlaces(condominiumId)
  const refresh = useRefreshCondominiumLocation()

  const condominium = condominiumQuery.data ?? null
  const hasAddress = Boolean(condominium?.address || condominium?.city)

  // Memorizado: la vista recrea el mapa de Leaflet cuando cambia el punto.
  const latitude = condominium?.latitude ?? null
  const longitude = condominium?.longitude ?? null
  const label = condominium?.location_label ?? ''
  const approximate = condominium?.location_approximate ?? false
  const point = useMemo<MapPoint | null>(
    () =>
      latitude !== null && longitude !== null
        ? { lat: Number(latitude), lon: Number(longitude), label, approximate }
        : null,
    [latitude, longitude, label, approximate],
  )

  const addressChanged = Boolean(
    condominium && point && condominium.location_source !== locationSourceKey(condominium),
  )
  const placesStale =
    !condominium?.places_updated_at ||
    dayjs().diff(dayjs(condominium.places_updated_at), 'day') >= PLACES_MAX_AGE_DAYS
  const needsRefresh = Boolean(
    condominium && hasAddress && (!point || addressChanged || placesStale),
  )

  // Actualizacion automatica: una sola vez por conjunto en la sesion.
  const attempted = useRef<string | null>(null)
  useEffect(() => {
    if (!canRefresh || !condominium || !needsRefresh) return
    if (attempted.current === condominium.id || refresh.isPending) return
    attempted.current = condominium.id
    refresh.mutate({ condominium, regeocode: !point || addressChanged })
  }, [canRefresh, condominium, needsRefresh, point, addressChanged, refresh])

  const placesInRadius = useMemo(
    () => (placesQuery.data ?? []).filter((place) => place.distance <= radius),
    [placesQuery.data, radius],
  )
  const visiblePlaces = useMemo(
    () => placesInRadius.filter((place) => !hidden.has(place.category)),
    [placesInRadius, hidden],
  )
  const categories = useMemo(() => {
    const counts = new Map<PlaceCategory, number>()
    for (const place of placesInRadius)
      counts.set(place.category, (counts.get(place.category) ?? 0) + 1)
    return (Object.keys(PLACE_CATEGORIES) as PlaceCategory[])
      .filter((category) => counts.has(category))
      .map((category) => ({
        category,
        label: PLACE_CATEGORIES[category].label,
        color: PLACE_CATEGORIES[category].hex,
        count: counts.get(category) ?? 0,
        active: !hidden.has(category),
      }))
  }, [placesInRadius, hidden])

  let status: NearbyPlacesStatus
  if (condominiumQuery.isLoading || placesQuery.isLoading) status = 'loading'
  else if (!hasAddress) status = 'no-address'
  else if (refresh.data === 'not-found' && !point) status = 'not-found'
  else if (point) status = 'ready'
  else if (refresh.isPending) status = 'loading'
  else if (refresh.isError || condominiumQuery.isError) status = 'error'
  else status = canRefresh ? 'loading' : 'pending-location'

  const errorMessage = refresh.error
    ? getErrorMessage(refresh.error)
    : placesQuery.error
      ? getErrorMessage(placesQuery.error)
      : null

  return {
    status,
    condominiumName: condominium?.name ?? 'Condominio',
    condominiumAddress: condominium?.address ?? point?.label ?? '',
    point,
    radius,
    radiusOptions: RADIUS_OPTIONS,
    setRadius,
    categories,
    toggleCategory: (category: PlaceCategory, active: boolean) =>
      setHidden((current) => {
        const next = new Set(current)
        if (active) next.delete(category)
        else next.add(category)
        return next
      }),
    visiblePlaces,
    listedPlaces: visiblePlaces.slice(0, LIST_LIMIT) as NearbyPlace[],
    hiddenFromList: Math.max(0, visiblePlaces.length - LIST_LIMIT),
    placesError: placesQuery.isError,
    retryPlaces: () => void placesQuery.refetch(),
    directionsUrl: point
      ? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`
      : null,
    canRefresh,
    refreshing: refresh.isPending,
    refreshError: refresh.isError ? errorMessage : null,
    refreshNow: () => {
      if (condominium) refresh.mutate({ condominium, regeocode: addressChanged || !point })
    },
    relocate: () => {
      if (condominium) refresh.mutate({ condominium, regeocode: true })
    },
    placesUpdatedAt: condominium?.places_updated_at ?? null,
  }
}

export type NearbyPlacesViewModel = ReturnType<typeof useNearbyPlacesViewModel>

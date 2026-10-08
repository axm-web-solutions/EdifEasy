import { useQuery } from '@tanstack/react-query'
import { placesService } from '@/services/placesService'
import { queryKeys } from '@/lib/queryKeys'
import type { CondominiumRow } from '@/types/database'

const DAY = 24 * 60 * 60 * 1000

/** Coordenadas del condominio a partir de su direccion registrada. */
export function useCondominiumLocation(condominium: CondominiumRow | null | undefined) {
  const location = {
    address: condominium?.address ?? null,
    city: condominium?.city ?? null,
    country: condominium?.country ?? null,
  }
  const key = [location.address, location.city, location.country].filter(Boolean).join(', ')

  return useQuery({
    queryKey: queryKeys.places.geocode(key),
    queryFn: ({ signal }) => placesService.geocode(location, signal),
    enabled: Boolean(key),
    staleTime: 7 * DAY,
    gcTime: 7 * DAY,
    retry: 1,
  })
}

/** Comercios y servicios alrededor de un punto. */
export function useNearbyPlaces(
  center: { lat: number; lon: number } | null | undefined,
  radius: number,
) {
  return useQuery({
    queryKey: queryKeys.places.nearby(center?.lat ?? 0, center?.lon ?? 0, radius),
    queryFn: ({ signal }) =>
      placesService.nearby(center as { lat: number; lon: number }, radius, signal),
    enabled: Boolean(center),
    staleTime: DAY,
    gcTime: DAY,
    retry: 1,
  })
}

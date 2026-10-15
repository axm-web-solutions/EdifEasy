import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  NEARBY_FETCH_RADIUS,
  locationSourceKey,
  placesService,
  type GeoPoint,
} from '@/services/placesService'
import { queryKeys } from '@/lib/queryKeys'
import type { CondominiumRow } from '@/types/database'

/** Lugares cercanos guardados en la base (no consulta OpenStreetMap). */
export function useCondominiumPlaces(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.places.cached(condominiumId ?? ''),
    queryFn: () => placesService.listCached(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export type RefreshLocationResult = 'saved' | 'not-found'

/**
 * Ubica el conjunto (si no tiene coordenadas o cambio la direccion), consulta
 * sus lugares cercanos en OpenStreetMap y guarda todo en la base. Lo ejecuta
 * la sesion de un administrador; es la unica via que llama a OpenStreetMap.
 */
export function useRefreshCondominiumLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    // Los errores se muestran en la tarjeta del mapa, no como notificacion global.
    meta: { silent: true },
    mutationFn: async ({
      condominium,
      regeocode,
    }: {
      condominium: CondominiumRow
      regeocode: boolean
    }): Promise<RefreshLocationResult> => {
      const source = locationSourceKey(condominium)
      let location: (GeoPoint & { source: string }) | null = null
      let center: { lat: number; lon: number } | null =
        condominium.latitude !== null && condominium.longitude !== null
          ? { lat: Number(condominium.latitude), lon: Number(condominium.longitude) }
          : null

      if (regeocode || !center) {
        const point = await placesService.geocode(condominium)
        if (!point) return 'not-found'
        location = { ...point, source }
        center = point
      }

      const places = await placesService.nearby(center, NEARBY_FETCH_RADIUS)
      await placesService.saveLocation(condominium.id, location, places)
      return 'saved'
    },
    onSuccess: (_result, { condominium }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.condominiums.detail(condominium.id),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.places.cached(condominium.id) })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listingService } from '@/services/listingService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'

export function useListings(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.listings.list(condominiumId ?? ''),
    queryFn: () => listingService.list(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

/** URLs firmadas de las fotos (se renuevan antes de que venzan). */
export function useListingImageUrls(paths: string[]) {
  const sorted = [...new Set(paths)].sort()
  return useQuery({
    queryKey: queryKeys.listings.images(sorted.join('|')),
    queryFn: () => listingService.imageUrls(sorted),
    enabled: sorted.length > 0,
    staleTime: 45 * 60_000,
    meta: { silent: true },
  })
}

export function useListingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['listings'] })

  return {
    create: useMutation({
      mutationFn: (values: TablesInsert<'marketplace_listings'>) => listingService.create(values),
      onSuccess: (row) => {
        notify.success(
          row.status === 'APPROVED' ? 'Publicado' : 'Enviado a aprobacion de la administracion',
        )
        invalidate()
      },
    }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'marketplace_listings'> }) =>
        listingService.update(id, values),
      onSuccess: (row) => {
        notify.success(
          row.status === 'PENDING' ? 'Cambios enviados a aprobacion' : 'Publicacion actualizada',
        )
        invalidate()
      },
    }),
    remove: useMutation({
      mutationFn: (listing: Parameters<typeof listingService.remove>[0]) =>
        listingService.remove(listing),
      onSuccess: () => {
        notify.success('Publicacion eliminada')
        invalidate()
      },
    }),
    review: useMutation({
      mutationFn: (input: { id: string; approve: boolean; notes: string | null }) =>
        listingService.review(input.id, input.approve, input.notes),
      onSuccess: (status) => {
        notify.success(status === 'APPROVED' ? 'Publicacion aprobada' : 'Publicacion rechazada')
        invalidate()
      },
    }),
  }
}

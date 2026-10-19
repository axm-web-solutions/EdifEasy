import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { announcementService } from '@/services/announcementService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useAnnouncements(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.announcements.list(condominiumId ?? '', params),
    queryFn: () => announcementService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}


/** Feed paginado ("Cargar mas"). */
export function useFeed(condominiumId: string | null, pageSize = 10) {
  return useInfiniteQuery({
    queryKey: queryKeys.announcements.feed(condominiumId ?? ''),
    queryFn: ({ pageParam }) =>
      announcementService.listFeed(condominiumId as string, pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length : undefined),
    enabled: Boolean(condominiumId),
  })
}

export function useAnnouncementMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['announcements'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'announcements'>) => announcementService.create(values),
    onSuccess: () => {
      notify.success('Comunicado guardado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'announcements'> }) =>
      announcementService.update(id, values),
    onSuccess: () => {
      notify.success('Comunicado actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => announcementService.remove(id),
    onSuccess: () => {
      notify.success('Comunicado eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

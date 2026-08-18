import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestService } from '@/services/requestService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useRequests(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.requests.list(condominiumId ?? '', params),
    queryFn: () => requestService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useRecentRequests(condominiumId: string | null, limit = 5) {
  return useQuery({
    queryKey: queryKeys.requests.recent(condominiumId ?? ''),
    queryFn: () => requestService.listRecent(condominiumId as string, limit),
    enabled: Boolean(condominiumId),
  })
}


export function useRequestComments(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.requests.comments(requestId ?? ''),
    queryFn: () => requestService.comments(requestId as string),
    enabled: Boolean(requestId),
  })
}

export function useRequestMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['requests'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'requests'>) => requestService.create(values),
    onSuccess: () => {
      notify.success('Solicitud creada')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'requests'> }) =>
      requestService.update(id, values),
    onSuccess: () => {
      notify.success('Solicitud actualizada')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => requestService.remove(id),
    onSuccess: () => {
      notify.success('Solicitud eliminada')
      invalidate()
    },
  })

  const addComment = useMutation({
    mutationFn: (values: TablesInsert<'request_comments'>) => requestService.addComment(values),
    onSuccess: (_data, variables) => {
      notify.success('Comentario agregado')
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.comments(variables.request_id),
      })
    },
  })

  return { create, update, remove, addComment }
}

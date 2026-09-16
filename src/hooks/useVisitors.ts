import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { visitorService } from '@/services/visitorService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate, VisitorStatus } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useVisitors(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.visitors.list(condominiumId ?? '', params),
    queryFn: () => visitorService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useRecentVisitors(condominiumId: string | null, limit = 10) {
  return useQuery({
    queryKey: queryKeys.visitors.recent(condominiumId ?? ''),
    queryFn: () => visitorService.listRecent(condominiumId as string, limit),
    enabled: Boolean(condominiumId),
  })
}

export function useVisitorMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['visitors'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'visitors'>) => visitorService.create(values),
    onSuccess: () => {
      notify.success('Visitante registrado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'visitors'> }) =>
      visitorService.update(id, values),
    onSuccess: () => {
      notify.success('Visitante actualizado')
      invalidate()
    },
  })

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VisitorStatus }) =>
      visitorService.changeStatus(id, status),
    onSuccess: () => {
      notify.success('Estado del visitante actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => visitorService.remove(id),
    onSuccess: () => {
      notify.success('Visitante eliminado')
      invalidate()
    },
  })

  return { create, update, changeStatus, remove }
}
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { incidentService } from '@/services/incidentService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useIncidents(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.incidents.list(condominiumId ?? '', params),
    queryFn: () => incidentService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useRecentIncidents(condominiumId: string | null, limit = 5) {
  return useQuery({
    queryKey: queryKeys.incidents.recent(condominiumId ?? ''),
    queryFn: () => incidentService.listRecent(condominiumId as string, limit),
    enabled: Boolean(condominiumId),
  })
}


export function useIncidentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['incidents'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'incidents'>) => incidentService.create(values),
    onSuccess: () => {
      notify.success('Incidente registrado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'incidents'> }) =>
      incidentService.update(id, values),
    onSuccess: () => {
      notify.success('Incidente actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => incidentService.remove(id),
    onSuccess: () => {
      notify.success('Incidente eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

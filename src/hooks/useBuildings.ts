import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buildingService } from '@/services/buildingService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useBuildings(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.buildings.list(condominiumId ?? '', params),
    queryFn: () => buildingService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useAllBuildings(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.buildings.all(condominiumId ?? ''),
    queryFn: () => buildingService.listAll(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 120_000,
  })
}

export function useBuildingsWithCounts(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.buildings.withCounts(condominiumId ?? ''),
    queryFn: () => buildingService.listWithCounts(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useBuildingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['buildings'] })
    void queryClient.invalidateQueries({ queryKey: ['apartments'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'buildings'>) => buildingService.create(values),
    onSuccess: () => {
      notify.success('Bloque creado correctamente')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'buildings'> }) =>
      buildingService.update(id, values),
    onSuccess: () => {
      notify.success('Bloque actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => buildingService.remove(id),
    onSuccess: () => {
      notify.success('Bloque eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

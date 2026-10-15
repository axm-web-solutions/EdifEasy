import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fineService } from '@/services/fineService'
import { queryKeys } from '@/lib/queryKeys'
import { toSummaryFilters } from '@/services/query'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useFines(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.fines.list(condominiumId ?? '', params),
    queryFn: () => fineService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

/** Totales de las multas con los filtros de la tabla (sin paginar). */
export function useFinesSummary(condominiumId: string | null, params: ListParams) {
  const filters = toSummaryFilters(params)
  return useQuery({
    queryKey: queryKeys.fines.summary(condominiumId ?? '', filters),
    queryFn: () => fineService.summary(condominiumId as string, filters),
    enabled: Boolean(condominiumId),
  })
}

export function useFinesByApartment(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.fines.byApartment(apartmentId ?? ''),
    queryFn: () => fineService.listByApartment(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}


export function useFineMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['fines'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'fines'>) => fineService.create(values),
    onSuccess: () => {
      notify.success('Multa registrada')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'fines'> }) =>
      fineService.update(id, values),
    onSuccess: () => {
      notify.success('Multa actualizada')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => fineService.remove(id),
    onSuccess: () => {
      notify.success('Multa eliminada')
      invalidate()
    },
  })

  return { create, update, remove }
}

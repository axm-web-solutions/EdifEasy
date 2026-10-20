import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logbookService } from '@/services/logbookService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert } from '@/types/database'

export function useLogbook(condominiumId: string | null, from: string) {
  return useQuery({
    queryKey: queryKeys.logbook.list(condominiumId ?? '', from),
    queryFn: () => logbookService.list(condominiumId as string, from),
    enabled: Boolean(condominiumId),
    // La porteria la consulta todo el turno: se refresca cada minuto.
    refetchInterval: 60_000,
  })
}

export function useLogbookMutations() {
  const queryClient = useQueryClient()
  return {
    create: useMutation({
      mutationFn: (values: TablesInsert<'guard_log_entries'>) => logbookService.create(values),
      onSuccess: () => {
        notify.success('Anotacion registrada en la minuta')
        void queryClient.invalidateQueries({ queryKey: ['logbook'] })
      },
    }),
  }
}

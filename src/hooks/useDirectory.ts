import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { directoryService } from '@/services/directoryService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'

export function useDirectory(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.directory.list(condominiumId ?? ''),
    queryFn: () => directoryService.list(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 5 * 60_000,
  })
}

export function useDirectoryMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['directory'] })

  const create = useMutation({
    mutationFn: (values: TablesInsert<'community_contacts'>) => directoryService.create(values),
    onSuccess: () => {
      notify.success('Contacto agregado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'community_contacts'> }) =>
      directoryService.update(id, values),
    onSuccess: () => {
      notify.success('Contacto actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => directoryService.remove(id),
    onSuccess: () => {
      notify.success('Contacto eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

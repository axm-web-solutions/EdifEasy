import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { condominiumService } from '@/services/condominiumService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useCondominiums(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.condominiums.list(params),
    queryFn: () => condominiumService.list(params),
  })
}


export function useCondominium(id: string | null) {
  return useQuery({
    queryKey: queryKeys.condominiums.detail(id ?? ''),
    queryFn: () => condominiumService.getById(id as string),
    enabled: Boolean(id),
  })
}

export function useCondominiumMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
    void queryClient.invalidateQueries({ queryKey: ['user-context'] })
    // Sin esto, un condominio recien creado no aparece en el selector del
    // SUPER_ADMIN hasta recargar la pagina (usa su propia clave de cache).
    void queryClient.invalidateQueries({ queryKey: ['super-admin-condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'condominiums'>) => condominiumService.create(values),
    onSuccess: () => {
      notify.success('Condominio creado correctamente')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'condominiums'> }) =>
      condominiumService.update(id, values),
    onSuccess: () => {
      notify.success('Condominio actualizado')
      invalidate()
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => condominiumService.deactivate(id),
    onSuccess: () => {
      notify.success('Condominio desactivado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => condominiumService.remove(id),
    onSuccess: () => {
      notify.success('Condominio eliminado')
      invalidate()
    },
  })

  return { create, update, deactivate, remove }
}

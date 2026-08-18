import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { purchaseService, type PurchaseItemInput } from '@/services/purchaseService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function usePurchases(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.purchases.list(condominiumId ?? '', params),
    queryFn: () => purchaseService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}


export function usePurchaseMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['purchases'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: ({
      values,
      items,
    }: {
      values: TablesInsert<'purchases'>
      items: PurchaseItemInput[]
    }) => purchaseService.create(values, items),
    onSuccess: () => {
      notify.success('Compra registrada')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({
      id,
      values,
      items,
    }: {
      id: string
      values: TablesUpdate<'purchases'>
      items: PurchaseItemInput[]
    }) => purchaseService.update(id, values, items),
    onSuccess: () => {
      notify.success('Compra actualizada')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => purchaseService.remove(id),
    onSuccess: () => {
      notify.success('Compra eliminada')
      invalidate()
    },
  })

  return { create, update, remove }
}

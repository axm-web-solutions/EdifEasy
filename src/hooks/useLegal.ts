import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { legalService } from '@/services/legalService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { LegalDocumentKey, LegalEntity } from '@/features/legal/legal.logic'
import type { DataRequestStatus, DataRequestType } from '@/types/database'

export function useLegalEntity() {
  return useQuery({
    queryKey: queryKeys.legal.entity,
    queryFn: () => legalService.getEntity(),
    staleTime: 10 * 60_000,
  })
}

export function useMyAcceptances(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.legal.acceptances(userId ?? ''),
    queryFn: () => legalService.myAcceptances(userId as string),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  })
}

export function useDataRequests(scope: 'mine' | 'all', enabled = true) {
  return useQuery({
    queryKey: queryKeys.legal.requests(scope),
    queryFn: () => legalService.listRequests(),
    enabled,
  })
}

export function useSellerRegistry(listingId: string | null) {
  return useQuery({
    queryKey: queryKeys.legal.seller(listingId ?? ''),
    queryFn: () => legalService.sellerRegistry(listingId as string),
    enabled: Boolean(listingId),
  })
}

export function useLegalMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['legal'] })

  return {
    accept: useMutation({
      mutationFn: ({ documents, version }: { documents: LegalDocumentKey[]; version: string }) =>
        legalService.accept(documents, version),
      onSuccess: invalidate,
    }),
    updateEntity: useMutation({
      mutationFn: (entity: LegalEntity) => legalService.updateEntity(entity),
      onSuccess: () => {
        notify.success('Datos legales guardados')
        invalidate()
      },
    }),
    createRequest: useMutation({
      mutationFn: ({ type, details }: { type: DataRequestType; details: string | null }) =>
        legalService.createRequest(type, details),
      onSuccess: () => {
        notify.success('Solicitud radicada. Te responderemos dentro del plazo legal.')
        invalidate()
      },
    }),
    resolveRequest: useMutation({
      mutationFn: (input: { id: string; status: DataRequestStatus; response: string }) =>
        legalService.resolveRequest(input.id, input.status, input.response),
      onSuccess: () => {
        notify.success('Solicitud actualizada')
        invalidate()
      },
    }),
    exportData: useMutation({
      mutationFn: () => legalService.exportMyData(),
    }),
  }
}

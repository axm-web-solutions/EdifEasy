import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { registrationService } from '@/services/registrationService'
import { notify } from '@/lib/notify'
import type { RegistrationStatus } from '@/types/database'

/** Solicitudes de inscripcion pendientes de revision del condominio activo. */
export function useRegistrationRequests(
  condominiumId: string | null,
  status: RegistrationStatus | 'ALL' = 'PENDING',
) {
  return useQuery({
    queryKey: ['registration-requests', condominiumId, status],
    queryFn: () => registrationService.forReview(condominiumId as string, status),
    enabled: Boolean(condominiumId),
    refetchInterval: 60_000,
  })
}

/** Contador de solicitudes pendientes (para el badge del menu). */
export function usePendingRegistrationCount(condominiumId: string | null) {
  const query = useRegistrationRequests(condominiumId, 'PENDING')
  return query.data?.length ?? 0
}

export function useRegistrationReviewMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['registration-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['members'] })
    void queryClient.invalidateQueries({ queryKey: ['residents'] })
    void queryClient.invalidateQueries({ queryKey: ['apartments'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const approve = useMutation({
    mutationFn: (input: { requestId: string; notes?: string }) =>
      registrationService.approve(input.requestId, input.notes),
    onSuccess: () => {
      notify.success('Solicitud aprobada. El usuario ya tiene acceso.')
      invalidate()
    },
  })

  const reject = useMutation({
    mutationFn: (input: { requestId: string; reason: string }) =>
      registrationService.reject(input.requestId, input.reason),
    onSuccess: () => {
      notify.success('Solicitud rechazada. Se notifico al usuario.')
      invalidate()
    },
  })

  return { approve, reject }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  invitationService,
  type CreateInvitationInput,
  type InvitationStatus,
} from '@/services/invitationService'
import { notify } from '@/lib/notify'

export function useInvitations(
  condominiumId: string | null,
  status: InvitationStatus | 'ALL' = 'PENDING',
) {
  return useQuery({
    queryKey: ['invitations', condominiumId, status],
    queryFn: () => invitationService.list(condominiumId as string, status),
    enabled: Boolean(condominiumId),
  })
}

export function useInvitationMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['invitations'] })
    void queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  const create = useMutation({
    mutationFn: (input: CreateInvitationInput) => invitationService.create(input),
    onSuccess: (result) => {
      notify.success(
        result.user_exists
          ? `Invitacion creada. ${result.email} obtendra el acceso al iniciar sesion.`
          : `Invitacion creada. ${result.email} debe registrarse en /register con ese correo.`,
      )
      invalidate()
    },
  })

  const revoke = useMutation({
    mutationFn: (invitationId: string) => invitationService.revoke(invitationId),
    onSuccess: () => {
      notify.success('Invitacion revocada')
      invalidate()
    },
  })

  return { create, revoke }
}

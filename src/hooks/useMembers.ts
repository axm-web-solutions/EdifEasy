import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService, type InviteMemberInput } from '@/services/userService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { RoleCode, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useMembers(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.members.list(condominiumId ?? '', params),
    queryFn: () => userService.listMembers(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useAllMembers(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.members.all(condominiumId ?? ''),
    queryFn: () => userService.listAllMembers(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 120_000,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.members.roles,
    queryFn: () => userService.roles(),
    staleTime: 10 * 60_000,
  })
}

export function useMemberMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['members'] })
    void queryClient.invalidateQueries({ queryKey: ['user-context'] })
  }

  const addByEmail = useMutation({
    mutationFn: (input: {
      condominiumId: string
      email: string
      roleCode: RoleCode
      position?: string | null
    }) =>
      userService.addMemberByEmail(input.condominiumId, input.email, input.roleCode, input.position),
    onSuccess: () => {
      notify.success('Usuario vinculado al condominio')
      invalidate()
    },
  })

  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => userService.inviteMember(input),
    onSuccess: (result) => {
      notify.success(
        result.invited ? 'Invitacion enviada por correo' : 'Usuario vinculado al condominio',
      )
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'condominium_members'> }) =>
      userService.updateMember(id, values),
    onSuccess: () => {
      notify.success('Usuario actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => userService.removeMember(id),
    onSuccess: () => {
      notify.success('Usuario removido del condominio')
      invalidate()
    },
  })

  return { addByEmail, invite, update, remove }
}

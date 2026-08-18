import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { RoleCode } from '@/types/database'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface Invitation {
  id: string
  email: string
  status: InvitationStatus
  position: string | null
  role_code: RoleCode
  role_name: string
  apartment_id: string | null
  apartment_number: string | null
  building_number: string | null
  invited_by_name: string | null
  accepted_by_name: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
  /** true si ya existe una cuenta con ese correo (entrara al iniciar sesion). */
  user_exists: boolean
}

export interface CreateInvitationInput {
  condominiumId: string
  email: string
  roleCode: RoleCode
  position?: string | null
  apartmentId?: string | null
}

/**
 * Invitaciones: la via para que un SUPER_ADMIN o un ADMINISTRATOR de un
 * condominio de de alta usuarios sin exponer la clave secreta ni depender de
 * Edge Functions. La invitacion se convierte en membresia activa cuando la
 * persona inicia sesion con ese correo.
 */
export const invitationService = {
  async list(
    condominiumId: string,
    status: InvitationStatus | 'ALL' = 'PENDING',
  ): Promise<Invitation[]> {
    const { data, error } = await supabase.rpc('invitations_for_condominium', {
      p_condominium: condominiumId,
      p_status: status,
    })
    if (error) throw toAppError(error)
    return (data as unknown as Invitation[]) ?? []
  },

  async create(
    input: CreateInvitationInput,
  ): Promise<{ ok: boolean; invitation_id: string; email: string; user_exists: boolean }> {
    const { data, error } = await supabase.rpc('create_invitation', {
      p_condominium: input.condominiumId,
      p_email: input.email,
      p_role_code: input.roleCode,
      p_position: input.position ?? null,
      p_apartment: input.apartmentId ?? null,
    })
    if (error) throw toAppError(error)
    return data as unknown as {
      ok: boolean
      invitation_id: string
      email: string
      user_exists: boolean
    }
  },

  async revoke(invitationId: string): Promise<void> {
    const { error } = await supabase.rpc('revoke_invitation', { p_invitation: invitationId })
    if (error) throw toAppError(error)
  },

  /**
   * Convierte en membresias activas las invitaciones pendientes que coincidan
   * con el correo del usuario autenticado. Se llama al iniciar sesion.
   */
  async claimMine(): Promise<number> {
    const { data, error } = await supabase.rpc('claim_my_invitations')
    if (error) throw toAppError(error)
    return (data as unknown as { claimed?: number } | null)?.claimed ?? 0
  },
}

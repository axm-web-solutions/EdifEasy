import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { ProfileRow, RoleCode, RoleRow, TablesUpdate } from '@/types/database'
import type { ListParams, ListResult, MemberWithRelations } from '@/types/models'

const MEMBER_SELECT =
  '*, profile:profiles(id, full_name, email, avatar_url, phone), role:roles(id, code, name, level)'

export interface InviteMemberInput {
  condominiumId: string
  email: string
  fullName: string
  roleCode: RoleCode
  phone?: string | null
  documentNumber?: string | null
  position?: string | null
}

export const userService = {
  /** Miembros del condominio (usuarios + rol). */
  async listMembers(condominiumId: string, params: ListParams): Promise<ListResult<MemberWithRelations>> {
    const query = supabase
      .from('condominium_members')
      .select(MEMBER_SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<MemberWithRelations>(query, params, {
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  async listAllMembers(condominiumId: string): Promise<MemberWithRelations[]> {
    const { data, error } = await supabase
      .from('condominium_members')
      .select(MEMBER_SELECT)
      .eq('condominium_id', condominiumId)
      .eq('status', 'ACTIVE')
      .returns<MemberWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  /** Miembros filtrados por rol: util para asignar solicitudes o incidentes. */
  async listByRole(condominiumId: string, roleCodes: RoleCode[]): Promise<MemberWithRelations[]> {
    const members = await userService.listAllMembers(condominiumId)
    return members.filter((member) => member.role && roleCodes.includes(member.role.code))
  },

  async roles(): Promise<RoleRow[]> {
    const { data, error } = await supabase.from('roles').select('*').order('level', { ascending: false })
    if (error) throw toAppError(error)
    return data
  },

  async getProfile(id: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async updateProfile(id: string, values: TablesUpdate<'profiles'>): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  /** Busca un usuario ya registrado por email exacto (RPC controlado por RLS). */
  async findByEmail(email: string) {
    const { data, error } = await supabase.rpc('find_profile_by_email', { p_email: email })
    if (error) throw toAppError(error)
    return data?.[0] ?? null
  },

  /** Vincula un usuario existente al condominio con un rol. */
  async addMemberByEmail(
    condominiumId: string,
    email: string,
    roleCode: RoleCode,
    position?: string | null,
  ): Promise<string> {
    const { data, error } = await supabase.rpc('add_member_by_email', {
      p_condominium: condominiumId,
      p_email: email,
      p_role_code: roleCode,
      p_position: position ?? null,
    })
    if (error) throw toAppError(error)
    return data
  },

  async updateMember(
    id: string,
    values: TablesUpdate<'condominium_members'>,
  ): Promise<MemberWithRelations> {
    const { data, error } = await supabase
      .from('condominium_members')
      .update(values)
      .eq('id', id)
      .select(MEMBER_SELECT)
      .returns<MemberWithRelations[]>()
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async removeMember(id: string): Promise<void> {
    const { error } = await supabase.from('condominium_members').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  /**
   * Invita a un usuario que TODAVIA no tiene cuenta.
   * Requiere la Edge Function `invite-member` desplegada (usa service role key).
   */
  async inviteMember(input: InviteMemberInput): Promise<{ user_id: string; invited: boolean }> {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean
      user_id: string
      member_id: string
      invited: boolean
      error?: string
    }>('invite-member', {
      body: {
        condominium_id: input.condominiumId,
        email: input.email,
        full_name: input.fullName,
        role_code: input.roleCode,
        phone: input.phone ?? null,
        document_number: input.documentNumber ?? null,
        position: input.position ?? null,
      },
    })

    if (error) {
      throw toAppError({
        message:
          'No se pudo invitar al usuario. Verifica que la Edge Function `invite-member` este desplegada ' +
          '(supabase functions deploy invite-member) o vincula un usuario ya registrado.',
        code: 'EDGE_FUNCTION',
      })
    }
    if (!data?.ok) throw toAppError({ message: data?.error ?? 'No se pudo invitar al usuario' })

    return { user_id: data.user_id, invited: data.invited }
  },
}

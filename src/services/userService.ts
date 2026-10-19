import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { ProfileRow, RoleCode, RoleRow, TablesUpdate } from '@/types/database'
import type { ListParams, ListResult, MemberWithRelations } from '@/types/models'

const MEMBER_SELECT =
  '*, profile:profiles(id, full_name, email, avatar_url, phone), role:roles(id, code, name, level)'

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
}

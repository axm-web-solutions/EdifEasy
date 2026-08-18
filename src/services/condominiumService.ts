import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { CondominiumRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { AdminDashboardStats, ListParams, ListResult, ResidentDashboardStats } from '@/types/models'

const SELECT = '*'

export const condominiumService = {
  async list(params: ListParams): Promise<ListResult<CondominiumRow>> {
    const query = supabase.from('condominiums').select(SELECT, { count: 'exact' })
    return runList<CondominiumRow>(query, params, {
      searchColumns: ['name', 'nit', 'city', 'address', 'email'],
      defaultSort: { column: 'name', ascending: true },
      dateColumn: 'created_at',
    })
  },

  async listAll(): Promise<CondominiumRow[]> {
    const { data, error } = await supabase
      .from('condominiums')
      .select(SELECT)
      .order('name', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<CondominiumRow | null> {
    const { data, error } = await supabase.from('condominiums').select(SELECT).eq('id', id).maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'condominiums'>): Promise<CondominiumRow> {
    const { data, error } = await supabase.from('condominiums').insert(values).select(SELECT).single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'condominiums'>): Promise<CondominiumRow> {
    const { data, error } = await supabase
      .from('condominiums')
      .update(values)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw toAppError(error)
    return data
  },

  /** Desactiva el condominio (borrado logico). */
  async deactivate(id: string): Promise<CondominiumRow> {
    return condominiumService.update(id, { status: 'INACTIVE' })
  },

  /** Borrado fisico. Solo SUPER_ADMIN por politica RLS. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('condominiums').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  async adminStats(condominiumId: string): Promise<AdminDashboardStats> {
    const { data, error } = await supabase.rpc('condominium_dashboard_stats', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return data as unknown as AdminDashboardStats
  },

  async residentStats(condominiumId: string): Promise<ResidentDashboardStats> {
    const { data, error } = await supabase.rpc('resident_dashboard', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return data as unknown as ResidentDashboardStats
  },
}

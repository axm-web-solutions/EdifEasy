import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { IncidentRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { IncidentWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  reporter:profiles!incidents_reported_by_fkey(id, full_name, email, avatar_url, phone),
  assignee:profiles!incidents_assigned_to_fkey(id, full_name, email, avatar_url, phone),
  apartment:apartments(id, number, floor, building_id)
`

export const incidentService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<IncidentWithRelations>> {
    const query = supabase
      .from('incidents')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<IncidentWithRelations>(query, params, {
      searchColumns: ['title', 'description', 'location', 'code'],
      defaultSort: { column: 'occurred_at', ascending: false },
      dateColumn: 'occurred_at',
    })
  },

  async listRecent(condominiumId: string, limit = 5): Promise<IncidentWithRelations[]> {
    const { data, error } = await supabase
      .from('incidents')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('occurred_at', { ascending: false })
      .limit(limit)
      .returns<IncidentWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<IncidentWithRelations | null> {
    const { data, error } = await supabase
      .from('incidents')
      .select(SELECT)
      .eq('id', id)
      .returns<IncidentWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'incidents'>): Promise<IncidentRow> {
    const { data, error } = await supabase.from('incidents').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'incidents'>): Promise<IncidentRow> {
    const payload: TablesUpdate<'incidents'> = { ...values }
    if (values.status === 'RESOLVED' || values.status === 'CLOSED') {
      payload.resolved_at = values.resolved_at ?? new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('incidents')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('incidents').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

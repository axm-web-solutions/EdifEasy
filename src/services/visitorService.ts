import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { TablesInsert, TablesUpdate, VisitorRow, VisitorStatus } from '@/types/database'
import type { ListParams, ListResult, VisitorWithRelations } from '@/types/models'

const VISITOR_SELECT = `*, apartment:apartments(id, number, floor, building_id, building:buildings(id, name, number)), registered_by:profiles(id, full_name, email, avatar_url, phone)`

export const visitorService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<VisitorWithRelations>> {
    const query = supabase
      .from('visitors')
      .select(VISITOR_SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<VisitorWithRelations>(query, params, {
      searchColumns: ['full_name', 'document_number', 'phone', 'plate', 'company'],
      defaultSort: { column: 'scheduled_at', ascending: false },
      dateColumn: 'scheduled_at',
    })
  },

  async listRecent(condominiumId: string, limit = 10): Promise<VisitorWithRelations[]> {
    const { data, error } = await supabase
      .from('visitors')
      .select(VISITOR_SELECT)
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw toAppError(error)
    return (data ?? []) as VisitorWithRelations[]
  },

  async create(values: TablesInsert<'visitors'>): Promise<VisitorRow> {
    const { data, error } = await supabase
      .from('visitors')
      .insert({ ...values, plate: values.plate?.toUpperCase() ?? null })
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'visitors'>): Promise<VisitorRow> {
    const { data, error } = await supabase
      .from('visitors')
      .update({ ...values, plate: values.plate ? values.plate.toUpperCase() : undefined })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  /** Cambia el estado del visitante y registra las marcas de entrada/salida. */
  async changeStatus(id: string, status: VisitorStatus): Promise<VisitorRow> {
    const entryAt = status === 'INSIDE' ? new Date().toISOString() : undefined
    const exitAt = status === 'LEFT' ? new Date().toISOString() : undefined
    const { data, error } = await supabase
      .from('visitors')
      .update({ status, entry_at: entryAt, exit_at: exitAt })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('visitors').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}
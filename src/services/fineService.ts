import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { FineRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { FineWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  apartment:apartments(id, number, floor, building_id),
  resident:residents(id, full_name)
`

export const fineService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<FineWithRelations>> {
    const query = supabase
      .from('fines')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<FineWithRelations>(query, params, {
      searchColumns: ['reason', 'description', 'notes'],
      defaultSort: { column: 'fine_date', ascending: false },
      dateColumn: 'fine_date',
    })
  },

  async listByApartment(apartmentId: string): Promise<FineWithRelations[]> {
    const { data, error } = await supabase
      .from('fines')
      .select(SELECT)
      .eq('apartment_id', apartmentId)
      .order('fine_date', { ascending: false })
      .returns<FineWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<FineWithRelations | null> {
    const { data, error } = await supabase
      .from('fines')
      .select(SELECT)
      .eq('id', id)
      .returns<FineWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'fines'>): Promise<FineRow> {
    const { data, error } = await supabase.from('fines').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'fines'>): Promise<FineRow> {
    const { data, error } = await supabase.from('fines').update(values).eq('id', id).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fines').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { BuildingRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams, ListResult } from '@/types/models'

const SELECT = '*'

export interface BuildingWithApartments extends BuildingRow {
  apartment_count: number
}

export const buildingService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<BuildingRow>> {
    const query = supabase
      .from('buildings')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<BuildingRow>(query, params, {
      searchColumns: ['name', 'number', 'description'],
      defaultSort: { column: 'number', ascending: true },
      dateColumn: 'created_at',
    })
  },

  async listAll(condominiumId: string): Promise<BuildingRow[]> {
    const { data, error } = await supabase
      .from('buildings')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('number', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  /**
   * Bloques con el conteo real de apartamentos (para la vista de navegacion).
   *
   * El conteo lo calcula PostgreSQL con la vista `tribuia.buildings_with_counts`.
   * Antes se descargaban TODOS los apartamentos para contarlos en JavaScript, lo
   * que ademas se truncaba en silencio cuando el condominio superaba el `max_rows`
   * de PostgREST (1000 por defecto) y devolvia un total equivocado.
   */
  async listWithCounts(condominiumId: string): Promise<BuildingWithApartments[]> {
    const { data, error } = await supabase
      .from('buildings_with_counts')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('number', { ascending: true })
      .returns<BuildingWithApartments[]>()

    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<BuildingRow | null> {
    const { data, error } = await supabase.from('buildings').select(SELECT).eq('id', id).maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'buildings'>): Promise<BuildingRow> {
    const { data, error } = await supabase.from('buildings').insert(values).select(SELECT).single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'buildings'>): Promise<BuildingRow> {
    const { data, error } = await supabase
      .from('buildings')
      .update(values)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('buildings').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

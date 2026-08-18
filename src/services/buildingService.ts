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

  /** Bloques con el conteo real de apartamentos (para la vista de navegacion). */
  async listWithCounts(condominiumId: string): Promise<BuildingWithApartments[]> {
    const [buildingsResult, apartmentsResult] = await Promise.all([
      supabase
        .from('buildings')
        .select(SELECT)
        .eq('condominium_id', condominiumId)
        .order('number', { ascending: true }),
      supabase.from('apartments').select('building_id').eq('condominium_id', condominiumId),
    ])

    if (buildingsResult.error) throw toAppError(buildingsResult.error)
    if (apartmentsResult.error) throw toAppError(apartmentsResult.error)

    const counts = new Map<string, number>()
    for (const row of apartmentsResult.data) {
      counts.set(row.building_id, (counts.get(row.building_id) ?? 0) + 1)
    }

    return buildingsResult.data.map((building) => ({
      ...building,
      apartment_count: counts.get(building.id) ?? 0,
    }))
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

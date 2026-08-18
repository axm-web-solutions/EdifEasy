import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { PetRow, ResidentRow, TablesInsert, TablesUpdate, VehicleRow } from '@/types/database'
import type { ListParams, ListResult, ResidentWithRelations } from '@/types/models'

const RESIDENT_SELECT = '*, apartment:apartments(id, number, floor, building_id)'

export const residentService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<ResidentWithRelations>> {
    const query = supabase
      .from('residents')
      .select(RESIDENT_SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<ResidentWithRelations>(query, params, {
      searchColumns: ['full_name', 'document_number', 'email', 'phone'],
      defaultSort: { column: 'full_name', ascending: true },
      dateColumn: 'created_at',
    })
  },

  async listByApartment(apartmentId: string): Promise<ResidentRow[]> {
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('relationship', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<ResidentWithRelations | null> {
    const { data, error } = await supabase
      .from('residents')
      .select(RESIDENT_SELECT)
      .eq('id', id)
      .returns<ResidentWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'residents'>): Promise<ResidentRow> {
    const { data, error } = await supabase.from('residents').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'residents'>): Promise<ResidentRow> {
    const { data, error } = await supabase
      .from('residents')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('residents').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

export const vehicleService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<VehicleRow>> {
    const query = supabase
      .from('vehicles')
      .select('*', { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<VehicleRow>(query, params, {
      searchColumns: ['plate', 'brand', 'model', 'color', 'parking_spot'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  async listByApartment(apartmentId: string): Promise<VehicleRow[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false })
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'vehicles'>): Promise<VehicleRow> {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({ ...values, plate: values.plate?.toUpperCase() })
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'vehicles'>): Promise<VehicleRow> {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ ...values, plate: values.plate ? values.plate.toUpperCase() : undefined })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

export const petService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<PetRow>> {
    const query = supabase
      .from('pets')
      .select('*', { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<PetRow>(query, params, {
      searchColumns: ['name', 'breed', 'color'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  async listByApartment(apartmentId: string): Promise<PetRow[]> {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false })
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'pets'>): Promise<PetRow> {
    const { data, error } = await supabase.from('pets').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'pets'>): Promise<PetRow> {
    const { data, error } = await supabase.from('pets').update(values).eq('id', id).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('pets').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

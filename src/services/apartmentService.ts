import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { ApartmentRow, TablesInsert, TablesUpdate } from '@/types/database'
import type {
  ApartmentWithRelations,
  ListParams,
  ListResult,
  OwnerWithProfile,
  TenantWithProfile,
} from '@/types/models'

const SELECT = '*, building:buildings(id, name, number)'
const OWNER_SELECT =
  '*, profile:profiles(id, full_name, email, avatar_url, phone), apartment:apartments(id, number, floor, building_id)'
const TENANT_SELECT = OWNER_SELECT

export interface ApartmentTimelineItem {
  id: string
  kind: 'request' | 'incident' | 'fine' | 'alert'
  title: string
  description: string
  status: string
  created_at: string
}

export const apartmentService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<ApartmentWithRelations>> {
    const query = supabase
      .from('apartments')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<ApartmentWithRelations>(query, params, {
      searchColumns: ['number', 'description'],
      defaultSort: { column: 'number', ascending: true },
      dateColumn: 'created_at',
    })
  },

  async listAll(condominiumId: string): Promise<ApartmentWithRelations[]> {
    const { data, error } = await supabase
      .from('apartments')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('number', { ascending: true })
      .returns<ApartmentWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async listByBuilding(buildingId: string): Promise<ApartmentWithRelations[]> {
    const { data, error } = await supabase
      .from('apartments')
      .select(SELECT)
      .eq('building_id', buildingId)
      .order('number', { ascending: true })
      .returns<ApartmentWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<ApartmentWithRelations | null> {
    const { data, error } = await supabase
      .from('apartments')
      .select(SELECT)
      .eq('id', id)
      .returns<ApartmentWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'apartments'>): Promise<ApartmentRow> {
    const { data, error } = await supabase.from('apartments').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'apartments'>): Promise<ApartmentRow> {
    const { data, error } = await supabase
      .from('apartments')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('apartments').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Propietarios
  // -------------------------------------------------------------------------
  async owners(apartmentId: string): Promise<OwnerWithProfile[]> {
    const { data, error } = await supabase
      .from('apartment_owners')
      .select(OWNER_SELECT)
      .eq('apartment_id', apartmentId)
      .order('is_primary', { ascending: false })
      .returns<OwnerWithProfile[]>()
    if (error) throw toAppError(error)
    return data
  },

  async ownersByProfile(profileId: string): Promise<OwnerWithProfile[]> {
    const { data, error } = await supabase
      .from('apartment_owners')
      .select(OWNER_SELECT)
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .returns<OwnerWithProfile[]>()
    if (error) throw toAppError(error)
    return data
  },

  async addOwner(values: TablesInsert<'apartment_owners'>): Promise<void> {
    const { error } = await supabase.from('apartment_owners').insert(values)
    if (error) throw toAppError(error)
  },

  async updateOwner(id: string, values: TablesUpdate<'apartment_owners'>): Promise<void> {
    const { error } = await supabase.from('apartment_owners').update(values).eq('id', id)
    if (error) throw toAppError(error)
  },

  async removeOwner(id: string): Promise<void> {
    const { error } = await supabase.from('apartment_owners').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Arrendatarios
  // -------------------------------------------------------------------------
  async tenants(apartmentId: string): Promise<TenantWithProfile[]> {
    const { data, error } = await supabase
      .from('apartment_tenants')
      .select(TENANT_SELECT)
      .eq('apartment_id', apartmentId)
      .order('lease_start', { ascending: false })
      .returns<TenantWithProfile[]>()
    if (error) throw toAppError(error)
    return data
  },

  async tenantsByProfile(profileId: string): Promise<TenantWithProfile[]> {
    const { data, error } = await supabase
      .from('apartment_tenants')
      .select(TENANT_SELECT)
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .returns<TenantWithProfile[]>()
    if (error) throw toAppError(error)
    return data
  },

  async addTenant(values: TablesInsert<'apartment_tenants'>): Promise<void> {
    const { error } = await supabase.from('apartment_tenants').insert(values)
    if (error) throw toAppError(error)
  },

  async updateTenant(id: string, values: TablesUpdate<'apartment_tenants'>): Promise<void> {
    const { error } = await supabase.from('apartment_tenants').update(values).eq('id', id)
    if (error) throw toAppError(error)
  },

  async removeTenant(id: string): Promise<void> {
    const { error } = await supabase.from('apartment_tenants').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Linea de tiempo del apartamento (CRM)
  // -------------------------------------------------------------------------
  async timeline(apartmentId: string): Promise<ApartmentTimelineItem[]> {
    const [requests, incidents, fines, alerts] = await Promise.all([
      supabase
        .from('requests')
        .select('id, title, description, status, created_at')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('incidents')
        .select('id, title, description, status, created_at')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('fines')
        .select('id, reason, description, status, created_at')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('alerts')
        .select('id, title, description, status, created_at')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    if (requests.error) throw toAppError(requests.error)
    if (incidents.error) throw toAppError(incidents.error)
    if (fines.error) throw toAppError(fines.error)
    if (alerts.error) throw toAppError(alerts.error)

    const items: ApartmentTimelineItem[] = [
      ...requests.data.map((row) => ({
        id: row.id,
        kind: 'request' as const,
        title: row.title,
        description: row.description,
        status: row.status,
        created_at: row.created_at,
      })),
      ...incidents.data.map((row) => ({
        id: row.id,
        kind: 'incident' as const,
        title: row.title,
        description: row.description,
        status: row.status,
        created_at: row.created_at,
      })),
      ...fines.data.map((row) => ({
        id: row.id,
        kind: 'fine' as const,
        title: row.reason,
        description: row.description ?? '',
        status: row.status,
        created_at: row.created_at,
      })),
      ...alerts.data.map((row) => ({
        id: row.id,
        kind: 'alert' as const,
        title: row.title,
        description: row.description,
        status: row.status,
        created_at: row.created_at,
      })),
    ]

    return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },
}

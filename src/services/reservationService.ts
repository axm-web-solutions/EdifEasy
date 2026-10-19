/**
 * Zonas comunes y reservas. El valor y el estado de una reserva los fija la
 * base (trigger); los cambios de estado van por RPC.
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { CommonAreaRow, ReservationRow, TablesInsert, TablesUpdate } from '@/types/database'

export interface ReservationWithRelations extends ReservationRow {
  area: Pick<CommonAreaRow, 'id' | 'name'> | null
  apartment: {
    id: string
    number: string
    building: { id: string; name: string } | null
  } | null
  author: { id: string; full_name: string } | null
}

export interface BusySlot {
  starts_at: string
  ends_at: string
}

const RESERVATION_SELECT = `
  *,
  area:common_areas(id, name),
  apartment:apartments(id, number, building:buildings(id, name)),
  author:profiles!reservations_created_by_fkey(id, full_name)
`

export const reservationService = {
  // ------------------------------------------------------------ zonas
  async listAreas(condominiumId: string): Promise<CommonAreaRow[]> {
    const { data, error } = await supabase
      .from('common_areas')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('name', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async createArea(values: TablesInsert<'common_areas'>): Promise<CommonAreaRow> {
    const { data, error } = await supabase.from('common_areas').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async updateArea(id: string, values: TablesUpdate<'common_areas'>): Promise<CommonAreaRow> {
    const { data, error } = await supabase
      .from('common_areas')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async removeArea(id: string): Promise<void> {
    const { error } = await supabase.from('common_areas').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // ---------------------------------------------------------- reservas
  /** Reservas desde `from` (RLS deja a cada residente solo las de su apartamento). */
  async list(condominiumId: string, from: string): Promise<ReservationWithRelations[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select(RESERVATION_SELECT)
      .eq('condominium_id', condominiumId)
      .gte('ends_at', from)
      .order('starts_at', { ascending: true })
      .limit(500)
      .returns<ReservationWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async busySlots(areaId: string, from: string, to: string): Promise<BusySlot[]> {
    const { data, error } = await supabase.rpc('common_area_busy_slots', {
      p_area: areaId,
      p_from: from,
      p_to: to,
    })
    if (error) throw toAppError(error)
    return data ?? []
  },

  async create(values: TablesInsert<'reservations'>): Promise<ReservationRow> {
    const { data, error } = await supabase.from('reservations').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async review(id: string, approve: boolean, notes: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('review_reservation', {
      p_reservation: id,
      p_approve: approve,
      p_notes: notes,
    })
    if (error) throw toAppError(error)
    return data
  },

  async registerPayment(id: string): Promise<string> {
    const { data, error } = await supabase.rpc('register_reservation_payment', {
      p_reservation: id,
    })
    if (error) throw toAppError(error)
    return data
  },

  async cancel(id: string, reason: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('cancel_reservation', {
      p_reservation: id,
      p_reason: reason,
    })
    if (error) throw toAppError(error)
    return data
  },
}

/**
 * Ingreso y salida del personal. Las jornadas solo se escriben por RPC
 * (staff_check_in / staff_check_out), que validan quien puede marcar a quien.
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { StaffRosterRow, StaffShiftRow } from '@/types/database'

export const staffService = {
  /** Personal del conjunto con su jornada abierta (solo porteria y administracion). */
  async roster(condominiumId: string): Promise<StaffRosterRow[]> {
    const { data, error } = await supabase.rpc('staff_roster', { p_condominium: condominiumId })
    if (error) throw toAppError(error)
    return data ?? []
  },

  /** Jornadas desde `from`. RLS: la administracion ve todas; cada persona, las suyas. */
  async shifts(condominiumId: string, from: string): Promise<StaffShiftRow[]> {
    const { data, error } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('condominium_id', condominiumId)
      .or(`check_in_at.gte."${from}",check_out_at.is.null`)
      .order('check_in_at', { ascending: false })
      .limit(500)
    if (error) throw toAppError(error)
    return data
  },

  async checkIn(input: {
    condominiumId: string
    profileId?: string | null
    name?: string | null
    roleLabel?: string | null
    notes?: string | null
  }): Promise<string> {
    const { data, error } = await supabase.rpc('staff_check_in', {
      p_condominium: input.condominiumId,
      p_profile: input.profileId ?? null,
      p_name: input.name ?? null,
      p_role_label: input.roleLabel ?? null,
      p_notes: input.notes ?? null,
    })
    if (error) throw toAppError(error)
    return data
  },

  async checkOut(shiftId: string, notes: string | null = null): Promise<string> {
    const { data, error } = await supabase.rpc('staff_check_out', {
      p_shift: shiftId,
      p_notes: notes,
    })
    if (error) throw toAppError(error)
    return data
  },
}

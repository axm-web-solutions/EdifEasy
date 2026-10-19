/**
 * Directorio del conjunto (`community_contacts`): numeros de emergencia propios
 * (cuadrante de policia, porteria) y servicios recomendados del marketplace.
 * Solo la administracion escribe; RLS lo garantiza.
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { CommunityContactRow, TablesInsert, TablesUpdate } from '@/types/database'

export const directoryService = {
  async list(condominiumId: string): Promise<CommunityContactRow[]> {
    const { data, error } = await supabase
      .from('community_contacts')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'community_contacts'>): Promise<CommunityContactRow> {
    const { data, error } = await supabase
      .from('community_contacts')
      .insert(values)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async update(
    id: string,
    values: TablesUpdate<'community_contacts'>,
  ): Promise<CommunityContactRow> {
    const { data, error } = await supabase
      .from('community_contacts')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('community_contacts').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

/**
 * Minuta digital de porteria. Las anotaciones son inmutables: solo se listan
 * y se crean (la base no permite editarlas ni borrarlas).
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { GuardLogEntryRow, TablesInsert } from '@/types/database'

export interface GuardLogEntryWithRelations extends GuardLogEntryRow {
  author: { id: string; full_name: string } | null
  apartment: { id: string; number: string; building: { name: string } | null } | null
}

const SELECT = `
  *,
  author:profiles!guard_log_entries_created_by_fkey(id, full_name),
  apartment:apartments(id, number, building:buildings(name))
`

export const logbookService = {
  /** Anotaciones desde `from` (ISO), las mas recientes primero. */
  async list(condominiumId: string, from: string): Promise<GuardLogEntryWithRelations[]> {
    const { data, error } = await supabase
      .from('guard_log_entries')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .gte('occurred_at', from)
      .order('occurred_at', { ascending: false })
      .limit(500)
      .returns<GuardLogEntryWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'guard_log_entries'>): Promise<GuardLogEntryRow> {
    const { data, error } = await supabase
      .from('guard_log_entries')
      .insert(values)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },
}

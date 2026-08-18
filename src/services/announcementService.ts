import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { AnnouncementRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { AnnouncementWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  author:profiles!announcements_created_by_fkey(id, full_name, email, avatar_url, phone)
`

export const announcementService = {
  async list(
    condominiumId: string,
    params: ListParams,
  ): Promise<ListResult<AnnouncementWithRelations>> {
    const query = supabase
      .from('announcements')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<AnnouncementWithRelations>(query, params, {
      searchColumns: ['title', 'content'],
      defaultSort: { column: 'published_at', ascending: false },
      dateColumn: 'published_at',
    })
  },

  async listPublished(condominiumId: string, limit = 5): Promise<AnnouncementWithRelations[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false })
      .limit(limit)
      .returns<AnnouncementWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<AnnouncementWithRelations | null> {
    const { data, error } = await supabase
      .from('announcements')
      .select(SELECT)
      .eq('id', id)
      .returns<AnnouncementWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'announcements'>): Promise<AnnouncementRow> {
    const { data, error } = await supabase.from('announcements').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'announcements'>): Promise<AnnouncementRow> {
    const { data, error } = await supabase
      .from('announcements')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

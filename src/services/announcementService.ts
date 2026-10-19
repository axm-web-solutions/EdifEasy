import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { AnnouncementRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { AnnouncementWithRelations, FeedPost, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  author:profiles!announcements_created_by_fkey(id, full_name, email, avatar_url, phone)
`

const FEED_SELECT = `
  ${SELECT},
  building:buildings!announcements_building_id_fkey(id, name),
  audience_role:roles!announcements_audience_role_id_fkey(id, code, name)
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

  /**
   * Una pagina del feed: comunicados publicados y vigentes, fijados primero.
   * RLS ya filtra por destinatario (todo el conjunto, bloque, apartamento o rol).
   */
  async listFeed(
    condominiumId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: FeedPost[]; hasMore: boolean }> {
    const now = new Date().toISOString()
    const from = page * pageSize
    const { data, error } = await supabase
      .from('announcements')
      .select(FEED_SELECT)
      .eq('condominium_id', condominiumId)
      .eq('status', 'PUBLISHED')
      .lte('published_at', now)
      .or(`expires_at.is.null,expires_at.gt."${now}"`)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      // Un registro extra para saber si hay otra pagina.
      .range(from, from + pageSize)
      .returns<FeedPost[]>()
    if (error) throw toAppError(error)
    return { items: data.slice(0, pageSize), hasMore: data.length > pageSize }
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

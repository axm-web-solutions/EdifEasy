import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { RequestCommentRow, RequestRow, TablesInsert, TablesUpdate } from '@/types/database'
import type {
  ListParams,
  ListResult,
  RequestCommentWithAuthor,
  RequestWithRelations,
} from '@/types/models'

const SELECT = `
  *,
  author:profiles!requests_created_by_fkey(id, full_name, email, avatar_url, phone),
  assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url, phone),
  apartment:apartments(id, number, floor, building_id),
  building:buildings(id, name, number)
`

const COMMENT_SELECT = `
  *,
  author:profiles!request_comments_author_id_fkey(id, full_name, email, avatar_url, phone)
`

export const requestService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<RequestWithRelations>> {
    const query = supabase
      .from('requests')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<RequestWithRelations>(query, params, {
      searchColumns: ['title', 'description', 'code'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  async listRecent(condominiumId: string, limit = 5): Promise<RequestWithRelations[]> {
    const { data, error } = await supabase
      .from('requests')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<RequestWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<RequestWithRelations | null> {
    const { data, error } = await supabase
      .from('requests')
      .select(SELECT)
      .eq('id', id)
      .returns<RequestWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'requests'>): Promise<RequestRow> {
    const { data, error } = await supabase.from('requests').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'requests'>): Promise<RequestRow> {
    const payload: TablesUpdate<'requests'> = { ...values }
    if (values.status === 'RESOLVED' || values.status === 'CLOSED') {
      payload.resolved_at = values.resolved_at ?? new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('requests')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('requests').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Comentarios
  // -------------------------------------------------------------------------
  async comments(requestId: string): Promise<RequestCommentWithAuthor[]> {
    const { data, error } = await supabase
      .from('request_comments')
      .select(COMMENT_SELECT)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .returns<RequestCommentWithAuthor[]>()
    if (error) throw toAppError(error)
    return data
  },

  async addComment(values: TablesInsert<'request_comments'>): Promise<RequestCommentRow> {
    const { data, error } = await supabase.from('request_comments').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async removeComment(id: string): Promise<void> {
    const { error } = await supabase.from('request_comments').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}

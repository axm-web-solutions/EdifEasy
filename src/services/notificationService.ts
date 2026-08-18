import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { NotificationRow } from '@/types/database'

export const notificationService = {
  async list(userId: string, condominiumId: string | null, limit = 30): Promise<NotificationRow[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (condominiumId) query = query.eq('condominium_id', condominiumId)

    const { data, error } = await query
    if (error) throw toAppError(error)
    return data
  },

  async unreadCount(userId: string, condominiumId: string | null): Promise<number> {
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (condominiumId) query = query.eq('condominium_id', condominiumId)

    const { count, error } = await query
    if (error) throw toAppError(error)
    return count ?? 0
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw toAppError(error)
  },

  async markAllAsRead(condominiumId: string | null): Promise<number> {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
      p_condominium: condominiumId ?? undefined,
    })
    if (error) throw toAppError(error)
    return data ?? 0
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  /** Realtime: nuevas notificaciones del usuario autenticado. */
  subscribe(userId: string, onInsert: (notification: NotificationRow) => void): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: DB_SCHEMA,
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsert(payload.new as NotificationRow)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}

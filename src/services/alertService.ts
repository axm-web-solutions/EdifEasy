import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { AlertRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { AlertWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  author:profiles!alerts_created_by_fkey(id, full_name, email, avatar_url, phone),
  building:buildings(id, name, number),
  apartment:apartments(id, number, floor, building_id)
`

export const alertService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<AlertWithRelations>> {
    const query = supabase
      .from('alerts')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<AlertWithRelations>(query, params, {
      searchColumns: ['title', 'description'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  /** Alertas activas visibles para el usuario (dashboard y banner). */
  async listActive(condominiumId: string, limit = 10): Promise<AlertWithRelations[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .eq('status', 'ACTIVE')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<AlertWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getById(id: string): Promise<AlertWithRelations | null> {
    const { data, error } = await supabase
      .from('alerts')
      .select(SELECT)
      .eq('id', id)
      .returns<AlertWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'alerts'>): Promise<AlertRow> {
    const { data, error } = await supabase.from('alerts').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'alerts'>): Promise<AlertRow> {
    const { data, error } = await supabase
      .from('alerts')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('alerts').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  /**
   * Suscripcion en tiempo real a las alertas del condominio.
   * Devuelve la funcion de limpieza.
   */
  subscribe(condominiumId: string, onChange: (alert: AlertRow, isNew: boolean) => void): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`alerts:${condominiumId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: DB_SCHEMA,
          table: 'alerts',
          filter: `condominium_id=eq.${condominiumId}`,
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as AlertRow | undefined
          if (record) onChange(record, payload.eventType === 'INSERT')
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}

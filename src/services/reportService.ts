import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { AuditLogRow } from '@/types/database'
import type { ListParams, ListResult, SearchResultItem } from '@/types/models'

export interface CountByKey {
  key: string
  label: string
  value: number
}

interface AuditLogWithUser extends AuditLogRow {
  user: { id: string; full_name: string; email: string } | null
}

async function countBy(
  table: 'requests' | 'incidents' | 'fines' | 'alerts',
  column: string,
  condominiumId: string,
): Promise<CountByKey[]> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('condominium_id', condominiumId)
    .returns<Record<string, string>[]>()

  if (error) throw toAppError(error)

  const counts = new Map<string, number>()
  for (const row of data) {
    const value = row[column]
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([key, value]) => ({ key, label: key, value }))
}

export const reportService = {
  requestsByStatus: (condominiumId: string) => countBy('requests', 'status', condominiumId),
  requestsByType: (condominiumId: string) => countBy('requests', 'type', condominiumId),
  incidentsByType: (condominiumId: string) => countBy('incidents', 'type', condominiumId),
  incidentsByStatus: (condominiumId: string) => countBy('incidents', 'status', condominiumId),
  finesByStatus: (condominiumId: string) => countBy('fines', 'status', condominiumId),
  alertsByType: (condominiumId: string) => countBy('alerts', 'type', condominiumId),

  /** Total de multas agrupado por estado (valor monetario). */
  async finesAmountByStatus(condominiumId: string): Promise<CountByKey[]> {
    const { data, error } = await supabase
      .from('fines')
      .select('status, amount')
      .eq('condominium_id', condominiumId)
    if (error) throw toAppError(error)

    const totals = new Map<string, number>()
    for (const row of data) {
      totals.set(row.status, (totals.get(row.status) ?? 0) + Number(row.amount))
    }
    return Array.from(totals.entries()).map(([key, value]) => ({ key, label: key, value }))
  },

  /** Registro de auditoria paginado. */
  async auditLogs(condominiumId: string, params: ListParams): Promise<ListResult<AuditLogWithUser>> {
    const query = supabase
      .from('audit_logs')
      .select('*, user:profiles(id, full_name, email)', { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<AuditLogWithUser>(query, params, {
      searchColumns: ['entity'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  /** Actividad reciente para el dashboard. */
  async recentActivity(condominiumId: string, limit = 12): Promise<AuditLogWithUser[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:profiles(id, full_name, email)')
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<AuditLogWithUser[]>()
    if (error) throw toAppError(error)
    return data
  },
}

export const searchService = {
  async globalSearch(condominiumId: string, term: string): Promise<SearchResultItem[]> {
    if (!term || term.trim().length < 2) return []
    const { data, error } = await supabase.rpc('global_search', {
      p_condominium: condominiumId,
      p_term: term.trim(),
    })
    if (error) throw toAppError(error)
    return (data ?? []) as SearchResultItem[]
  },
}

export type { AuditLogWithUser }

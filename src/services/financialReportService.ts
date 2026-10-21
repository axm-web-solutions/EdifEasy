/**
 * Reportes financieros publicados y obligaciones fiscales. Los soportes y PDF
 * van al bucket privado `accounting`:
 *   <condominio>/reports/...  (lo ven los propietarios)
 *   <condominio>/fiscal/...   (solo administracion, vocero y contador)
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { buildStoragePath, storageService } from '@/services/storageService'
import type {
  FinancialReportRow,
  TablesInsert,
  TablesUpdate,
  TaxObligationRow,
} from '@/types/database'

export const financialReportService = {
  async reports(condominiumId: string): Promise<FinancialReportRow[]> {
    const { data, error } = await supabase
      .from('financial_reports')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw toAppError(error)
    return data
  },

  async saveReport(
    id: string | null,
    values: TablesInsert<'financial_reports'>,
  ): Promise<FinancialReportRow> {
    const query = id
      ? supabase
          .from('financial_reports')
          .update(values as TablesUpdate<'financial_reports'>)
          .eq('id', id)
      : supabase.from('financial_reports').insert(values)
    const { data, error } = await query.select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async setReportStatus(id: string, status: 'DRAFT' | 'PUBLISHED'): Promise<void> {
    const { error } = await supabase.from('financial_reports').update({ status }).eq('id', id)
    if (error) throw toAppError(error)
  },

  async removeReport(report: Pick<FinancialReportRow, 'id' | 'file_path'>): Promise<void> {
    const { error } = await supabase.from('financial_reports').delete().eq('id', report.id)
    if (error) throw toAppError(error)
    if (report.file_path)
      await storageService.remove('accounting', [report.file_path]).catch(() => undefined)
  },

  async obligations(condominiumId: string): Promise<TaxObligationRow[]> {
    const { data, error } = await supabase
      .from('tax_obligations')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('due_date', { ascending: true })
      .limit(500)
    if (error) throw toAppError(error)
    return data
  },

  async saveObligation(id: string | null, values: TablesInsert<'tax_obligations'>): Promise<void> {
    const { error } = id
      ? await supabase
          .from('tax_obligations')
          .update(values as TablesUpdate<'tax_obligations'>)
          .eq('id', id)
      : await supabase.from('tax_obligations').insert(values)
    if (error) throw toAppError(error)
  },

  async setObligationStatus(id: string, status: TaxObligationRow['status']): Promise<void> {
    const { error } = await supabase.from('tax_obligations').update({ status }).eq('id', id)
    if (error) throw toAppError(error)
  },

  async removeObligation(row: Pick<TaxObligationRow, 'id' | 'file_path'>): Promise<void> {
    const { error } = await supabase.from('tax_obligations').delete().eq('id', row.id)
    if (error) throw toAppError(error)
    if (row.file_path)
      await storageService.remove('accounting', [row.file_path]).catch(() => undefined)
  },

  /** Sube un soporte y devuelve su ruta. */
  async uploadFile(condominiumId: string, area: 'reports' | 'fiscal', file: File): Promise<string> {
    const path = buildStoragePath(condominiumId, area, file.name)
    await storageService.upload('accounting', path, file)
    return path
  },

  openFile(path: string): Promise<string> {
    return storageService.signedUrl('accounting', path, 600)
  },

  subscribe(condominiumId: string, onChange: () => void): () => void {
    let channel: RealtimeChannel = supabase.channel(`financial-reports:${condominiumId}`)
    for (const table of ['financial_reports', 'tax_obligations']) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: DB_SCHEMA, table, filter: `condominium_id=eq.${condominiumId}` },
        () => onChange(),
      )
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },
}

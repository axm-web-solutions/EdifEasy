/**
 * Informacion contable del conjunto. Entra por un unico camino
 * (import_accounting_data): archivos que carga la administracion o la Edge
 * Function `accounting-sync` (Siigo, Alegra). Las credenciales nunca pasan por
 * el navegador despues de conectar: solo las lee el servidor.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import type {
  AccountingImportKind,
  AccountingIntegrationRow,
  AccountingProvider,
  AccountingSyncRunRow,
  AccountingUnitLinkRow,
  BudgetLineRow,
  FinancialStatementRow,
  PortfolioSnapshotRow,
  UnitAccountMovementRow,
  UnitAccountStatementRow,
} from '@/types/database'

type UnitRef = { id: string; number: string; building: { name: string } | null } | null

export interface StatementWithUnit extends UnitAccountStatementRow {
  apartment: UnitRef
}

export interface ImportResult {
  imported: number
  skipped: number
  unmatched: string[] | null
}

export interface ConnectInput {
  condominiumId: string
  provider: 'SIIGO' | 'ALEGRA'
  credentials: Record<string, string>
  settings: { matchBy: 'CODE_IN_NAME' | 'IDENTIFICATION'; monthsBack: number }
}

async function invokeSync<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(
    'accounting-sync',
    { body },
  )
  if (error) {
    let message = 'No se pudo conectar con el servicio de contabilidad.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string } | null
      if (parsed?.error) message = parsed.error
      else if (context.status === 404) message = 'Falta desplegar la Edge Function accounting-sync.'
    }
    throw new AppError(message, { code: 'EDGE_FUNCTION' })
  }
  if (!data || data.error) throw new AppError(data?.error ?? 'Respuesta vacia del servicio')
  return data
}

const UNIT = 'apartment:apartments(id, number, building:buildings(name))'

export const accountingService = {
  async integrations(condominiumId: string): Promise<AccountingIntegrationRow[]> {
    const { data, error } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('created_at')
    if (error) throw toAppError(error)
    return data
  },

  async syncRuns(condominiumId: string): Promise<AccountingSyncRunRow[]> {
    const { data, error } = await supabase
      .from('accounting_sync_runs')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(15)
    if (error) throw toAppError(error)
    return data
  },

  /** RLS: la administracion y el vocero ven todas; el propietario, las suyas. */
  async statements(condominiumId: string): Promise<StatementWithUnit[]> {
    const { data, error } = await supabase
      .from('unit_account_statements')
      .select(`*, ${UNIT}`)
      .eq('condominium_id', condominiumId)
      .returns<StatementWithUnit[]>()
    if (error) throw toAppError(error)
    return data
  },

  async movements(apartmentId: string): Promise<UnitAccountMovementRow[]> {
    const { data, error } = await supabase
      .from('unit_account_movements')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('movement_date', { ascending: false })
      .limit(200)
    if (error) throw toAppError(error)
    return data
  },

  async financialStatements(condominiumId: string): Promise<FinancialStatementRow[]> {
    const { data, error } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('period', { ascending: false })
      .limit(48)
    if (error) throw toAppError(error)
    return data
  },

  async budget(condominiumId: string): Promise<BudgetLineRow[]> {
    const { data, error } = await supabase
      .from('budget_lines')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('code')
    if (error) throw toAppError(error)
    return data
  },

  async portfolio(condominiumId: string): Promise<PortfolioSnapshotRow[]> {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('as_of', { ascending: false })
      .limit(24)
    if (error) throw toAppError(error)
    return data
  },

  async importRows(
    condominiumId: string,
    kind: AccountingImportKind,
    rows: Record<string, string>[],
    integrationId: string | null,
  ): Promise<ImportResult> {
    const { data, error } = await supabase.rpc('import_accounting_data', {
      p_condominium: condominiumId,
      p_kind: kind,
      p_rows: rows,
      p_source: 'FILE',
      p_integration: integrationId,
    })
    if (error) throw toAppError(error)
    return data as unknown as ImportResult
  },

  /** Conexion por archivo (World Office, Helisa, ContaPyme u otro). */
  async addFileIntegration(condominiumId: string, provider: AccountingProvider): Promise<void> {
    const { error } = await supabase
      .from('accounting_integrations')
      .upsert(
        { condominium_id: condominiumId, provider, mode: 'FILE', status: 'CONNECTED' },
        { onConflict: 'condominium_id,provider' },
      )
    if (error) throw toAppError(error)
  },

  async removeFileIntegration(integrationId: string): Promise<void> {
    const { error } = await supabase
      .from('accounting_integrations')
      .delete()
      .eq('id', integrationId)
    if (error) throw toAppError(error)
  },

  connect(input: ConnectInput) {
    return invokeSync<{ integration_id: string }>({
      action: 'connect',
      condominium_id: input.condominiumId,
      provider: input.provider,
      credentials: input.credentials,
      settings: input.settings,
    })
  },

  sync(integrationId: string) {
    return invokeSync<{ result: { documents: number; withoutUnit: string[] } }>({
      action: 'sync',
      integration_id: integrationId,
    })
  },

  disconnect(integrationId: string) {
    return invokeSync<{ ok: boolean }>({ action: 'disconnect', integration_id: integrationId })
  },

  async links(condominiumId: string): Promise<AccountingUnitLinkRow[]> {
    const { data, error } = await supabase
      .from('accounting_unit_links')
      .select('*')
      .eq('condominium_id', condominiumId)
    if (error) throw toAppError(error)
    return data
  },

  /** Enlaza un codigo del sistema contable con una unidad de EdiFeasy. */
  async link(condominiumId: string, externalCode: string, apartmentId: string): Promise<void> {
    const { error } = await supabase
      .from('accounting_unit_links')
      .upsert(
        { condominium_id: condominiumId, external_code: externalCode, apartment_id: apartmentId },
        { onConflict: 'condominium_id,external_code' },
      )
    if (error) throw toAppError(error)
  },

  /** Cambios en vivo de la informacion contable del conjunto. */
  subscribe(condominiumId: string, onChange: () => void): () => void {
    let channel: RealtimeChannel = supabase.channel(`accounting:${condominiumId}`)
    for (const table of [
      'unit_account_statements',
      'unit_account_movements',
      'financial_statements',
      'budget_lines',
      'portfolio_snapshots',
      'accounting_sync_runs',
    ]) {
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

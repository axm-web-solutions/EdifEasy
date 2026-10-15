import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { filterText, runList } from './query'
import type { AdminFeeRow, PaymentKind, PlanPeriod, TablesUpdate } from '@/types/database'
import type {
  AdminFeeWithRelations,
  AdminFeesSummary,
  SummaryFilters,
  ListParams,
  ListResult,
  PaymentWithRelations,
  SubscriptionQuote,
} from '@/types/models'

const FEE_SELECT = `
  *,
  apartment:apartments(id, number, floor, building_id, building:buildings(id, name))
`
const PAYMENT_SELECT = `
  *,
  payer:profiles(id, full_name, email)
`

/** Path al que Wompi devuelve al usuario (ver la Edge Function `wompi-payments`). */
export const PAYMENT_RESULT_PATH = '/payments/result'

interface FunctionResponse {
  ok?: boolean
  error?: string
  checkout_url?: string
  payment?: Partial<PaymentWithRelations> & { status: PaymentWithRelations['status'] }
}

/**
 * Llama a la Edge Function de pagos. Si responde con error HTTP, rescata el
 * mensaje del cuerpo para mostrarlo tal cual al usuario.
 */
async function invokePayments(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke<FunctionResponse>('wompi-payments', {
    body,
  })
  if (error) {
    let message =
      'No se pudo conectar con el servicio de pagos. Verifica que la Edge Function `wompi-payments` este desplegada.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as FunctionResponse | null
      if (parsed?.error) message = parsed.error
    }
    throw toAppError({ message, code: 'EDGE_FUNCTION' })
  }
  if (!data?.ok) throw toAppError({ message: data?.error ?? 'No se pudo procesar el pago' })
  return data
}

export const paymentService = {
  // ------------------------------------------------------- cuotas de admin
  async listAdminFees(
    condominiumId: string,
    params: ListParams,
  ): Promise<ListResult<AdminFeeWithRelations>> {
    const query = supabase
      .from('admin_fees')
      .select(FEE_SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<AdminFeeWithRelations>(query, params, {
      searchColumns: ['notes'],
      defaultSort: { column: 'period', ascending: false },
      dateColumn: 'due_date',
    })
  },

  /** Totales de todas las cuotas que cumplen los filtros (calculados en la base). */
  async adminFeesSummary(condominiumId: string, filters: SummaryFilters): Promise<AdminFeesSummary> {
    const { data, error } = await supabase.rpc('admin_fees_summary', {
      p_condominium: condominiumId,
      p_status: filterText(filters.filters, 'status'),
      p_from: filters.dateFrom,
      p_to: filters.dateTo,
      p_search: filters.search || null,
    })
    if (error) throw toAppError(error)
    return data as unknown as AdminFeesSummary
  },

  /** Registra un pago en efectivo o consignacion hecho por fuera de la app. */
  async registerCashPayment(adminFeeId: string): Promise<AdminFeeRow> {
    return paymentService.updateAdminFee(adminFeeId, {
      status: 'PAID',
      paid_at: new Date().toISOString(),
      payment_method: 'CASH',
    })
  },

  /** Cuotas de los apartamentos de los que el usuario es propietario activo. */
  async listMyAdminFees(condominiumId: string, userId: string): Promise<AdminFeeWithRelations[]> {
    const { data: owned, error: ownedError } = await supabase
      .from('apartment_owners')
      .select('apartment_id')
      .eq('profile_id', userId)
      .eq('is_active', true)
    if (ownedError) throw toAppError(ownedError)
    const apartmentIds = owned.map((row) => row.apartment_id)
    if (apartmentIds.length === 0) return []

    const { data, error } = await supabase
      .from('admin_fees')
      .select(FEE_SELECT)
      .eq('condominium_id', condominiumId)
      .in('apartment_id', apartmentIds)
      .neq('status', 'CANCELLED')
      .order('period', { ascending: false })
      .returns<AdminFeeWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async generateAdminFees(input: {
    condominiumId: string
    period: string
    amount: number
    dueDate: string
  }): Promise<number> {
    const { data, error } = await supabase.rpc('generate_admin_fees', {
      p_condominium: input.condominiumId,
      p_period: input.period,
      p_amount: input.amount,
      p_due_date: input.dueDate,
    })
    if (error) throw toAppError(error)
    return data
  },

  async updateAdminFee(id: string, values: TablesUpdate<'admin_fees'>): Promise<AdminFeeRow> {
    const { data, error } = await supabase
      .from('admin_fees')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  // ------------------------------------------------------------- planes
  async quote(condominiumId: string): Promise<SubscriptionQuote> {
    const { data, error } = await supabase.rpc('subscription_quote', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return data as unknown as SubscriptionQuote
  },

  // ------------------------------------------------------------- pagos
  async listPayments(condominiumId: string, kind: PaymentKind): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(PAYMENT_SELECT)
      .eq('condominium_id', condominiumId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<PaymentWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  /** Crea el pago pendiente y devuelve la URL del checkout de Wompi. */
  async startAdminFeeCheckout(adminFeeId: string): Promise<string> {
    const data = await invokePayments({
      action: 'admin_fee',
      admin_fee_id: adminFeeId,
      origin: window.location.origin,
    })
    return data.checkout_url as string
  },

  async startFineCheckout(fineId: string): Promise<string> {
    const data = await invokePayments({
      action: 'fine',
      fine_id: fineId,
      origin: window.location.origin,
    })
    return data.checkout_url as string
  },

  async startSubscriptionCheckout(condominiumId: string, period: PlanPeriod): Promise<string> {
    const data = await invokePayments({
      action: 'subscription',
      condominium_id: condominiumId,
      period,
      origin: window.location.origin,
    })
    return data.checkout_url as string
  },

  /** Consulta en Wompi el resultado de la transaccion y lo aplica. */
  async verify(transactionId: string): Promise<NonNullable<FunctionResponse['payment']>> {
    const data = await invokePayments({ action: 'verify', transaction_id: transactionId })
    if (!data.payment) throw toAppError({ message: 'No se encontro el pago' })
    return data.payment
  },
}

/**
 * Gestion de la inmobiliaria: mandatos con propietarios, codeudores, ajustes
 * del canon, cobros adicionales, gastos, liquidaciones y firma de contratos.
 *
 * Lo que mueve plata o firma (liquidar, subir el canon, firmar) se hace por
 * RPC: la base valida permisos y reglas. La pagina publica de firma solo usa
 * lease_contract_for_signing y sign_lease_contract (el token es la credencial).
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type {
  AgencyPropertyRow,
  Json,
  LeaseGuarantorRow,
  LeaseRentAdjustmentRow,
  LeaseSignerRow,
  ManagementAgreementRow,
  OwnerSettlementLineRow,
  OwnerSettlementRow,
  PropertyExpenseRow,
  SignerRole,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

type PropertyRef = Pick<AgencyPropertyRow, 'id' | 'title' | 'code'> | null

export interface AgreementWithProperty extends ManagementAgreementRow {
  property: PropertyRef
}
export interface SettlementWithProperty extends OwnerSettlementRow {
  property: PropertyRef
}
export interface ExpenseWithProperty extends PropertyExpenseRow {
  property: PropertyRef
}

/** Columnas de firmantes que la app puede leer (sin el hash del token). */
const SIGNER_COLUMNS =
  'id, condominium_id, lease_id, role, name, document, email, phone, profile_id, sort_order, token_hint, signed_at, signed_name, signed_document, signature_image, content_hash, ip, user_agent, created_at'

export interface SignerInput {
  role: SignerRole
  name: string
  document?: string | null
  email?: string | null
  phone?: string | null
  profile_id?: string | null
}

/** Lo que ve quien abre un enlace de firma. */
export interface SigningView {
  agency: { name: string; logo_url: string | null; primary_color: string | null }
  contract: {
    text: string
    hash: string
    status: 'NONE' | 'SENT' | 'SIGNED'
    sent_at: string | null
    property: string
  }
  signer: { role: SignerRole; name: string; document: string | null; signed_at: string | null }
  signers: { role: SignerRole; name: string; signed: boolean }[]
}

const throwIf = (error: unknown) => {
  if (error) throw toAppError(error)
}

export const agencyManagementService = {
  // --------------------------------------------------------------- mandatos
  async agreements(agencyId: string): Promise<AgreementWithProperty[]> {
    const { data, error } = await supabase
      .from('management_agreements')
      .select('*, property:agency_properties(id, title, code)')
      .eq('condominium_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(2000)
      .returns<AgreementWithProperty[]>()
    throwIf(error)
    return data ?? []
  },

  async saveAgreement(
    id: string | null,
    values: TablesInsert<'management_agreements'>,
  ): Promise<void> {
    const { error } = id
      ? await supabase
          .from('management_agreements')
          .update(values as TablesUpdate<'management_agreements'>)
          .eq('id', id)
      : await supabase.from('management_agreements').insert(values)
    throwIf(error)
  },

  async endAgreement(id: string, endDate: string): Promise<void> {
    const { error } = await supabase
      .from('management_agreements')
      .update({ status: 'ENDED', end_date: endDate })
      .eq('id', id)
    throwIf(error)
  },

  // -------------------------------------------------------------- codeudores
  async guarantors(leaseId: string): Promise<LeaseGuarantorRow[]> {
    const { data, error } = await supabase
      .from('lease_guarantors')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at')
    throwIf(error)
    return data ?? []
  },

  async addGuarantor(values: TablesInsert<'lease_guarantors'>): Promise<void> {
    const { error } = await supabase.from('lease_guarantors').insert(values)
    throwIf(error)
  },

  async removeGuarantor(id: string): Promise<void> {
    const { error } = await supabase.from('lease_guarantors').delete().eq('id', id)
    throwIf(error)
  },

  // ----------------------------------------------- vencimientos e incremento
  async adjustments(agencyId: string): Promise<LeaseRentAdjustmentRow[]> {
    const { data, error } = await supabase
      .from('lease_rent_adjustments')
      .select('*')
      .eq('condominium_id', agencyId)
      .order('effective_date', { ascending: false })
      .limit(2000)
    throwIf(error)
    return data ?? []
  },

  async applyRentIncrease(input: {
    leaseId: string
    indexPct: number
    effectiveDate: string
  }): Promise<{ new_rent: number; pct: number; updated_charges: number }> {
    const { data, error } = await supabase.rpc('apply_rent_increase', {
      p_lease: input.leaseId,
      p_index_pct: input.indexPct,
      p_effective: input.effectiveDate,
    })
    throwIf(error)
    return data as unknown as { new_rent: number; pct: number; updated_charges: number }
  },

  async registerNotice(
    leaseId: string,
    noticeGivenAt: string,
    noticeBy: 'ARRENDADOR' | 'ARRENDATARIO',
  ): Promise<void> {
    const { error } = await supabase
      .from('property_leases')
      .update({ notice_given_at: noticeGivenAt, notice_by: noticeBy })
      .eq('id', leaseId)
    throwIf(error)
  },

  async clearNotice(leaseId: string): Promise<void> {
    const { error } = await supabase
      .from('property_leases')
      .update({ notice_given_at: null, notice_by: null })
      .eq('id', leaseId)
    throwIf(error)
  },

  // ------------------------------------------------------- cobros adicionales
  async createCharge(input: {
    leaseId: string
    concept: 'UTILITIES' | 'LATE_FEE' | 'OTHER'
    amount: number
    description: string
    dueDate: string
  }): Promise<void> {
    const { error } = await supabase.rpc('create_lease_charge', {
      p_lease: input.leaseId,
      p_concept: input.concept,
      p_amount: input.amount,
      p_description: input.description,
      p_due_date: input.dueDate,
    })
    throwIf(error)
  },

  // ------------------------------------------------------------------ gastos
  async expenses(agencyId: string): Promise<ExpenseWithProperty[]> {
    const { data, error } = await supabase
      .from('property_expenses')
      .select('*, property:agency_properties(id, title, code)')
      .eq('condominium_id', agencyId)
      .order('expense_date', { ascending: false })
      .limit(2000)
      .returns<ExpenseWithProperty[]>()
    throwIf(error)
    return data ?? []
  },

  async addExpense(values: TablesInsert<'property_expenses'>): Promise<string> {
    const { data, error } = await supabase
      .from('property_expenses')
      .insert(values)
      .select('id')
      .single()
    throwIf(error)
    return (data as { id: string }).id
  },

  async removeExpense(id: string): Promise<void> {
    const { error } = await supabase.from('property_expenses').delete().eq('id', id)
    throwIf(error)
  },

  async approveExpense(id: string): Promise<void> {
    const { error } = await supabase.rpc('approve_property_expense', { p_expense: id })
    throwIf(error)
  },

  // ------------------------------------------------------------ liquidaciones
  async settlements(agencyId: string): Promise<SettlementWithProperty[]> {
    const { data, error } = await supabase
      .from('owner_settlements')
      .select('*, property:agency_properties(id, title, code)')
      .eq('condominium_id', agencyId)
      .neq('status', 'VOID')
      .order('period', { ascending: false })
      .limit(2000)
      .returns<SettlementWithProperty[]>()
    throwIf(error)
    return data ?? []
  },

  async settlementLines(settlementId: string): Promise<OwnerSettlementLineRow[]> {
    const { data, error } = await supabase
      .from('owner_settlement_lines')
      .select('*')
      .eq('settlement_id', settlementId)
    throwIf(error)
    return data ?? []
  },

  async generateSettlements(agencyId: string, period: string): Promise<number> {
    const { data, error } = await supabase.rpc('generate_owner_settlements', {
      p_condominium: agencyId,
      p_period: period,
    })
    throwIf(error)
    return data ?? 0
  },

  async regenerateSettlement(agreementId: string, period: string): Promise<void> {
    const { error } = await supabase.rpc('generate_owner_settlement', {
      p_agreement: agreementId,
      p_period: period,
    })
    throwIf(error)
  },

  async setSettlementStatus(
    id: string,
    status: 'APPROVED' | 'PAID' | 'VOID',
    reference?: string | null,
  ): Promise<void> {
    const { error } = await supabase.rpc('set_owner_settlement_status', {
      p_settlement: id,
      p_status: status,
      p_reference: reference ?? null,
    })
    throwIf(error)
  },

  // ------------------------------------------------------------------- firma
  async signers(leaseIds: string[]): Promise<LeaseSignerRow[]> {
    if (leaseIds.length === 0) return []
    const { data, error } = await supabase
      .from('lease_signers')
      .select(SIGNER_COLUMNS)
      .in('lease_id', leaseIds)
      .order('sort_order')
      .returns<LeaseSignerRow[]>()
    throwIf(error)
    return data ?? []
  },

  /** Firmas pendientes del usuario (arrendatario, propietario o codeudor con cuenta). */
  async mySigners(userId: string): Promise<LeaseSignerRow[]> {
    const { data, error } = await supabase
      .from('lease_signers')
      .select(SIGNER_COLUMNS)
      .eq('profile_id', userId)
      .is('signed_at', null)
      .returns<LeaseSignerRow[]>()
    throwIf(error)
    return data ?? []
  },

  async sendForSignature(leaseId: string, text: string, signers: SignerInput[]): Promise<void> {
    const { error } = await supabase.rpc('send_lease_for_signature', {
      p_lease: leaseId,
      p_text: text,
      p_signers: signers as unknown as Json,
    })
    throwIf(error)
  },

  async cancelSignature(leaseId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_lease_signature', { p_lease: leaseId })
    throwIf(error)
  },

  /** Enlace nuevo de firma (invalida el anterior). */
  async signingLink(signerId: string): Promise<string> {
    const { data, error } = await supabase.rpc('lease_signing_link', { p_signer: signerId })
    throwIf(error)
    return `${window.location.origin}/firmar/${data as string}`
  },

  async contractForSigning(token: string): Promise<SigningView | null> {
    const { data, error } = await supabase.rpc('lease_contract_for_signing', { p_token: token })
    throwIf(error)
    return (data as unknown as SigningView | null) ?? null
  },

  async signContract(input: {
    token: string
    name: string
    document: string
    signature: string
    hash: string
    accept: boolean
  }): Promise<{ complete: boolean }> {
    const { data, error } = await supabase.rpc('sign_lease_contract', {
      p_token: input.token,
      p_name: input.name,
      p_document: input.document,
      p_signature: input.signature,
      p_hash: input.hash,
      p_accept: input.accept,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    throwIf(error)
    return data as unknown as { complete: boolean }
  },

  /** Liquidaciones y firmas en vivo. */
  subscribe(agencyId: string, onChange: () => void): () => void {
    let channel: RealtimeChannel = supabase.channel(`agency-management:${agencyId}`)
    for (const table of ['owner_settlements', 'lease_signers']) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: DB_SCHEMA, table, filter: `condominium_id=eq.${agencyId}` },
        () => onChange(),
      )
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },
}

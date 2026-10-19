/**
 * Cumplimiento legal: datos del operador, prueba de las aceptaciones,
 * solicitudes de titulares (Ley 1581) y registro de vendedores (Ley 1480).
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { LegalDocumentKey, LegalEntity } from '@/features/legal/legal.logic'
import type {
  DataRequestRow,
  DataRequestStatus,
  DataRequestType,
  Json,
  LegalAcceptanceRow,
  SellerRegistryRow,
} from '@/types/database'

function browser(): string | null {
  return typeof navigator === 'undefined' ? null : navigator.userAgent.slice(0, 400)
}

export const legalService = {
  /** Publico: lo leen las paginas legales sin sesion. */
  async getEntity(): Promise<LegalEntity> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'legal_entity')
      .maybeSingle()
    if (error) throw toAppError(error)
    return (data?.value ?? {}) as LegalEntity
  },

  async updateEntity(entity: LegalEntity): Promise<void> {
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: entity as Json })
      .eq('key', 'legal_entity')
    if (error) throw toAppError(error)
  },

  async myAcceptances(userId: string): Promise<LegalAcceptanceRow[]> {
    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('*')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false })
    if (error) throw toAppError(error)
    return data
  },

  async accept(documents: LegalDocumentKey[], version: string): Promise<number> {
    const { data, error } = await supabase.rpc('accept_legal_documents', {
      p_documents: documents,
      p_version: version,
      p_user_agent: browser(),
    })
    if (error) throw toAppError(error)
    return data
  },

  userAgent: browser,

  async createRequest(type: DataRequestType, details: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('create_data_request', {
      p_type: type,
      p_details: details,
    })
    if (error) throw toAppError(error)
    return data
  },

  /** RLS: el titular ve las suyas; el SUPER_ADMIN, todas. */
  async listRequests(): Promise<DataRequestRow[]> {
    const { data, error } = await supabase
      .from('data_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw toAppError(error)
    return data
  },

  async resolveRequest(id: string, status: DataRequestStatus, response: string): Promise<string> {
    const { data, error } = await supabase.rpc('resolve_data_request', {
      p_request: id,
      p_status: status,
      p_response: response,
    })
    if (error) throw toAppError(error)
    return data
  },

  async exportMyData(): Promise<Json> {
    const { data, error } = await supabase.rpc('export_my_data')
    if (error) throw toAppError(error)
    return data
  },

  async sellerRegistry(listingId: string): Promise<SellerRegistryRow | null> {
    const { data, error } = await supabase
      .from('marketplace_seller_registry')
      .select('*')
      .eq('listing_id', listingId)
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },
}

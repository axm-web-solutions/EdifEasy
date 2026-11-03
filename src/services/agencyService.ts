/**
 * Inmobiliarias: propiedades, contratos de arriendo, cobros, interesados de la
 * tienda, ajustes de la tienda y cuenta Wompi propia.
 *
 * La tienda publica (sin sesion) solo usa los RPC storefront y
 * submit_agency_lead: nunca lee las tablas directamente.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import type {
  AgencyLeadRow,
  AgencyPropertyRow,
  Json,
  LeaseChargeRow,
  PaymentAccountRow,
  PropertyLeaseRow,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

export interface LeaseWithProperty extends PropertyLeaseRow {
  property: Pick<
    AgencyPropertyRow,
    'id' | 'title' | 'code' | 'city' | 'neighborhood' | 'address'
  > | null
}

export interface ChargeWithRelations extends LeaseChargeRow {
  property: Pick<AgencyPropertyRow, 'id' | 'title' | 'code'> | null
  lease: Pick<PropertyLeaseRow, 'id' | 'tenant_name' | 'tenant_phone'> | null
}

export interface LeadWithProperty extends AgencyLeadRow {
  property: Pick<AgencyPropertyRow, 'id' | 'title'> | null
}

/** Propiedad tal como la ve la tienda publica (sin direccion ni dueno). */
export interface StorefrontProperty {
  id: string
  code: string | null
  title: string
  property_type: AgencyPropertyRow['property_type']
  operation: AgencyPropertyRow['operation']
  status: AgencyPropertyRow['status']
  rent_price: number | null
  admin_fee: number
  sale_price: number | null
  neighborhood: string | null
  city: string | null
  stratum: number | null
  area_m2: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  floor: number | null
  furnished: boolean
  pets_allowed: boolean
  amenities: string[]
  description: string | null
  images: string[]
  published_at: string | null
  /** Ubicacion aproximada (~100 m). */
  lat: number | null
  lng: number | null
}

export interface Storefront {
  agency: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    city: string | null
    phone: string | null
    email: string | null
    description: string | null
    whatsapp: string | null
    primary_color: string | null
    hero_image: string | null
    hero_video: string | null
    tagline: string | null
  }
  properties: StorefrontProperty[]
}

export interface StoreSettings {
  slug: string | null
  description: string | null
  phone: string | null
  email: string | null
  whatsapp: string | null
  /** Portada de la tienda y color de la marca. */
  heroImage: string | null
  heroVideo: string | null
  tagline: string | null
  primaryColor: string | null
}

async function invokePayments<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(
    'wompi-payments',
    {
      body,
    },
  )
  if (error) {
    let message = 'No se pudo conectar con el servicio de pagos.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string } | null
      if (parsed?.error) message = parsed.error
    }
    throw new AppError(message, { code: 'EDGE_FUNCTION' })
  }
  if (!data || data.error)
    throw new AppError(data?.error ?? 'Respuesta vacia del servicio de pagos')
  return data
}

export const agencyService = {
  // ---------------------------------------------------------- propiedades
  async properties(agencyId: string): Promise<AgencyPropertyRow[]> {
    const { data, error } = await supabase
      .from('agency_properties')
      .select('*')
      .eq('condominium_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw toAppError(error)
    return data
  },

  async saveProperty(id: string | null, values: TablesInsert<'agency_properties'>): Promise<void> {
    const { error } = id
      ? await supabase
          .from('agency_properties')
          .update(values as TablesUpdate<'agency_properties'>)
          .eq('id', id)
      : await supabase.from('agency_properties').insert(values)
    if (error) throw toAppError(error)
  },

  async setPublished(id: string, isPublished: boolean): Promise<void> {
    const { error } = await supabase
      .from('agency_properties')
      .update({ is_published: isPublished })
      .eq('id', id)
    if (error) throw toAppError(error)
  },

  async removeProperty(id: string): Promise<void> {
    const { error } = await supabase.from('agency_properties').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // ------------------------------------------------------------ contratos
  async leases(agencyId: string): Promise<LeaseWithProperty[]> {
    const { data, error } = await supabase
      .from('property_leases')
      .select('*, property:agency_properties(id, title, code, city, neighborhood, address)')
      .eq('condominium_id', agencyId)
      .order('start_date', { ascending: false })
      .limit(1000)
      .returns<LeaseWithProperty[]>()
    if (error) throw toAppError(error)
    return data
  },

  async saveLease(id: string | null, values: TablesInsert<'property_leases'>): Promise<void> {
    const { error } = id
      ? await supabase
          .from('property_leases')
          .update(values as TablesUpdate<'property_leases'>)
          .eq('id', id)
      : await supabase.from('property_leases').insert(values)
    if (error) throw toAppError(error)
  },

  async endLease(id: string, endDate: string): Promise<void> {
    const { error } = await supabase
      .from('property_leases')
      .update({ status: 'ENDED', end_date: endDate })
      .eq('id', id)
    if (error) throw toAppError(error)
  },

  // --------------------------------------------------------------- cobros
  async charges(agencyId: string, from: string): Promise<ChargeWithRelations[]> {
    const { data, error } = await supabase
      .from('lease_charges')
      .select(
        '*, property:agency_properties(id, title, code), lease:property_leases(id, tenant_name, tenant_phone)',
      )
      .eq('condominium_id', agencyId)
      .gte('period', from)
      .order('period', { ascending: false })
      .order('due_date')
      .limit(2000)
      .returns<ChargeWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async generateCharges(agencyId: string, period: string): Promise<number> {
    const { data, error } = await supabase.rpc('generate_lease_charges', {
      p_condominium: agencyId,
      p_period: period,
    })
    if (error) throw toAppError(error)
    return data
  },

  async registerPayment(chargeIds: string[], method: 'CASH' | 'TRANSFER'): Promise<number> {
    const { data, error } = await supabase.rpc('register_lease_payment', {
      p_charges: chargeIds,
      p_method: method,
    })
    if (error) throw toAppError(error)
    return data
  },

  async voidCharge(chargeId: string): Promise<void> {
    const { error } = await supabase.rpc('void_lease_charge', { p_charge: chargeId })
    if (error) throw toAppError(error)
  },

  /** Arrendatario: paga en linea uno o varios cobros de su contrato. */
  payCharges(chargeIds: string[]) {
    return invokePayments<{ checkout_url: string }>({
      action: 'lease',
      charge_ids: chargeIds,
      origin: window.location.origin,
    })
  },

  // ---------------------------------------------------------- interesados
  async leads(agencyId: string): Promise<LeadWithProperty[]> {
    const { data, error } = await supabase
      .from('agency_leads')
      .select('*, property:agency_properties(id, title)')
      .eq('condominium_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<LeadWithProperty[]>()
    if (error) throw toAppError(error)
    return data
  },

  async setLeadStatus(id: string, status: AgencyLeadRow['status']): Promise<void> {
    const { error } = await supabase.from('agency_leads').update({ status }).eq('id', id)
    if (error) throw toAppError(error)
  },

  // ----------------------------------------------------- tienda y pagos
  async storeSettings(agencyId: string): Promise<StoreSettings> {
    const { data, error } = await supabase
      .from('condominiums')
      .select('slug, description, phone, email, settings')
      .eq('id', agencyId)
      .single()
    if (error) throw toAppError(error)
    const settings = (data.settings ?? {}) as Record<string, unknown>
    const store = (settings.store ?? {}) as Record<string, unknown>
    const text = (value: unknown) => (typeof value === 'string' && value ? value : null)
    return {
      slug: data.slug,
      description: data.description,
      phone: data.phone,
      email: data.email,
      whatsapp: text(settings.whatsapp),
      heroImage: text(store.heroImage),
      heroVideo: text(store.heroVideo),
      tagline: text(store.tagline),
      primaryColor: text(settings.primaryColor),
    }
  },

  async saveStoreSettings(agencyId: string, values: StoreSettings): Promise<void> {
    const { data: current, error: readError } = await supabase
      .from('condominiums')
      .select('settings')
      .eq('id', agencyId)
      .single()
    if (readError) throw toAppError(readError)
    const settings = {
      ...((current.settings ?? {}) as Record<string, Json>),
      whatsapp: values.whatsapp,
      ...(values.primaryColor ? { primaryColor: values.primaryColor } : {}),
      store: { heroImage: values.heroImage, heroVideo: values.heroVideo, tagline: values.tagline },
    }
    const { error } = await supabase
      .from('condominiums')
      .update({
        slug: values.slug,
        description: values.description,
        phone: values.phone,
        email: values.email,
        settings,
      })
      .eq('id', agencyId)
    if (error) {
      if (error.code === '23505')
        throw new AppError('Ese enlace ya lo usa otra inmobiliaria: elige otro.')
      throw toAppError(error)
    }
  },

  async paymentAccount(agencyId: string): Promise<PaymentAccountRow | null> {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('condominium_id', agencyId)
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  connectPaymentAccount(input: {
    condominiumId: string
    publicKey: string
    integritySecret: string
    eventsSecret: string
  }) {
    return invokePayments<{ environment: string; merchant: string }>({
      action: 'connect_account',
      condominium_id: input.condominiumId,
      public_key: input.publicKey,
      integrity_secret: input.integritySecret,
      events_secret: input.eventsSecret,
    })
  },

  disconnectPaymentAccount(condominiumId: string) {
    return invokePayments<{ ok: boolean }>({
      action: 'disconnect_account',
      condominium_id: condominiumId,
    })
  },

  // -------------------------------------------------------- tienda publica
  async storefront(slug: string): Promise<Storefront | null> {
    const { data, error } = await supabase.rpc('storefront', { p_slug: slug })
    if (error) throw toAppError(error)
    return (data as unknown as Storefront | null) ?? null
  },

  async submitLead(input: {
    slug: string
    propertyId: string | null
    name: string
    phone: string
    email: string | null
    message: string | null
    consent: boolean
  }): Promise<void> {
    const { error } = await supabase.rpc('submit_agency_lead', {
      p_slug: input.slug,
      p_property: input.propertyId,
      p_name: input.name,
      p_phone: input.phone,
      p_email: input.email,
      p_message: input.message,
      p_consent: input.consent,
    })
    if (error) throw toAppError(error)
  },

  /** Cobros e interesados en vivo. */
  subscribe(agencyId: string, onChange: () => void): () => void {
    let channel: RealtimeChannel = supabase.channel(`agency:${agencyId}`)
    for (const table of ['lease_charges', 'agency_leads']) {
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

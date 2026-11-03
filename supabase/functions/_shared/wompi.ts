// deno-lint-ignore-file no-explicit-any
/**
 * Utilidades compartidas por `wompi-payments` y `wompi-webhook`.
 *
 * Secretos requeridos (supabase secrets set ...):
 *   WOMPI_PUBLIC_KEY        pub_test_... (sandbox) o pub_prod_... (produccion)
 *   WOMPI_INTEGRITY_SECRET  test_integrity_... / prod_integrity_...
 *   WOMPI_EVENTS_SECRET     test_events_... / prod_events_...  (solo el webhook)
 *   APP_URLS                opcional: origenes permitidos para volver a la app,
 *                           separados por coma (https://app.edifeasy.com,...)
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

/** Debe coincidir con `DB_SCHEMA` en src/lib/supabase.ts */
export const DB_SCHEMA = 'tribuia'

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  // x-application-name: lo envia el cliente de Supabase de la app (src/lib/supabase.ts).
  // Si falta aqui, el navegador bloquea la llamada por CORS antes de llegar a la funcion.
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
export function serviceClient(): SupabaseClient<any, any, any> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Configuracion incompleta de la funcion')
  return createClient(url, key, {
    db: { schema: DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface WompiConfig {
  publicKey: string
  integritySecret: string
  eventsSecret: string | null
  sandbox: boolean
  apiBase: string
}

export const SANDBOX_API = 'https://sandbox.wompi.co/v1'
export const PRODUCTION_API = 'https://production.wompi.co/v1'

function configFromKeys(
  publicKey: string,
  integritySecret: string,
  eventsSecret: string | null,
): WompiConfig {
  const sandbox = publicKey.startsWith('pub_test_')
  return {
    publicKey,
    integritySecret,
    eventsSecret,
    sandbox,
    apiBase: sandbox ? SANDBOX_API : PRODUCTION_API,
  }
}

/** Cuenta Wompi de EdiFeasy (planes, y espacios que no conectaron la suya). */
export function wompiConfig(): WompiConfig {
  const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY') ?? ''
  const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? ''
  if (!publicKey || !integritySecret) {
    throw new Error('Wompi no esta configurado: faltan WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET')
  }
  return configFromKeys(publicKey, integritySecret, Deno.env.get('WOMPI_EVENTS_SECRET') ?? null)
}

/**
 * Cuenta Wompi propia de un conjunto o inmobiliaria (tabla payment_accounts).
 * Con ella el dinero llega directo a ese espacio. null si no la ha conectado.
 */
export async function accountConfig(
  admin: SupabaseClient,
  condominiumId: string,
): Promise<WompiConfig | null> {
  const { data: account } = await admin
    .from('payment_accounts')
    .select('public_key')
    .eq('condominium_id', condominiumId)
    .maybeSingle()
  if (!account) return null
  const { data: secret } = await admin
    .from('payment_account_secrets')
    .select('integrity_secret, events_secret')
    .eq('condominium_id', condominiumId)
    .maybeSingle()
  if (!secret) return null
  return configFromKeys(account.public_key, secret.integrity_secret, secret.events_secret)
}

/** Verifica que la llave publica exista en Wompi; devuelve el nombre del comercio. */
export async function validateMerchant(publicKey: string): Promise<string> {
  const base = publicKey.startsWith('pub_test_') ? SANDBOX_API : PRODUCTION_API
  const response = await fetch(`${base}/merchants/${encodeURIComponent(publicKey)}`)
  if (!response.ok) throw new Error('Wompi no reconoce esa llave publica')
  const body = await response.json()
  return body?.data?.name ?? 'Comercio Wompi'
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Referencia unica del pago, legible en el panel de Wompi. */
export function newReference(prefix: 'ADM' | 'PLAN' | 'MUL' | 'RES' | 'ARR'): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()
  return `EDF-${prefix}-${Date.now().toString(36).toUpperCase()}-${random}`
}

/** URL del Web Checkout de Wompi con la firma de integridad. */
export async function checkoutUrl(input: {
  reference: string
  amountInCents: number
  redirectUrl: string
  email?: string | null
  /** Cuenta propia del espacio; sin ella se usa la de EdiFeasy. */
  config?: WompiConfig | null
}): Promise<string> {
  const config = input.config ?? wompiConfig()
  const signature = await sha256Hex(
    `${input.reference}${input.amountInCents}COP${config.integritySecret}`,
  )
  const params = new URLSearchParams({
    'public-key': config.publicKey,
    currency: 'COP',
    'amount-in-cents': String(input.amountInCents),
    reference: input.reference,
    'signature:integrity': signature,
    'redirect-url': input.redirectUrl,
  })
  if (input.email) params.set('customer-data:email', input.email)
  return `https://checkout.wompi.co/p/?${params.toString()}`
}

/**
 * Valida el origen al que Wompi devuelve al usuario. Si APP_URLS esta definido
 * solo se aceptan esos origenes (evita usar la app como redireccion abierta).
 */
export function resolveRedirect(origin: unknown, path: string): string {
  const value = String(origin ?? '').replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Origen de retorno invalido')
  }
  const allowed = (Deno.env.get('APP_URLS') ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  if (allowed.length > 0 && !allowed.includes(parsed.origin)) {
    throw new Error('Origen de retorno no permitido')
  }
  return `${parsed.origin}${path}`
}

/**
 * Consulta una transaccion en el API publico de Wompi. Las cuentas propias
 * pueden estar en otro ambiente (pruebas o produccion): se intenta en ambos.
 */
export async function fetchTransaction(transactionId: string): Promise<any> {
  let primary = PRODUCTION_API
  try {
    primary = wompiConfig().apiBase
  } catch {
    // Sin cuenta de EdiFeasy configurada: se prueba produccion y luego pruebas.
  }
  const bases = [primary, primary === SANDBOX_API ? PRODUCTION_API : SANDBOX_API]
  let lastStatus = 0
  for (const base of bases) {
    const response = await fetch(`${base}/transactions/${encodeURIComponent(transactionId)}`)
    if (response.ok) {
      const body = await response.json()
      if (body?.data) return body.data
    }
    lastStatus = response.status
  }
  throw new Error(`Wompi respondio ${lastStatus} al consultar la transaccion`)
}

/** Registra en la base el resultado de una transaccion de Wompi. */
export async function applyTransaction(admin: SupabaseClient, transaction: any) {
  const { data, error } = await admin.rpc('apply_payment_result', {
    p_reference: transaction.reference,
    p_transaction_id: transaction.id,
    p_status: transaction.status,
    p_amount_in_cents: transaction.amount_in_cents,
    p_currency: transaction.currency,
    p_method: transaction.payment_method_type ?? null,
    p_message: transaction.status_message ?? null,
    p_payload: transaction,
  })
  if (error) throw new Error(error.message)
  return data as { id: string; status: string; kind: string }
}

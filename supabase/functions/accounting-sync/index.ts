// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: accounting-sync
 * ----------------------------------------------------------------------------
 * Conexion con sistemas contables por API (Siigo y Alegra). Los proveedores de
 * escritorio (World Office, Helisa, ContaPyme...) se cargan por archivo desde la
 * app; esta funcion no los necesita.
 *
 * Acciones (POST JSON, con la sesion del administrador):
 *   { action: 'connect', condominium_id, provider, credentials, settings }
 *       valida las credenciales con el proveedor, las guarda (solo el servidor
 *       las puede leer) y sincroniza por primera vez.
 *   { action: 'sync', integration_id }
 *   { action: 'disconnect', integration_id }
 *   { action: 'sync_all' }   solo con la service role (tarea programada).
 *
 * Credenciales por proveedor:
 *   SIIGO:  { username, access_key }   (usuario API y llave de acceso de Siigo Nube)
 *   ALEGRA: { email, token }           (correo y token de la API de Alegra)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { DB_SCHEMA, json, serviceClient } from '../_shared/wompi.ts'
import {
  buildAccountingRows,
  fromAlegraInvoice,
  fromAlegraPayment,
  fromSiigoInvoice,
  fromSiigoVoucher,
  syncStartDate,
  type AccountingSettings,
  type NormalizedDocument,
} from '../_shared/accounting.ts'

const MAX_DOCS = 5000
const SIIGO_API = 'https://api.siigo.com'
const ALEGRA_API = 'https://api.alegra.com/api/v1'

class UserError extends Error {}

// ------------------------------------------------------------------ Alegra
function alegraHeaders(credentials: any): Record<string, string> {
  if (!credentials?.email || !credentials?.token) {
    throw new UserError('Alegra necesita el correo y el token de la API')
  }
  return {
    Authorization: `Basic ${btoa(`${credentials.email}:${credentials.token}`)}`,
    Accept: 'application/json',
  }
}

async function alegraGet(credentials: any, path: string): Promise<any> {
  const response = await fetch(`${ALEGRA_API}${path}`, { headers: alegraHeaders(credentials) })
  if (response.status === 401 || response.status === 403) {
    throw new UserError('Alegra rechazo las credenciales: revisa el correo y el token')
  }
  if (!response.ok) throw new Error(`Alegra respondio ${response.status} en ${path.split('?')[0]}`)
  return response.json()
}

async function alegraValidate(credentials: any): Promise<string> {
  const company = await alegraGet(credentials, '/company')
  return company?.name ?? 'Alegra'
}

async function alegraList(credentials: any, resource: string, extra = ''): Promise<any[]> {
  const rows: any[] = []
  // Alegra devuelve maximo 30 por pagina.
  for (let start = 0; rows.length < MAX_DOCS; start += 30) {
    const page = await alegraGet(
      credentials,
      `/${resource}?start=${start}&limit=30&order_direction=DESC&order_field=date${extra}`,
    )
    const items = Array.isArray(page) ? page : (page?.data ?? [])
    rows.push(...items)
    if (items.length < 30) break
  }
  return rows
}

async function alegraDocs(credentials: any, since: string): Promise<NormalizedDocument[]> {
  const [invoices, payments] = await Promise.all([
    alegraList(credentials, 'invoices'),
    alegraList(credentials, 'payments', '&type=in'),
  ])
  return [...invoices.map(fromAlegraInvoice), ...payments.map(fromAlegraPayment)].filter(
    (doc): doc is NormalizedDocument => Boolean(doc && doc.date >= since),
  )
}

// ------------------------------------------------------------------- Siigo
async function siigoToken(credentials: any): Promise<string> {
  if (!credentials?.username || !credentials?.access_key) {
    throw new UserError('Siigo necesita el usuario API y la llave de acceso')
  }
  const response = await fetch(`${SIIGO_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Partner-Id': 'EdiFeasy' },
    body: JSON.stringify({ username: credentials.username, access_key: credentials.access_key }),
  })
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new UserError(
      'Siigo rechazo las credenciales: revisa el usuario API y la llave de acceso',
    )
  }
  if (!response.ok) throw new Error(`Siigo respondio ${response.status} al autenticar`)
  const body = await response.json()
  if (!body?.access_token) throw new Error('Siigo no entrego un token de acceso')
  return body.access_token
}

async function siigoList(token: string, resource: string, since: string): Promise<any[]> {
  const rows: any[] = []
  for (let page = 1; rows.length < MAX_DOCS; page += 1) {
    const response = await fetch(
      `${SIIGO_API}/v1/${resource}?page=${page}&page_size=100&date_start=${since}`,
      { headers: { Authorization: `Bearer ${token}`, 'Partner-Id': 'EdiFeasy' } },
    )
    if (!response.ok) throw new Error(`Siigo respondio ${response.status} en ${resource}`)
    const body = await response.json()
    const items = body?.results ?? []
    rows.push(...items)
    const total = Number(body?.pagination?.total_results ?? 0)
    if (items.length < 100 || rows.length >= total) break
  }
  return rows
}

async function siigoDocs(credentials: any, since: string): Promise<NormalizedDocument[]> {
  const token = await siigoToken(credentials)
  const [invoices, vouchers] = await Promise.all([
    siigoList(token, 'invoices', since),
    siigoList(token, 'vouchers', since),
  ])
  return [...invoices.map(fromSiigoInvoice), ...vouchers.map(fromSiigoVoucher)].filter(
    (doc): doc is NormalizedDocument => Boolean(doc),
  )
}

// ---------------------------------------------------------------- comun
async function validate(provider: string, credentials: any): Promise<string> {
  if (provider === 'ALEGRA') return alegraValidate(credentials)
  if (provider === 'SIIGO') {
    await siigoToken(credentials)
    return 'Siigo Nube'
  }
  throw new UserError('Este sistema se conecta por archivo, no por API')
}

async function syncIntegration(admin: any, integrationId: string) {
  const { data: integration, error } = await admin
    .from('accounting_integrations')
    .select('id, condominium_id, provider, mode, settings')
    .eq('id', integrationId)
    .single()
  if (error || !integration) throw new UserError('La conexion no existe')
  if (integration.mode !== 'API')
    throw new UserError('Esta conexion se actualiza cargando archivos')

  const { data: secret } = await admin
    .from('accounting_secrets')
    .select('credentials')
    .eq('integration_id', integrationId)
    .single()
  if (!secret) throw new UserError('Faltan las credenciales: vuelve a conectar')

  const settings: AccountingSettings = integration.settings ?? {}
  const today = new Date().toISOString().slice(0, 10)
  const since = syncStartDate(today, settings.monthsBack ?? 12)

  try {
    const docs =
      integration.provider === 'ALEGRA'
        ? await alegraDocs(secret.credentials, since)
        : await siigoDocs(secret.credentials, since)
    const rows = buildAccountingRows(docs, { today, matchBy: settings.matchBy })

    const statements = await admin.rpc('import_accounting_data', {
      p_condominium: integration.condominium_id,
      p_kind: 'UNIT_STATEMENTS',
      p_rows: rows.statements,
      p_source: 'API',
      p_integration: integration.id,
    })
    if (statements.error) throw new Error(statements.error.message)
    const movements = await admin.rpc('import_accounting_data', {
      p_condominium: integration.condominium_id,
      p_kind: 'UNIT_MOVEMENTS',
      p_rows: rows.movements,
      p_source: 'API',
      p_integration: integration.id,
    })
    if (movements.error) throw new Error(movements.error.message)

    return {
      documents: docs.length,
      statements: statements.data,
      movements: movements.data,
      withoutUnit: rows.withoutUnit,
    }
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : 'Error inesperado'
    await admin
      .from('accounting_integrations')
      .update({ status: 'ERROR', last_error: message.slice(0, 300) })
      .eq('id', integration.id)
    await admin.from('accounting_sync_runs').insert({
      condominium_id: integration.condominium_id,
      integration_id: integration.id,
      source: 'API',
      kind: 'UNIT_STATEMENTS',
      status: 'ERROR',
      error: message.slice(0, 300),
      created_by: null,
    })
    throw syncError
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = serviceClient()

  try {
    // Tarea programada: sincroniza todas las conexiones por API.
    if (body?.action === 'sync_all') {
      if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
        return json({ error: 'No autorizado' }, 401)
      }
      const { data: list } = await admin
        .from('accounting_integrations')
        .select('id')
        .eq('mode', 'API')
        .in('status', ['CONNECTED', 'ERROR'])
      const results: Record<string, string> = {}
      for (const item of list ?? []) {
        try {
          await syncIntegration(admin, item.id)
          results[item.id] = 'ok'
        } catch (error) {
          results[item.id] = error instanceof Error ? error.message : 'error'
        }
      }
      return json({ ok: true, results })
    }

    // Resto de acciones: administracion del conjunto.
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      db: { schema: DB_SCHEMA },
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData } = await caller.auth.getUser()
    if (!userData?.user) return json({ error: 'Inicia sesion de nuevo' }, 401)

    let condominiumId: string | null = body?.condominium_id ?? null
    if (body?.integration_id) {
      const { data: integration } = await admin
        .from('accounting_integrations')
        .select('condominium_id')
        .eq('id', body.integration_id)
        .single()
      condominiumId = integration?.condominium_id ?? null
    }
    if (!condominiumId) return json({ error: 'Falta el conjunto' }, 400)
    // Administracion o contador del conjunto.
    const { data: canManage } = await caller.rpc('can_manage_accounting', {
      p_condominium: condominiumId,
    })
    if (!canManage)
      return json(
        { error: 'Solo la administracion o el contador pueden conectar la contabilidad' },
        403,
      )

    if (body.action === 'connect') {
      const provider = String(body.provider ?? '')
      if (!['SIIGO', 'ALEGRA'].includes(provider)) {
        return json({ error: 'Por API se conectan Siigo y Alegra; los demas, por archivo' }, 400)
      }
      const displayName = await validate(provider, body.credentials)
      const settings = {
        matchBy: body.settings?.matchBy === 'IDENTIFICATION' ? 'IDENTIFICATION' : 'CODE_IN_NAME',
        monthsBack: Math.max(1, Math.min(36, Number(body.settings?.monthsBack ?? 12))),
      }
      const { data: integration, error } = await admin
        .from('accounting_integrations')
        .upsert(
          {
            condominium_id: condominiumId,
            provider,
            mode: 'API',
            status: 'CONNECTED',
            display_name: displayName,
            settings,
            last_error: null,
            created_by: userData.user.id,
          },
          { onConflict: 'condominium_id,provider' },
        )
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      const { error: secretError } = await admin.from('accounting_secrets').upsert({
        integration_id: integration.id,
        credentials: body.credentials,
        updated_at: new Date().toISOString(),
      })
      if (secretError) throw new Error(secretError.message)
      const result = await syncIntegration(admin, integration.id)
      return json({ ok: true, integration_id: integration.id, result })
    }

    if (body.action === 'sync') {
      const result = await syncIntegration(admin, body.integration_id)
      return json({ ok: true, result })
    }

    if (body.action === 'disconnect') {
      const { error } = await admin
        .from('accounting_integrations')
        .delete()
        .eq('id', body.integration_id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    return json({ error: 'Accion no valida' }, 400)
  } catch (error) {
    if (error instanceof UserError) return json({ error: error.message }, 400)
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500)
  }
})

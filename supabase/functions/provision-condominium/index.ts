// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: provision-condominium
 * ----------------------------------------------------------------------------
 * Alta completa de un conjunto a partir de los datos del RUT. Solo SUPER_ADMIN.
 *
 *   1. provision_condominium (RPC, con el JWT del super admin): conjunto,
 *      torres o casas y unidades.
 *   2. Cuentas en Supabase Auth (service role): el representante legal como
 *      administrador y un propietario por unidad con correo
 *      <unidad>.<slug>@ventofast.com y clave temporal aleatoria.
 *   3. attach_provisioned_accounts (RPC): membresias, propietarios, residentes.
 *
 * Si algo falla se borran el conjunto y las cuentas creadas en esta llamada.
 * Las claves solo viajan en la respuesta; no se guardan en ningun lado.
 *
 * Deploy:
 *   supabase functions deploy provision-condominium
 *
 * POST JSON (conjunto nuevo):
 *   { condominium: { name, nit, address, city, department, phone, email },
 *     admin: { full_name, email },
 *     layout: { kind: 'HOUSES', houses } | { kind: 'TOWERS', towers, floors, units_per_floor },
 *     email_slug }
 *
 * POST JSON (cuentas de propietarios para un conjunto ya creado):
 *   { mode: 'existing', condominium_id, email_slug }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { CORS_HEADERS, DB_SCHEMA, json, serviceClient } from '../_shared/wompi.ts'

/** Debe coincidir con RESIDENT_EMAIL_DOMAIN del frontend (rut.logic.ts). */
const RESIDENT_EMAIL_DOMAIN = 'ventofast.com'
const MAX_UNITS = 3000
const CONCURRENCY = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Clave temporal: 12 caracteres sin ambiguos (0/O, 1/l), con mayuscula, minuscula y digito. */
function temporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  const pick = (set: string, index: number) => set[bytes[index] % set.length]
  const chars = [pick(upper, 0), pick(lower, 1), pick(digits, 2)]
  for (let i = 3; i < 12; i++) chars.push(pick(all, i))
  // Mezcla para que la mayuscula no quede siempre al inicio.
  const order = crypto.getRandomValues(new Uint32Array(chars.length))
  return chars
    .map((char, i) => ({ char, key: order[i] }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.char)
    .join('')
}

/** Misma regla que unitEmail() del frontend. */
function unitEmail(slug: string, number: string, tower: number | string | null): string {
  const local = tower ? `t${tower}-${number}` : number
  return `${local}.${slug}@${RESIDENT_EMAIL_DOMAIN}`
}

function text(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max)
}

function toInt(value: unknown): number {
  const number = Number(value)
  return Number.isInteger(number) ? number : 0
}

/**
 * Ejecuta `fn` con un maximo de `limit` en paralelo. Ante el primer error deja
 * de tomar trabajo nuevo pero ESPERA a los que estan en curso, para que el
 * rollback conozca todas las cuentas creadas.
 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let failure: unknown = null
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (failure === null && next < items.length) {
      const index = next++
      try {
        results[index] = await fn(items[index])
      } catch (error) {
        failure ??= error
      }
    }
  })
  await Promise.all(workers)
  if (failure !== null) throw failure
  return results
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: 'Configuracion incompleta de la funcion' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'No autenticado' }, 401)

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  // Cliente con el JWT del solicitante: las RPC verifican que sea SUPER_ADMIN.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    db: { schema: DB_SCHEMA },
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Sesion invalida' }, 401)

  const { data: isSuper, error: superError } = await caller.rpc('is_super_admin')
  if (superError) return json({ error: superError.message }, 500)
  if (isSuper !== true) return json({ error: 'Solo el super administrador puede dar de alta conjuntos' }, 403)

  const slug = text(payload?.email_slug, 30).toLowerCase()
  if (!/^[a-z0-9]{3,30}$/.test(slug))
    return json({ error: 'El identificador de correos debe tener de 3 a 30 letras o numeros' }, 400)

  const admin = serviceClient()
  const createdUsers: string[] = []
  let condominiumId: string | null = null

  /** Crea la cuenta; si el correo ya existe, reutiliza el perfil sin tocar su clave. */
  async function ensureUser(email: string, fullName: string) {
    const password = temporaryPassword()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (!error && data?.user) {
      createdUsers.push(data.user.id)
      return { id: data.user.id as string, password: password as string | null, existing: false }
    }
    const pattern = email.replace(/[\\%_]/g, (char) => `\\${char}`)
    const { data: profile } = await admin.from('profiles').select('id').ilike('email', pattern).maybeSingle()
    if (profile?.id) return { id: profile.id as string, password: null, existing: true }
    throw new Error(`No se pudo crear la cuenta ${email}: ${error?.message ?? 'error desconocido'}`)
  }


  // ------------------------------------------------- cuentas de un conjunto existente
  // { mode: 'existing', condominium_id, email_slug }: crea un propietario por
  // cada unidad que aun no tiene (p. ej. conjuntos creados antes del alta por RUT).
  if (payload?.mode === 'existing') {
    const existingId = text(payload?.condominium_id, 40)
    const { data: units, error: unitsError } = await caller.rpc('units_without_owner', {
      p_condominium: existingId,
    })
    if (unitsError) return json({ error: unitsError.message }, 400)
    const pendingUnits = (units ?? []) as { apartment_id: string; tower: string | null; number: string; label: string }[]
    if (pendingUnits.length === 0) return json({ error: 'Todas las unidades ya tienen propietario' }, 400)
    if (pendingUnits.length > MAX_UNITS) return json({ error: `Maximo ${MAX_UNITS} unidades por alta` }, 400)
    const { data: condoRow } = await admin.from('condominiums').select('name').eq('id', existingId).maybeSingle()

    try {
      const ownerAccounts = await mapLimit(pendingUnits, CONCURRENCY, async (unit) => {
        const email = unitEmail(slug, unit.number, unit.tower)
        const account = await ensureUser(email, `Propietario ${unit.label}`)
        return { unit, email, ...account }
      })
      const { error: attachError } = await caller.rpc('attach_provisioned_accounts', {
        p_condominium: existingId,
        p_admin: null,
        p_owners: ownerAccounts.map((account) => ({
          apartment_id: account.unit.apartment_id,
          profile_id: account.id,
        })),
      })
      if (attachError) throw new Error(attachError.message)
      return json({
        condominium_id: existingId,
        condominium_name: condoRow?.name ?? '',
        admin: null,
        accounts: ownerAccounts.map((account) => ({
          unit: account.unit.label,
          email: account.email,
          password: account.password,
          existing: account.existing,
        })),
      })
    } catch (error) {
      await Promise.allSettled(createdUsers.map((id) => admin.auth.admin.deleteUser(id)))
      return json({ error: (error as Error).message ?? 'No se pudieron crear las cuentas' }, 500)
    }
  }

  // ------------------------------------------------------------------ validacion
  const condo = payload?.condominium ?? {}
  const adminInput = payload?.admin ?? {}
  const layout = payload?.layout ?? {}
  const adminEmail = text(adminInput.email, 254).toLowerCase()
  const adminName = text(adminInput.full_name, 150)

  if (!EMAIL.test(adminEmail)) return json({ error: 'Correo del administrador invalido' }, 400)
  if (adminEmail.endsWith(`@${RESIDENT_EMAIL_DOMAIN}`))
    return json({ error: `El administrador debe usar un correo real, no @${RESIDENT_EMAIL_DOMAIN}` }, 400)
  if (adminName.length < 3) return json({ error: 'Nombre del administrador invalido' }, 400)

  const kind = text(layout.kind, 10).toUpperCase()
  const total =
    kind === 'HOUSES'
      ? toInt(layout.houses)
      : toInt(layout.towers) * toInt(layout.floors) * toInt(layout.units_per_floor)
  if (total < 1 || total > MAX_UNITS)
    return json({ error: `El conjunto debe tener entre 1 y ${MAX_UNITS} unidades` }, 400)

  try {
    // 1. Conjunto y unidades
    const { data: provisioned, error: provisionError } = await caller.rpc('provision_condominium', {
      p_payload: {
        kind,
        name: text(condo.name, 150),
        nit: text(condo.nit, 20),
        address: text(condo.address),
        city: text(condo.city, 80),
        department: text(condo.department, 80),
        phone: text(condo.phone, 30),
        email: text(condo.email, 254),
        houses: toInt(layout.houses),
        towers: toInt(layout.towers),
        floors: toInt(layout.floors),
        units_per_floor: toInt(layout.units_per_floor),
      },
    })
    if (provisionError) return json({ error: provisionError.message }, 400)
    condominiumId = provisioned.condominium_id as string
    const units = provisioned.units as { apartment_id: string; tower: number | null; number: string; label: string }[]

    // 2. Cuentas
    const adminAccount = await ensureUser(adminEmail, adminName)
    const ownerAccounts = await mapLimit(units, CONCURRENCY, async (unit) => {
      const email = unitEmail(slug, unit.number, unit.tower)
      const account = await ensureUser(email, `Propietario ${unit.label}`)
      return { unit, email, ...account }
    })

    // 3. Vinculos
    const { error: attachError } = await caller.rpc('attach_provisioned_accounts', {
      p_condominium: condominiumId,
      p_admin: adminAccount.id,
      p_owners: ownerAccounts.map((account) => ({
        apartment_id: account.unit.apartment_id,
        profile_id: account.id,
      })),
    })
    if (attachError) throw new Error(attachError.message)

    return json({
      condominium_id: condominiumId,
      condominium_name: text(condo.name, 150),
      admin: { email: adminEmail, password: adminAccount.password, existing: adminAccount.existing },
      accounts: ownerAccounts.map((account) => ({
        unit: account.unit.label,
        email: account.email,
        password: account.password,
        existing: account.existing,
      })),
    })
  } catch (error) {
    // Deshace lo creado en esta llamada.
    await Promise.allSettled(createdUsers.map((id) => admin.auth.admin.deleteUser(id)))
    if (condominiumId) await admin.from('condominiums').delete().eq('id', condominiumId)
    return json({ error: (error as Error).message ?? 'No se pudo completar el alta' }, 500)
  }
})

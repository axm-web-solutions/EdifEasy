/**
 * Crea (o actualiza) los usuarios de prueba en Supabase Auth usando la Admin API.
 *
 *   npm run seed
 *
 * Requiere en `.env`:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   SEED_DEFAULT_PASSWORD=...            (opcional)
 *
 * La service role key SOLO se usa aqui, en Node. Nunca en el frontend.
 *
 * Orden recomendado:
 *   1) supabase/schema.sql   (SQL Editor)
 *   2) npm run seed          (este script)
 *   3) supabase/seed.sql     (SQL Editor)
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { SEED_USERS, type SeedUser } from './seed-data'

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\n[seed] Faltan variables de entorno.\n' +
      'Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu archivo .env\n' +
      '(copia .env.example como .env y completa los valores).\n',
  )
  process.exit(1)
}

/**
 * Valida la clave de los usuarios de prueba.
 *
 * No hay valor por defecto a proposito: un literal en el repositorio equivale a
 * publicar la credencial de 12 cuentas. Ademas se rechazan las claves debiles o
 * predecibles, que es exactamente el problema del antiguo `EdiFeasy2024*`.
 */
function assertSeedPassword(password: string): string {
  const problemas: string[] = []

  if (!password) {
    problemas.push('no esta definida')
  } else {
    if (password.length < 12) problemas.push('debe tener al menos 12 caracteres')
    if (!/[A-Z]/.test(password)) problemas.push('debe incluir una mayuscula')
    if (!/[a-z]/.test(password)) problemas.push('debe incluir una minuscula')
    if (!/[0-9]/.test(password)) problemas.push('debe incluir un numero')
    if (!/[^A-Za-z0-9]/.test(password)) problemas.push('debe incluir un simbolo')
    if (/edifeasy|password|contrasena|123456|qwerty|admin/i.test(password)) {
      problemas.push('contiene una palabra predecible')
    }
  }

  if (problemas.length > 0) {
    console.error(
      '\n[seed] La clave de los usuarios de prueba no es valida:\n' +
        problemas.map((problema) => `  - ${problema}`).join('\n') +
        '\n\nDefine una clave temporal fuerte en tu .env:\n' +
        '  SEED_DEFAULT_PASSWORD=<clave-temporal-fuerte>\n' +
        '\nNo uses la clave de produccion: estas cuentas son de prueba y quedan\n' +
        'con acceso a los datos del proyecto donde se ejecute el seed.\n',
    )
    process.exit(1)
  }

  return password
}

const PASSWORD = assertSeedPassword((process.env.SEED_DEFAULT_PASSWORD ?? '').trim())

/** Debe coincidir con `DB_SCHEMA` en src/lib/supabase.ts */
const DB_SCHEMA = 'tribuia'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: DB_SCHEMA },
  auth: { autoRefreshToken: false, persistSession: false },
})

async function listAllUsers(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    for (const user of data.users) {
      if (user.email) map.set(user.email.toLowerCase(), user.id)
    }
    if (data.users.length < perPage) break
    page += 1
  }

  return map
}

async function upsertUser(user: SeedUser, existingId: string | undefined): Promise<string> {
  const metadata = {
    full_name: user.fullName,
    phone: user.phone,
    document_number: user.documentNumber,
    document_type: 'CC',
    seed_role: user.role,
  }

  if (existingId) {
    const { data, error } = await admin.auth.admin.updateUserById(existingId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw error
    return data.user.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error
  return data.user.id
}

async function main(): Promise<void> {
  console.log('[seed] Conectando a', SUPABASE_URL)
  const existing = await listAllUsers()

  let created = 0
  let updated = 0

  for (const user of SEED_USERS) {
    const existingId = existing.get(user.email.toLowerCase())
    try {
      const id = await upsertUser(user, existingId)
      if (existingId) {
        updated += 1
        console.log(`  ~ actualizado  ${user.email.padEnd(32)} ${id}`)
      } else {
        created += 1
        console.log(`  + creado       ${user.email.padEnd(32)} ${id}`)
      }
    } catch (error) {
      console.error(`  ! error con ${user.email}:`, (error as Error).message)
      process.exitCode = 1
    }
  }

  // El trigger `handle_new_user` ya creo los perfiles; los sincronizamos por si
  // el trigger no existia cuando se crearon los usuarios manualmente.
  const refreshed = await listAllUsers()
  const profiles = SEED_USERS.map((user) => ({
    id: refreshed.get(user.email.toLowerCase()) as string,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    document_number: user.documentNumber,
    document_type: 'CC',
    status: 'ACTIVE' as const,
  })).filter((row) => Boolean(row.id))

  const { error: profileError } = await admin.from('profiles').upsert(profiles, { onConflict: 'id' })
  if (profileError) {
    console.error('[seed] Error sincronizando perfiles:', profileError.message)
    process.exitCode = 1
  }

  console.log(
    `\n[seed] Listo. Creados: ${created} | Actualizados: ${updated} | Perfiles sincronizados: ${profiles.length}`,
  )
  console.log(`[seed] Password para todos los usuarios de prueba: ${PASSWORD}`)
  console.log('[seed] Siguiente paso: ejecutar supabase/seed.sql en el SQL Editor.\n')
}

main().catch((error: unknown) => {
  console.error('[seed] Fallo inesperado:', error)
  process.exit(1)
})

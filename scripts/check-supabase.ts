/**
 * Diagnostico de conexion con Supabase.
 *
 *   npm run check
 *
 * Verifica, en orden, todo lo que el registro de usuarios necesita:
 *   1. Variables de entorno
 *   2. Alcance de la API REST
 *   3. Exposicion del esquema `tribuia` en PostgREST
 *   4. Existencia de las tablas
 *   5. RPC de autoregistro llamables sin sesion
 *   6. Estado de Auth (signup habilitado, confirmacion de correo)
 *   7. Datos existentes (requiere la clave secreta)
 *
 * No imprime ninguna clave.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv()

const DB_SCHEMA = 'tribuia'

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const PUBLIC_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'


const GREEN = '[32m'
const RED = '[31m'
const YELLOW = '[33m'
const BOLD = '[1m'
const RESET = '[0m'

let failures = 0
let warnings = 0

function ok(label: string, detail = ''): void {
  console.log(`  ${GREEN}OK${RESET}    ${label}${detail ? ` -> ${detail}` : ''}`)
}

function fail(label: string, detail = ''): void {
  failures += 1
  console.log(`  ${RED}FALLA${RESET} ${label}${detail ? ` -> ${detail}` : ''}`)
}

function warn(label: string, detail = ''): void {
  warnings += 1
  console.log(`  ${YELLOW}AVISO${RESET} ${label}${detail ? ` -> ${detail}` : ''}`)
}

function section(title: string): void {
  console.log(`\n${BOLD}${title}${RESET}`)
}

/**
 * Las tablas esperadas se leen del propio `schema.sql`, no de una lista fija:
 * asi el diagnostico siempre compara el repositorio contra la base real y
 * detecta cuando la base quedo desactualizada.
 */
function expectedTables(): string[] {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8')
  const matches = sql.matchAll(/^create table if not exists tribuia\.(\w+)/gm)
  return [...new Set([...matches].map((match) => match[1]))]
}

/** RPC que el frontend invoca, con argumentos seguros (no escriben nada). */
const RPC_PROBES: { name: string; args: Record<string, unknown> }[] = [
  { name: 'registration_catalog', args: {} },
  { name: 'registration_buildings', args: { p_condominium: ZERO_UUID } },
  { name: 'registration_apartments', args: { p_building: ZERO_UUID } },
  {
    name: 'complete_self_registration',
    args: {
      p_condominium: ZERO_UUID,
      p_building: ZERO_UUID,
      p_apartment: ZERO_UUID,
      p_user_type: 'OWNER',
      p_vehicles: [],
      p_note: null,
    },
  },
  { name: 'my_registration_request', args: {} },
  {
    name: 'registration_requests_for_review',
    args: { p_condominium: ZERO_UUID, p_status: 'PENDING' },
  },
  { name: 'approve_registration_request', args: { p_request: ZERO_UUID, p_notes: null } },
  { name: 'reject_registration_request', args: { p_request: ZERO_UUID, p_reason: 'diagnostico' } },
  { name: 'current_user_context', args: {} },
  { name: 'condominium_dashboard_stats', args: { p_condominium: ZERO_UUID } },
  { name: 'resident_dashboard', args: { p_condominium: ZERO_UUID } },
  { name: 'expenses_monthly_series', args: { p_condominium: ZERO_UUID, p_months: 1 } },
  { name: 'expenses_by_category', args: { p_condominium: ZERO_UUID } },
  { name: 'global_search', args: { p_condominium: ZERO_UUID, p_term: 'zz' } },
  { name: 'find_profile_by_email', args: { p_email: 'nadie@example.com' } },
  { name: 'mark_all_notifications_read', args: { p_condominium: ZERO_UUID } },
  {
    name: 'add_member_by_email',
    args: { p_condominium: ZERO_UUID, p_email: 'nadie@example.com', p_role_code: 'OWNER' },
  },
]

function describeKey(key: string): string {
  if (key.startsWith('sb_publishable_')) return 'publishable (sistema nuevo)'
  if (key.startsWith('sb_secret_')) return 'secret (sistema nuevo)'
  if (key.startsWith('eyJ')) return 'JWT (sistema clasico)'
  return 'formato desconocido'
}

function isMissingRelation(code: string, message: string): boolean {
  return /does not exist|PGRST205|42P01|Could not find the table/i.test(`${code} ${message}`)
}

function isMissingFunction(code: string, message: string): boolean {
  return /Could not find the function|PGRST202|42883/i.test(`${code} ${message}`)
}

/**
 * Que archivo crea cada objeto. Decir "vuelve a ejecutar schema.sql" cuando solo
 * faltan las funciones de autoregistro manda a reejecutar 3.500 lineas para
 * obtener lo que da un parche de 600, y en el SQL Editor cada ejecucion es una
 * transaccion: cuanto mas grande, mas facil que algo la aborte entera.
 */
const PATCH_BY_OBJECT: Record<string, string> = {
  registration_requests: 'patches/01-autoregistro-con-aprobacion.sql',
  registration_catalog: 'patches/01-autoregistro-con-aprobacion.sql',
  registration_buildings: 'patches/01-autoregistro-con-aprobacion.sql',
  registration_apartments: 'patches/01-autoregistro-con-aprobacion.sql',
  complete_self_registration: 'patches/01-autoregistro-con-aprobacion.sql',
  my_registration_request: 'patches/01-autoregistro-con-aprobacion.sql',
  registration_requests_for_review: 'patches/01-autoregistro-con-aprobacion.sql',
  approve_registration_request: 'patches/01-autoregistro-con-aprobacion.sql',
  reject_registration_request: 'patches/01-autoregistro-con-aprobacion.sql',
  condominium_invitations: 'patches/03-invitaciones.sql',
  create_invitation: 'patches/03-invitaciones.sql',
  revoke_invitation: 'patches/03-invitaciones.sql',
  invitations_for_condominium: 'patches/03-invitaciones.sql',
  claim_my_invitations: 'patches/03-invitaciones.sql',
}

/** Lista, sin repetir y en orden, los archivos que hay que ejecutar. */
function whatToRun(missing: string[]): string {
  const files = [...new Set(missing.map((name) => PATCH_BY_OBJECT[name] ?? 'schema.sql'))].sort()
  return `ejecuta en el SQL Editor: ${files.map((file) => `supabase/${file}`).join(' y despues ')}`
}

async function main(): Promise<void> {
  console.log('\n=== Diagnostico de conexion EdiFeasy <-> Supabase ===')

  // 1. Variables de entorno --------------------------------------------------
  section('1. Variables de entorno')
  if (URL) ok('URL del proyecto', URL)
  else fail('URL del proyecto', 'define VITE_SUPABASE_URL en .env')

  if (PUBLIC_KEY) ok('Clave publica presente', describeKey(PUBLIC_KEY))
  else fail('Clave publica', 'define VITE_SUPABASE_PUBLISHABLE_KEY o VITE_SUPABASE_ANON_KEY')

  if (SECRET_KEY) ok('Clave secreta presente (solo para npm run seed)', describeKey(SECRET_KEY))
  else warn('Clave secreta ausente', 'sin ella no podras ejecutar npm run seed')

  if (!URL || !PUBLIC_KEY) {
    console.log('\nFaltan datos basicos. Completa .env y vuelve a ejecutar.\n')
    process.exit(1)
  }

  // 2. Alcance de la API ----------------------------------------------------
  // Se sondea una tabla real, no el endpoint raiz `/rest/v1/`: ese ultimo solo
  // acepta claves secretas y devolveria 401 aunque la clave publica sea valida.
  section('2. Alcance de la API REST')
  let probeStatus = 0
  let probeBody = ''
  try {
    const response = await fetch(`${URL}/rest/v1/roles?select=code&limit=1`, {
      headers: { apikey: PUBLIC_KEY, 'Accept-Profile': DB_SCHEMA },
    })
    probeStatus = response.status
    probeBody = await response.text()

    if (probeStatus === 401) {
      fail('La clave publica fue rechazada', probeBody.slice(0, 200))
    } else {
      ok('Servidor alcanzable y clave aceptada', `HTTP ${probeStatus}`)
    }
  } catch (error) {
    fail('No se pudo conectar', (error as Error).message)
    console.log('\nRevisa la URL y tu conexion a internet.\n')
    process.exit(1)
  }

  // 3. Esquema expuesto -----------------------------------------------------
  section(`3. Esquema "${DB_SCHEMA}" expuesto en PostgREST`)
  let schemaExposed = false
  if (probeStatus === 200) {
    schemaExposed = true
    ok(`El esquema "${DB_SCHEMA}" esta expuesto y responde`)
  } else if (/schema must be one of/i.test(probeBody)) {
    fail(
      `El esquema "${DB_SCHEMA}" NO esta expuesto`,
      'Dashboard > Settings > API > Exposed schemas > agrega tribuia',
    )
  } else if (isMissingRelation('', probeBody)) {
    schemaExposed = true
    warn(
      `El esquema "${DB_SCHEMA}" responde pero esta vacio`,
      'no existe la tabla roles > ejecuta supabase/schema.sql',
    )
  } else if (probeStatus === 401) {
    fail('Clave publica invalida', 'copia de nuevo la publishable key desde Settings > API Keys')
  } else {
    fail('No se pudo verificar el esquema', `HTTP ${probeStatus} ${probeBody.slice(0, 200)}`)
  }

  const anon = createClient(URL, PUBLIC_KEY, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 4. Tablas ---------------------------------------------------------------
  section('4. Tablas del modelo (schema.sql vs base de datos)')
  if (schemaExposed) {
    const tables = expectedTables()
    const missing: string[] = []
    for (const table of tables) {
      /*
       * GET con limit(1), NO `{ head: true }`.
       *
       * Con head:true PostgREST responde a un HEAD y no devuelve cuerpo, asi que
       * una tabla inexistente llegaba aqui como error sin `code` ni `message` y
       * la comprobacion la daba por buena: el diagnostico afirmaba que estaban
       * las 35 tablas mientras faltaba registration_requests. Con GET si llega
       * el PGRST205 que identifica la tabla ausente.
       */
      const { error } = await anon.from(table).select('*').limit(1)
      if (error && isMissingRelation(error.code ?? '', error.message)) missing.push(table)
    }
    if (missing.length === 0) {
      ok(`Las ${tables.length} tablas de schema.sql existen en la base`)
    } else {
      fail(
        `Faltan ${missing.length} de ${tables.length} tablas`,
        `${missing.join(', ')} > ${whatToRun(missing)}`,
      )
    }
  } else {
    warn('Omitido', 'primero expon el esquema en la API')
  }

  // 5. Funciones RPC --------------------------------------------------------
  section('5. Funciones RPC que invoca el frontend')
  if (schemaExposed) {
    const missingRpc: string[] = []

    for (const probe of RPC_PROBES) {
      const { error } = await anon.rpc(probe.name, probe.args)
      // Cualquier error de permisos o validacion confirma que la funcion existe;
      // solo PGRST202 / 42883 significan que no esta creada.
      if (error && isMissingFunction(error.code ?? '', error.message)) missingRpc.push(probe.name)
    }

    if (missingRpc.length === 0) {
      ok(`Las ${RPC_PROBES.length} funciones existen`)
    } else {
      fail(
        `Faltan ${missingRpc.length} de ${RPC_PROBES.length} funciones`,
        `${missingRpc.join(', ')} > ${whatToRun(missingRpc)}`,
      )
    }

    // Datos minimos para que la pantalla de registro sea utilizable.
    if (!missingRpc.includes('registration_catalog')) {
      const { data, error } = await anon.rpc('registration_catalog')
      if (error) {
        fail('registration_catalog()', `${error.code ?? ''} ${error.message}`)
      } else {
        const list = (data ?? []) as { id: string; name: string }[]
        if (list.length === 0) {
          fail(
            'No hay condominios ACTIVOS',
            'el desplegable de /register apareceria vacio > ejecuta el seed o crea un condominio',
          )
        } else {
          ok('Condominios disponibles en /register', list.map((item) => item.name).join(', '))

          const { data: buildings } = await anon.rpc('registration_buildings', {
            p_condominium: list[0].id,
          })
          const items = (buildings ?? []) as { number: string }[]
          if (items.length === 0) {
            fail(`"${list[0].name}" no tiene edificios ACTIVOS`, 'no podrias elegir apartamento')
          } else {
            ok(`Edificios en "${list[0].name}"`, items.map((item) => item.number).join(', '))
          }
        }
      }
    }
  } else {
    warn('Omitido', 'primero expon el esquema en la API')
  }
  // 6. Auth -----------------------------------------------------------------
  section('6. Configuracion de Auth')
  try {
    const response = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: PUBLIC_KEY } })
    if (!response.ok) {
      warn('No se pudo leer la configuracion de Auth', `HTTP ${response.status}`)
    } else {
      const settings = (await response.json()) as {
        disable_signup?: boolean
        mailer_autoconfirm?: boolean
        external?: Record<string, boolean>
      }

      if (settings.disable_signup) {
        fail(
          'Registro de usuarios DESHABILITADO',
          'Authentication > Sign In / Providers > Allow new users to sign up',
        )
      } else {
        ok('Registro de usuarios habilitado')
      }

      if (settings.mailer_autoconfirm) {
        ok('Confirmacion de correo desactivada', 'el usuario entra de inmediato')
      } else {
        warn('Confirmacion de correo activa', 'hay que abrir el enlace del correo antes de entrar')
      }

      if (settings.external?.email === false) {
        fail('Proveedor Email deshabilitado', 'Authentication > Providers > Email')
      } else {
        ok('Proveedor Email habilitado')
      }
    }
  } catch (error) {
    warn('Error consultando Auth', (error as Error).message)
  }

  // 7. Datos existentes -----------------------------------------------------
  section('7. Datos existentes (requiere clave secreta)')
  if (!SECRET_KEY) {
    warn('Omitido', 'no hay SUPABASE_SERVICE_ROLE_KEY en .env')
  } else if (!schemaExposed) {
    warn('Omitido', 'primero expon el esquema en la API')
  } else {
    const admin = createClient(URL, SECRET_KEY, {
      db: { schema: DB_SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Primero validamos la clave: si esta revocada, todos los conteos fallarian
    // con un error vacio y el reporte seria confuso.
    const validation = await fetch(`${URL}/rest/v1/roles?select=code&limit=1`, {
      headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, 'Accept-Profile': DB_SCHEMA },
    })
    const secretRejected = validation.status === 401

    if (secretRejected) {
      const body = await validation.text()
      fail(
        'La clave secreta fue rechazada',
        `${body.slice(0, 120)} > usa la nueva sb_secret_... (Settings > API Keys > Secret keys)`,
      )
      warn('npm run seed no funcionara', 'la Admin API de Auth necesita una clave secreta valida')
    } else {
      for (const table of ['roles', 'profiles', 'condominiums', 'buildings', 'apartments']) {
        const { count, error } = await admin.from(table).select('*', { head: true, count: 'exact' })
        if (error) fail(`conteo de ${table}`, error.message || error.code || 'error desconocido')
        else ok(table, `${count ?? 0} fila(s)`)
      }

      const { data: users, error: usersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      })
      if (usersError) warn('No se pudo listar usuarios de Auth', usersError.message)
      else ok('Usuarios en Auth', users.users.length > 0 ? 'al menos 1' : 'ninguno todavia')
    }
  }

  // Resumen ------------------------------------------------------------------
  section('Resumen')
  if (failures === 0) {
    console.log(`  Todo listo. ${warnings} aviso(s).`)
    console.log('  Ya puedes ejecutar npm run dev y registrarte en /register\n')
  } else {
    console.log(`  ${failures} problema(s) y ${warnings} aviso(s). Corrige lo marcado como FALLA.\n`)
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error('\nFallo inesperado del diagnostico:', error)
  process.exit(1)
})

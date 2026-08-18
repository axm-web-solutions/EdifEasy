// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: invite-member
 * ----------------------------------------------------------------------------
 * Crea (o reutiliza) un usuario en Supabase Auth y lo vincula a un condominio
 * con el rol indicado. Es la unica via para dar de alta usuarios que TODAVIA no
 * tienen cuenta, porque requiere la service role key (jamas expuesta al frontend).
 *
 * Solo puede ejecutarla un ADMINISTRATOR del condominio destino o un SUPER_ADMIN;
 * la validacion se hace con el JWT del usuario que llama.
 *
 * Deploy:
 *   supabase functions deploy invite-member
 *
 * Request  (POST, JSON):
 *   { condominium_id, email, full_name, role_code, phone?, document_number?, position? }
 * Response (JSON):
 *   { ok: true, user_id, member_id, invited: boolean }
 *
 * Nota: si la funcion no esta desplegada, el frontend usa el RPC
 * `add_member_by_email`, que vincula usuarios YA registrados.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Debe coincidir con `DB_SCHEMA` en src/lib/supabase.ts */
const DB_SCHEMA = 'tribuia'

const ROLE_CODES = [
  'ADMINISTRATOR',
  'SPOKESPERSON',
  'OWNER',
  'TENANT',
  'SECURITY',
  'SERVICE_STAFF',
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return json({ error: 'Configuracion incompleta de la funcion' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'No autenticado' }, 401)
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  const condominiumId = String(payload?.condominium_id ?? '').trim()
  const email = String(payload?.email ?? '').trim().toLowerCase()
  const fullName = String(payload?.full_name ?? '').trim()
  const roleCode = String(payload?.role_code ?? '').trim()

  if (!condominiumId || !email || !fullName || !ROLE_CODES.includes(roleCode)) {
    return json({ error: 'Datos invalidos: condominium_id, email, full_name y role_code son obligatorios' }, 400)
  }

  // Cliente con el JWT del solicitante: respeta RLS y permite verificar permisos.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    db: { schema: DB_SCHEMA },
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Sesion invalida' }, 401)

  const { data: isAdmin, error: adminError } = await caller.rpc('is_condominium_admin', {
    p_condominium: condominiumId,
  })
  if (adminError) return json({ error: adminError.message }, 400)
  if (!isAdmin) return json({ error: 'No tienes permisos sobre este condominio' }, 403)

  // Cliente administrativo: crea el usuario en Auth.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let userId: string | null = null
  let invited = false

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existingProfile?.id) {
    userId = existingProfile.id as string
  } else {
    const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        phone: payload?.phone ?? null,
        document_number: payload?.document_number ?? null,
      },
    })
    if (createError || !created?.user) {
      return json({ error: createError?.message ?? 'No se pudo invitar al usuario' }, 400)
    }
    userId = created.user.id
    invited = true
  }

  const { data: role, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .single()
  if (roleError || !role) return json({ error: 'Rol no encontrado' }, 400)

  const { data: member, error: memberError } = await admin
    .from('condominium_members')
    .upsert(
      {
        condominium_id: condominiumId,
        user_id: userId,
        role_id: role.id,
        status: 'ACTIVE',
        position: payload?.position ?? null,
      },
      { onConflict: 'condominium_id,user_id,role_id' },
    )
    .select('id')
    .single()

  if (memberError) return json({ error: memberError.message }, 400)

  return json({ ok: true, user_id: userId, member_id: member.id, invited })
})

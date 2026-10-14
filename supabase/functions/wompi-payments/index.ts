// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: wompi-payments
 * ----------------------------------------------------------------------------
 * Prepara los pagos con Wompi y consulta su resultado. Todo valor a cobrar se
 * calcula aqui, con la base de datos, nunca con lo que envia el navegador.
 *
 * Deploy:
 *   supabase functions deploy wompi-payments
 *
 * Acciones (POST, JSON):
 *   { action: 'admin_fee', admin_fee_id, origin }
 *       Solo el propietario activo del apartamento. Responde { checkout_url }.
 *   { action: 'subscription', condominium_id, period, origin }
 *       Solo el ADMINISTRATOR del conjunto. period: MONTHLY | SEMIANNUAL | ANNUAL.
 *   { action: 'verify', transaction_id }
 *       Consulta la transaccion en Wompi y la aplica (respaldo del webhook).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  CORS_HEADERS,
  DB_SCHEMA,
  applyTransaction,
  checkoutUrl,
  fetchTransaction,
  json,
  newReference,
  resolveRedirect,
  serviceClient,
} from '../_shared/wompi.ts'

const RESULT_PATH = '/payments/result'
const PERIODS = ['MONTHLY', 'SEMIANNUAL', 'ANNUAL']

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

  // Cliente con el JWT del solicitante: identifica al usuario y respeta RLS.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    db: { schema: DB_SCHEMA },
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Sesion invalida' }, 401)
  const user = userData.user

  try {
    const admin = serviceClient()
    const action = String(payload?.action ?? '')

    // ---------------------------------------------------------------- cuota
    if (action === 'admin_fee') {
      const feeId = String(payload?.admin_fee_id ?? '')
      const { data: fee, error: feeError } = await admin
        .from('admin_fees')
        .select('id, condominium_id, apartment_id, amount, status')
        .eq('id', feeId)
        .maybeSingle()
      if (feeError) throw new Error(feeError.message)
      if (!fee) return json({ error: 'Cuota no encontrada' }, 404)
      if (fee.status !== 'PENDING') return json({ error: 'Esta cuota ya no esta pendiente de pago' }, 409)

      const { data: ownership } = await admin
        .from('apartment_owners')
        .select('id')
        .eq('apartment_id', fee.apartment_id)
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!ownership) return json({ error: 'Solo el propietario del apartamento puede pagar esta cuota' }, 403)

      const reference = newReference('ADM')
      const amount = Number(fee.amount)
      const { error: insertError } = await admin.from('payments').insert({
        condominium_id: fee.condominium_id,
        kind: 'ADMIN_FEE',
        reference,
        amount,
        payer_id: user.id,
        admin_fee_id: fee.id,
      })
      if (insertError) throw new Error(insertError.message)

      const url = await checkoutUrl({
        reference,
        amountInCents: Math.round(amount * 100),
        redirectUrl: resolveRedirect(payload?.origin, RESULT_PATH),
        email: user.email,
      })
      return json({ ok: true, reference, checkout_url: url })
    }

    // ----------------------------------------------------------------- plan
    if (action === 'subscription') {
      const condominiumId = String(payload?.condominium_id ?? '')
      const period = String(payload?.period ?? '')
      if (!PERIODS.includes(period)) return json({ error: 'Periodo de plan invalido' }, 400)

      const { data: isAdmin, error: adminError } = await caller.rpc('is_condominium_admin', {
        p_condominium: condominiumId,
      })
      if (adminError) throw new Error(adminError.message)
      if (!isAdmin) return json({ error: 'Solo el administrador del conjunto puede pagar el plan' }, 403)

      const { data: quote, error: quoteError } = await admin.rpc('subscription_quote', {
        p_condominium: condominiumId,
      })
      if (quoteError) throw new Error(quoteError.message)
      const plan = (quote?.plans ?? []).find((item: any) => item.period === period)
      if (!plan || Number(plan.amount) <= 0) {
        return json({ error: 'El conjunto no tiene apartamentos registrados para calcular el plan' }, 400)
      }

      const reference = newReference('PLAN')
      const amount = Number(plan.amount)
      const { error: insertError } = await admin.from('payments').insert({
        condominium_id: condominiumId,
        kind: 'SUBSCRIPTION',
        reference,
        amount,
        payer_id: user.id,
        plan_period: period,
        apartments_count: quote.apartments_count,
        unit_price: quote.unit_price,
      })
      if (insertError) throw new Error(insertError.message)

      const url = await checkoutUrl({
        reference,
        amountInCents: Math.round(amount * 100),
        redirectUrl: resolveRedirect(payload?.origin, RESULT_PATH),
        email: user.email,
      })
      return json({ ok: true, reference, checkout_url: url })
    }

    // -------------------------------------------------------------- verificar
    if (action === 'verify') {
      const transactionId = String(payload?.transaction_id ?? '').trim()
      if (!transactionId) return json({ error: 'Falta transaction_id' }, 400)

      const transaction = await fetchTransaction(transactionId)
      if (!transaction?.reference) return json({ error: 'Transaccion no encontrada en Wompi' }, 404)

      const result = await applyTransaction(admin, transaction)
      const { data: payment } = await admin
        .from('payments')
        .select('id, kind, status, amount, reference, plan_period, payment_method, status_message, paid_at, payer_id, condominium_id')
        .eq('id', result.id)
        .maybeSingle()

      // Solo devolvemos el detalle a quien pago o al administrador del conjunto.
      if (payment && payment.payer_id !== user.id) {
        const { data: isAdmin } = await caller.rpc('is_condominium_admin', {
          p_condominium: payment.condominium_id,
        })
        if (!isAdmin) return json({ ok: true, payment: { status: payment.status } })
      }
      return json({ ok: true, payment })
    }

    return json({ error: 'Accion no soportada' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500)
  }
})

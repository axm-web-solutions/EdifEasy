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
 *   { action: 'fine', fine_id, origin }
 *       Quien vive en el apartamento multado (misma regla con la que ve la multa).
 *   { action: 'reservation', reservation_id, origin }
 *       Quien vive en el apartamento, con la reserva en PENDING_PAYMENT.
 *   { action: 'subscription', condominium_id, period, origin }
 *       Solo el ADMINISTRATOR del conjunto. period: MONTHLY | SEMIANNUAL | ANNUAL.
 *   { action: 'lease', charge_ids, origin }
 *       Arrendatario de una inmobiliaria: paga uno o varios cobros de su
 *       contrato (canon, administracion). Exige la cuenta Wompi propia de la
 *       inmobiliaria: el dinero llega directo a ella.
 *   { action: 'connect_account', condominium_id, public_key, integrity_secret, events_secret }
 *       Administracion del conjunto o la inmobiliaria: conecta su cuenta Wompi.
 *   { action: 'disconnect_account', condominium_id }
 *   { action: 'verify', transaction_id }
 *       Consulta la transaccion en Wompi y la aplica (respaldo del webhook).
 *
 * Cuotas, multas, reservas y arriendos se cobran con la cuenta propia del
 * espacio si la conecto; los planes de EdiFeasy, siempre con la de EdiFeasy.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  CORS_HEADERS,
  DB_SCHEMA,
  accountConfig,
  applyTransaction,
  checkoutUrl,
  fetchTransaction,
  json,
  newReference,
  resolveRedirect,
  serviceClient,
  validateMerchant,
} from '../_shared/wompi.ts'

const RESULT_PATH = '/payments/result'

/**
 * La funcion escribe con la service role (sin RLS), asi que verifica a mano que
 * el SUPER_ADMIN no haya desactivado el modulo para el rol de quien paga.
 */
async function moduleEnabled(admin: any, condominiumId: string, module: string, userId: string) {
  const { data, error } = await admin.rpc('module_enabled', {
    p_condominium: condominiumId,
    p_module: module,
    p_user: userId,
  })
  if (error) throw new Error(error.message)
  return data === true
}
const PERIODS = ['MONTHLY', 'SEMIANNUAL', 'ANNUAL']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !ANON_KEY)
    return json({ error: 'Configuracion incompleta de la funcion' }, 500)

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
      if (fee.status !== 'PENDING')
        return json({ error: 'Esta cuota ya no esta pendiente de pago' }, 409)

      const { data: ownership } = await admin
        .from('apartment_owners')
        .select('id')
        .eq('apartment_id', fee.apartment_id)
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!ownership)
        return json({ error: 'Solo el propietario del apartamento puede pagar esta cuota' }, 403)
      if (!(await moduleEnabled(admin, fee.condominium_id, 'admin_fees', user.id))) {
        return json({ error: 'El modulo de cuotas no esta habilitado para tu rol' }, 403)
      }

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
        config: await accountConfig(admin, fee.condominium_id),
      })
      return json({ ok: true, reference, checkout_url: url })
    }

    // ---------------------------------------------------------------- multa
    if (action === 'fine') {
      const fineId = String(payload?.fine_id ?? '')
      const { data: fine, error: fineError } = await admin
        .from('fines')
        .select('id, condominium_id, apartment_id, amount, status')
        .eq('id', fineId)
        .maybeSingle()
      if (fineError) throw new Error(fineError.message)
      if (!fine) return json({ error: 'Multa no encontrada' }, 404)
      if (fine.status !== 'PENDING')
        return json({ error: 'Esta multa no esta pendiente de pago' }, 409)
      if (Number(fine.amount) <= 0)
        return json({ error: 'La multa no tiene un valor a pagar' }, 400)

      // Misma regla de la politica RLS de multas: propietario, arrendatario o
      // residente con cuenta del apartamento.
      const { data: apartmentIds, error: aptError } = await admin.rpc('user_apartment_ids', {
        p_user: user.id,
      })
      if (aptError) throw new Error(aptError.message)
      const ids = ((apartmentIds ?? []) as unknown[]).map((row: any) =>
        typeof row === 'string' ? row : row?.user_apartment_ids,
      )
      if (!ids.includes(fine.apartment_id)) {
        return json({ error: 'Solo los residentes del apartamento pueden pagar esta multa' }, 403)
      }
      if (!(await moduleEnabled(admin, fine.condominium_id, 'fines', user.id))) {
        return json({ error: 'El modulo de multas no esta habilitado para tu rol' }, 403)
      }

      const reference = newReference('MUL')
      const amount = Number(fine.amount)
      const { error: insertError } = await admin.from('payments').insert({
        condominium_id: fine.condominium_id,
        kind: 'FINE',
        reference,
        amount,
        payer_id: user.id,
        fine_id: fine.id,
      })
      if (insertError) throw new Error(insertError.message)

      const url = await checkoutUrl({
        reference,
        amountInCents: Math.round(amount * 100),
        redirectUrl: resolveRedirect(payload?.origin, RESULT_PATH),
        email: user.email,
        config: await accountConfig(admin, fine.condominium_id),
      })
      return json({ ok: true, reference, checkout_url: url })
    }

    // -------------------------------------------------------------- reserva
    if (action === 'reservation') {
      const reservationId = String(payload?.reservation_id ?? '')
      const { data: reservation, error: resError } = await admin
        .from('reservations')
        .select('id, condominium_id, apartment_id, amount, status')
        .eq('id', reservationId)
        .maybeSingle()
      if (resError) throw new Error(resError.message)
      if (!reservation) return json({ error: 'Reserva no encontrada' }, 404)
      if (reservation.status !== 'PENDING_PAYMENT') {
        return json({ error: 'Esta reserva no tiene un pago pendiente' }, 409)
      }
      if (Number(reservation.amount) <= 0)
        return json({ error: 'La reserva no tiene valor a pagar' }, 400)

      // Pagan quienes viven en el apartamento (misma regla de la politica RLS).
      const { data: apartmentIds, error: aptError } = await admin.rpc('user_apartment_ids', {
        p_user: user.id,
      })
      if (aptError) throw new Error(aptError.message)
      const ids = ((apartmentIds ?? []) as unknown[]).map((row: any) =>
        typeof row === 'string' ? row : row?.user_apartment_ids,
      )
      if (!ids.includes(reservation.apartment_id)) {
        return json({ error: 'Solo los residentes del apartamento pueden pagar esta reserva' }, 403)
      }
      if (!(await moduleEnabled(admin, reservation.condominium_id, 'reservations', user.id))) {
        return json({ error: 'El modulo de reservas no esta habilitado para tu rol' }, 403)
      }

      const reference = newReference('RES')
      const amount = Number(reservation.amount)
      const { error: insertError } = await admin.from('payments').insert({
        condominium_id: reservation.condominium_id,
        kind: 'RESERVATION',
        reference,
        amount,
        payer_id: user.id,
        reservation_id: reservation.id,
      })
      if (insertError) throw new Error(insertError.message)

      const url = await checkoutUrl({
        reference,
        amountInCents: Math.round(amount * 100),
        redirectUrl: resolveRedirect(payload?.origin, RESULT_PATH),
        email: user.email,
        config: await accountConfig(admin, reservation.condominium_id),
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
      if (!isAdmin)
        return json({ error: 'Solo el administrador del conjunto puede pagar el plan' }, 403)

      const { data: quote, error: quoteError } = await admin.rpc('subscription_quote', {
        p_condominium: condominiumId,
      })
      if (quoteError) throw new Error(quoteError.message)
      const plan = (quote?.plans ?? []).find((item: any) => item.period === period)
      if (!plan || Number(plan.amount) <= 0) {
        return json(
          { error: 'El conjunto no tiene apartamentos registrados para calcular el plan' },
          400,
        )
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

    // -------------------------------------------------------------- arriendo
    if (action === 'lease') {
      const chargeIds: string[] = Array.isArray(payload?.charge_ids)
        ? payload.charge_ids.map((id: unknown) => String(id)).slice(0, 12)
        : []
      if (chargeIds.length === 0) return json({ error: 'Elige que cobros vas a pagar' }, 400)

      const { data: charges, error: chargesError } = await admin
        .from('lease_charges')
        .select('id, condominium_id, lease_id, amount, status')
        .in('id', chargeIds)
      if (chargesError) throw new Error(chargesError.message)
      if (!charges || charges.length !== chargeIds.length)
        return json({ error: 'Cobro no encontrado' }, 404)
      if (charges.some((charge: any) => charge.status !== 'PENDING')) {
        return json({ error: 'Alguno de los cobros ya no esta pendiente' }, 409)
      }
      const leaseIds = new Set(charges.map((charge: any) => charge.lease_id))
      if (leaseIds.size !== 1)
        return json({ error: 'Paga los cobros de un contrato a la vez' }, 400)

      const { data: lease, error: leaseError } = await admin
        .from('property_leases')
        .select('id, condominium_id, tenant_profile_id, status')
        .eq('id', charges[0].lease_id)
        .maybeSingle()
      if (leaseError) throw new Error(leaseError.message)
      if (!lease || lease.tenant_profile_id !== user.id) {
        return json({ error: 'Solo el arrendatario del contrato puede pagar estos cobros' }, 403)
      }

      const config = await accountConfig(admin, lease.condominium_id)
      if (!config) {
        return json(
          { error: 'La inmobiliaria aun no ha conectado su cuenta de pagos en linea' },
          409,
        )
      }

      const reference = newReference('ARR')
      const amount = charges.reduce((sum: number, charge: any) => sum + Number(charge.amount), 0)
      const { error: insertError } = await admin.from('payments').insert({
        condominium_id: lease.condominium_id,
        kind: 'LEASE',
        reference,
        amount,
        payer_id: user.id,
        lease_charge_ids: chargeIds,
      })
      if (insertError) throw new Error(insertError.message)

      const url = await checkoutUrl({
        reference,
        amountInCents: Math.round(amount * 100),
        redirectUrl: resolveRedirect(payload?.origin, RESULT_PATH),
        email: user.email,
        config,
      })
      return json({ ok: true, reference, checkout_url: url })
    }

    // ------------------------------------------------- cuenta Wompi propia
    if (action === 'connect_account' || action === 'disconnect_account') {
      const condominiumId = String(payload?.condominium_id ?? '')
      const { data: isAdmin, error: adminError } = await caller.rpc('is_condominium_admin', {
        p_condominium: condominiumId,
      })
      if (adminError) throw new Error(adminError.message)
      if (!isAdmin)
        return json({ error: 'Solo la administracion puede conectar la cuenta de pagos' }, 403)

      if (action === 'disconnect_account') {
        const { error } = await admin
          .from('payment_accounts')
          .delete()
          .eq('condominium_id', condominiumId)
        if (error) throw new Error(error.message)
        return json({ ok: true })
      }

      const publicKey = String(payload?.public_key ?? '').trim()
      const integritySecret = String(payload?.integrity_secret ?? '').trim()
      const eventsSecret = String(payload?.events_secret ?? '').trim()
      if (!/^pub_(test|prod)_[A-Za-z0-9]+$/.test(publicKey)) {
        return json({ error: 'La llave publica debe empezar por pub_test_ o pub_prod_' }, 400)
      }
      const prefix = publicKey.startsWith('pub_test_') ? 'test_' : 'prod_'
      if (
        !integritySecret.startsWith(`${prefix}integrity_`) ||
        !eventsSecret.startsWith(`${prefix}events_`)
      ) {
        return json(
          {
            error: `Los secretos deben ser del mismo ambiente: ${prefix}integrity_... y ${prefix}events_...`,
          },
          400,
        )
      }
      let merchant: string
      try {
        merchant = await validateMerchant(publicKey)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Llave invalida' }, 400)
      }

      const environment = publicKey.startsWith('pub_test_') ? 'SANDBOX' : 'PRODUCTION'
      const { error: accountError } = await admin.from('payment_accounts').upsert({
        condominium_id: condominiumId,
        provider: 'WOMPI',
        public_key: publicKey,
        environment,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      })
      if (accountError) throw new Error(accountError.message)
      const { error: secretError } = await admin.from('payment_account_secrets').upsert({
        condominium_id: condominiumId,
        integrity_secret: integritySecret,
        events_secret: eventsSecret,
        updated_at: new Date().toISOString(),
      })
      if (secretError) throw new Error(secretError.message)
      return json({ ok: true, environment, merchant })
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
        .select(
          'id, kind, status, amount, reference, plan_period, payment_method, status_message, paid_at, payer_id, condominium_id',
        )
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

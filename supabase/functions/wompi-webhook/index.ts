// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: wompi-webhook
 * ----------------------------------------------------------------------------
 * Recibe los eventos `transaction.updated` de Wompi y aplica el resultado del
 * pago. Es la confirmacion oficial: aunque el usuario cierre el navegador antes
 * de volver a la app, el pago queda registrado.
 *
 * Wompi no envia JWT de Supabase, por eso se despliega sin verificacion:
 *   supabase functions deploy wompi-webhook --no-verify-jwt
 *
 * La autenticidad se valida con el checksum del evento y la llave de eventos:
 * la de EdiFeasy (WOMPI_EVENTS_SECRET) o, si el pago es de un conjunto o
 * inmobiliaria con cuenta Wompi propia, la de esa cuenta.
 * URL a registrar en el panel de Wompi (Desarrolladores > URL de eventos), en
 * la cuenta de EdiFeasy y en la de cada inmobiliaria o conjunto:
 *   https://<proyecto>.supabase.co/functions/v1/wompi-webhook
 */
import { applyTransaction, json, serviceClient, sha256Hex } from '../_shared/wompi.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

/** Lee una ruta tipo "transaction.amount_in_cents" dentro de `event.data`. */
function readPath(source: any, path: string): string {
  const value = path.split('.').reduce((current, key) => current?.[key], source)
  return value === undefined || value === null ? '' : String(value)
}

/** Llave de eventos de la cuenta propia del espacio dueno del pago. */
async function accountEventsSecret(
  admin: SupabaseClient,
  reference: string,
): Promise<string | null> {
  if (!reference) return null
  const { data: payment } = await admin
    .from('payments')
    .select('condominium_id')
    .eq('reference', reference)
    .maybeSingle()
  if (!payment) return null
  const { data: secret } = await admin
    .from('payment_account_secrets')
    .select('events_secret')
    .eq('condominium_id', payment.condominium_id)
    .maybeSingle()
  return secret?.events_secret ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET') ?? ''

  let event: any
  try {
    event = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  const properties: string[] = event?.signature?.properties ?? []
  const received = String(event?.signature?.checksum ?? '').toLowerCase()
  const concatenated = properties.map((path) => readPath(event?.data, path)).join('')
  const signed = (secret: string) => sha256Hex(`${concatenated}${event?.timestamp ?? ''}${secret}`)
  if (!received) return json({ error: 'Firma invalida' }, 401)

  let valid = Boolean(eventsSecret) && received === (await signed(eventsSecret))
  if (!valid) {
    // Pago cobrado con la cuenta Wompi propia de un conjunto o inmobiliaria.
    const accountSecret = await accountEventsSecret(
      serviceClient(),
      String(event?.data?.transaction?.reference ?? ''),
    )
    valid = Boolean(accountSecret) && received === (await signed(accountSecret as string))
  }
  if (!valid) return json({ error: 'Firma invalida' }, 401)

  if (event?.event !== 'transaction.updated') return json({ ok: true, ignored: event?.event })

  const transaction = event?.data?.transaction
  if (!transaction?.reference?.startsWith('EDF-')) {
    // Pago de otro sistema con la misma cuenta de Wompi.
    return json({ ok: true, ignored: 'reference' })
  }

  try {
    const result = await applyTransaction(serviceClient(), transaction)
    return json({ ok: true, result })
  } catch (error) {
    // 500 hace que Wompi reintente el envio mas tarde.
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500)
  }
})

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
 * La autenticidad se valida con el checksum del evento y WOMPI_EVENTS_SECRET.
 * URL a registrar en el panel de Wompi (Desarrolladores > URL de eventos):
 *   https://<proyecto>.supabase.co/functions/v1/wompi-webhook
 */
import { applyTransaction, json, serviceClient, sha256Hex } from '../_shared/wompi.ts'

/** Lee una ruta tipo "transaction.amount_in_cents" dentro de `event.data`. */
function readPath(source: any, path: string): string {
  const value = path.split('.').reduce((current, key) => current?.[key], source)
  return value === undefined || value === null ? '' : String(value)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET')
  if (!eventsSecret) return json({ error: 'Falta WOMPI_EVENTS_SECRET' }, 500)

  let event: any
  try {
    event = await req.json()
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }

  const properties: string[] = event?.signature?.properties ?? []
  const received = String(event?.signature?.checksum ?? '').toLowerCase()
  const concatenated = properties.map((path) => readPath(event?.data, path)).join('')
  const expected = await sha256Hex(`${concatenated}${event?.timestamp ?? ''}${eventsSecret}`)
  if (!received || received !== expected) return json({ error: 'Firma invalida' }, 401)

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

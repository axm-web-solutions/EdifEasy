/**
 * Edge Function: alarm-webhook
 * ----------------------------------------------------------------------------
 * Recibe eventos de alarmas de cualquier marca. Cada alarma registrada en
 * EdiFeasy tiene su propia URL secreta:
 *
 *   https://<proyecto>.supabase.co/functions/v1/alarm-webhook?key=<token>
 *
 * (tambien acepta el token en la cabecera X-EdiFeasy-Key o como ultimo
 * segmento de la ruta). El cuerpo puede ser JSON, formulario o texto con un
 * codigo Contact ID o SIA; ver _shared/alarmEvents.ts.
 *
 * Los paneles y centrales no envian JWT de Supabase:
 *   supabase functions deploy alarm-webhook --no-verify-jwt
 * La autenticidad la da el token (solo se guarda su hash en la base).
 */
import { json, serviceClient, sha256Hex } from '../_shared/wompi.ts'
import { extractToken, normalizeAlarmEvent, parseBody } from '../_shared/alarmEvents.ts'

const MAX_BODY = 32_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST' && req.method !== 'GET')
    return json({ error: 'Metodo no permitido' }, 405)

  const url = new URL(req.url)
  const token = extractToken(url, req.headers)
  // Misma respuesta para token ausente o invalido: no se revela si existe.
  if (!token) return json({ error: 'Alarma no autorizada' }, 401)

  let raw = ''
  if (req.method === 'POST') {
    raw = await req.text()
    if (raw.length > MAX_BODY) return json({ error: 'Evento demasiado grande' }, 413)
  }
  const query = Object.fromEntries(url.searchParams)
  const event = normalizeAlarmEvent(parseBody(raw, req.headers.get('content-type')), query)

  try {
    const { data, error } = await serviceClient().rpc('record_alarm_event', {
      p_token_hash: await sha256Hex(token),
      p_event: event,
    })
    if (error) {
      if (error.code === 'P0002') return json({ error: 'Alarma no autorizada' }, 401)
      // 500: el panel o la central reintentan mas tarde.
      return json({ error: 'No se pudo registrar el evento' }, 500)
    }
    return json({ ok: true, event_type: event.event_type, ...data })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500)
  }
})

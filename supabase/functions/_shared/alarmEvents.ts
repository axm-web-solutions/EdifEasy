/**
 * Normalizacion de eventos de alarma de cualquier marca.
 *
 * Cada fabricante, app o central de monitoreo envia algo distinto. Aqui se
 * convierte a un evento comun que entiende la base (record_alarm_event):
 *
 *   1. JSON (o formulario) con un campo de tipo en cualquier nivel:
 *      event_type, type, event, eventType, alarm_type, name, code...
 *      Se reconocen palabras en espanol e ingles (panico, panic, incendio, fire...).
 *   2. Ademas del texto, codigos estandar de las receptoras de monitoreo:
 *      - Contact ID (Ademco): "1130 01 015" = alarma de robo, particion 01, zona 015.
 *      - SIA DC-09: "BA015" = robo zona 15, "FA", "PA", "OP", "CL"...
 *
 * Es codigo puro (sin APIs de Deno) para poder probarlo con vitest.
 */

export type AlarmEventType =
  | 'PANIC'
  | 'FIRE'
  | 'INTRUSION'
  | 'MEDICAL'
  | 'GAS'
  | 'FLOOD'
  | 'DURESS'
  | 'TAMPER'
  | 'LOW_BATTERY'
  | 'POWER_FAILURE'
  | 'COMMUNICATION_FAILURE'
  | 'ARMED'
  | 'DISARMED'
  | 'PARTIAL_ARMED'
  | 'ALARM_RESTORED'
  | 'POWER_RESTORED'
  | 'TEST'
  | 'OTHER'

export interface NormalizedAlarmEvent {
  event_type: AlarmEventType
  zone: string | null
  raw_code: string | null
  message: string | null
  occurred_at: string | null
  payload: unknown
}

type Flat = Map<string, string>

const TYPE_KEYS = [
  'event_type',
  'eventtype',
  'event',
  'type',
  'alarm_type',
  'alarmtype',
  'event_name',
  'eventname',
  'name',
  'action',
  'status',
  'state',
  'tipo',
  'evento',
  'alarm',
]
const CODE_KEYS = [
  'code',
  'event_code',
  'eventcode',
  'cid',
  'contact_id',
  'contactid',
  'sia',
  'sia_code',
  'codigo',
  'raw',
  'data',
]
const ZONE_KEYS = [
  'zone',
  'zona',
  'zone_id',
  'zoneid',
  'zone_name',
  'zonename',
  'sensor',
  'device_name',
  'devicename',
  'device',
  'area',
]
const MESSAGE_KEYS = [
  'message',
  'description',
  'descripcion',
  'mensaje',
  'text',
  'detail',
  'details',
  'detalle',
]
const TIME_KEYS = [
  'occurred_at',
  'timestamp',
  'time',
  'date',
  'datetime',
  'event_time',
  'eventtime',
  'created_at',
  'fecha',
  'hora',
]

/**
 * Palabras clave por tipo. El orden importa: "disarm" contiene "arm" y
 * "restore" debe ganarle a "alarm".
 */
const KEYWORDS: [AlarmEventType, RegExp][] = [
  ['TEST', /\b(test|prueba|periodic test)\b/],
  ['DURESS', /(duress|coacci|hold ?up|asalto)/],
  ['POWER_RESTORED', /((ac|power|energ[ia]a?)[\s_-]*(restor|restab|ok\b))|restablec.*energ/],
  [
    'POWER_FAILURE',
    /((ac|power|energ[ia]a?)[\s_-]*(fail|loss|lost|trouble|falla|perd))|sin energ|corte de (luz|energ)|power[_\s]?out/,
  ],
  [
    'COMMUNICATION_FAILURE',
    /(comm(unication)?[\s_-]*(fail|loss|trouble)|offline|desconect|sin conexi|perdida de comunicaci|falla de comunicaci)/,
  ],
  ['LOW_BATTERY', /(low[\s_-]*batt|bater[ia]a?[\s_-]*baja|battery[\s_-]*low)/],
  ['TAMPER', /(tamper|sabotaj|manipulaci)/],
  ['DISARMED', /(disarm|desarm|desactivad|opening\b|\bopen(ed)? by user)/],
  ['PARTIAL_ARMED', /(partial|parcial|\bstay\b|\bnight\b|home mode|modo casa|perimetral)/],
  ['ARMED', /(\barm(ed|ing)?\b|armad|activad|closing\b)/],
  ['ALARM_RESTORED', /(restor|restab|normaliz|cancel|resuelt)/],
  ['PANIC', /(panic|p[aá]nico|\bsos\b|emergency button|boton de emergencia)/],
  ['FIRE', /(fire|incendi|smoke|humo|fuego|heat)/],
  ['GAS', /(\bgas\b|\bco\b|carbon monox|mon[oó]xido)/],
  ['FLOOD', /(flood|leak|water|inundaci|fuga de agua|\bagua\b)/],
  ['MEDICAL', /(medical|m[eé]dic|ambulanc)/],
  [
    'INTRUSION',
    /(intrus|burglar|robo|intruso|motion|movimiento|door|puerta|window|ventana|perimeter|\balarm\b|alarma)/,
  ],
]

/** Contact ID: tres digitos de evento -> tipo (qualifier 1 = nuevo, 3 = restaura). */
function fromContactId(code: number, qualifier: string): AlarmEventType | null {
  // Apertura/cierre: 1 = abre (desarma), 3 = cierra (arma).
  if (code >= 400 && code <= 409) return qualifier === '3' ? 'ARMED' : 'DISARMED'
  if (code === 441 || code === 442) return qualifier === '3' ? 'PARTIAL_ARMED' : 'DISARMED'
  if (code >= 601 && code <= 609) return 'TEST'
  const restore = qualifier === '3'
  if (code === 301 || code === 342) return restore ? 'POWER_RESTORED' : 'POWER_FAILURE'
  if (restore) return 'ALARM_RESTORED'
  if (code === 121) return 'DURESS'
  if (code >= 100 && code <= 109) return 'MEDICAL'
  if (code >= 110 && code <= 119) return 'FIRE'
  if (code >= 120 && code <= 129) return 'PANIC'
  if (code === 137 || code === 144 || code === 145 || code === 383) return 'TAMPER'
  if (code >= 130 && code <= 139) return 'INTRUSION'
  if (code === 151 || code === 162) return 'GAS'
  if (code === 154) return 'FLOOD'
  if (code === 302 || code === 309 || code === 384) return 'LOW_BATTERY'
  if (code >= 350 && code <= 359) return 'COMMUNICATION_FAILURE'
  if (code >= 140 && code <= 149) return 'INTRUSION'
  return null
}

/** SIA: dos letras de evento. */
const SIA: Record<string, AlarmEventType> = {
  BA: 'INTRUSION',
  BR: 'ALARM_RESTORED',
  BH: 'ALARM_RESTORED',
  FA: 'FIRE',
  FR: 'ALARM_RESTORED',
  FH: 'ALARM_RESTORED',
  PA: 'PANIC',
  PR: 'ALARM_RESTORED',
  PH: 'ALARM_RESTORED',
  HA: 'DURESS',
  HR: 'ALARM_RESTORED',
  MA: 'MEDICAL',
  MR: 'ALARM_RESTORED',
  GA: 'GAS',
  GR: 'ALARM_RESTORED',
  WA: 'FLOOD',
  WR: 'ALARM_RESTORED',
  TA: 'TAMPER',
  TR: 'ALARM_RESTORED',
  YT: 'LOW_BATTERY',
  YR: 'ALARM_RESTORED',
  AT: 'POWER_FAILURE',
  AR: 'POWER_RESTORED',
  YC: 'COMMUNICATION_FAILURE',
  YK: 'ALARM_RESTORED',
  CL: 'ARMED',
  CA: 'ARMED',
  CG: 'ARMED',
  OP: 'DISARMED',
  OA: 'DISARMED',
  OG: 'DISARMED',
  NL: 'PARTIAL_ARMED',
  RP: 'TEST',
  RX: 'TEST',
}

/** Aplana objetos anidados (hasta 3 niveles): { event: { type } } -> "event.type". */
function flatten(value: unknown, prefix = '', depth = 0, out: Flat = new Map()): Flat {
  if (value === null || value === undefined) return out
  if (typeof value !== 'object') {
    out.set(prefix.toLowerCase(), String(value))
    return out
  }
  if (depth > 3) return out
  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) => flatten(item, `${prefix}[${index}]`, depth + 1, out))
    return out
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    flatten(item, prefix ? `${prefix}.${key}` : key, depth + 1, out)
  }
  return out
}

/** Primer valor no vacio cuya ultima parte de la ruta coincide con alguna clave. */
function pick(flat: Flat, keys: string[]): string | null {
  for (const key of keys) {
    for (const [path, value] of flat) {
      const last =
        path
          .split('.')
          .pop()
          ?.replace(/\[\d+\]$/, '') ?? ''
      if (last === key && value.trim() !== '') return value.trim()
    }
  }
  return null
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_.]/g, ' ')
}

export function typeFromText(text: string | null): AlarmEventType | null {
  if (!text) return null
  const normalized = normalizeText(text)
  // Nombres canonicos tal cual (PANIC, LOW_BATTERY...).
  const canonical = text
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if ((KEYWORDS.map(([type]) => type) as string[]).includes(canonical) || canonical === 'OTHER') {
    return canonical as AlarmEventType
  }
  for (const [type, pattern] of KEYWORDS) {
    if (pattern.test(normalized)) return type
  }
  return null
}

/** Contact ID dentro de un texto: "18 1 130 01 015", "1130 01 015", "E130 01 015". */
export function parseContactId(
  text: string | null,
): { type: AlarmEventType; zone: string; code: string } | null {
  if (!text) return null
  const match = text.match(/(?:^|[^0-9])([136eErR])\s?(\d{3})\s?(\d{2})\s?(\d{3})(?:[^0-9]|$)/)
  if (!match) return null
  const qualifier =
    match[1].toUpperCase() === 'E' ? '1' : match[1].toUpperCase() === 'R' ? '3' : match[1]
  const type = fromContactId(Number(match[2]), qualifier)
  if (!type) return null
  return {
    type,
    zone: String(Number(match[4])),
    code: `${qualifier}${match[2]} ${match[3]} ${match[4]}`,
  }
}

/** SIA: "BA015", "Nri1/BA015", "#1234|NBA015". */
export function parseSia(
  text: string | null,
): { type: AlarmEventType; zone: string | null; code: string } | null {
  if (!text) return null
  const match = text
    .toUpperCase()
    .match(/(?:^|[^A-Z])N?(?:RI\d+\/)?([A-Z]{2})(\d{0,4})(?:[^A-Z0-9]|$)/)
  if (!match || !SIA[match[1]]) return null
  return {
    type: SIA[match[1]],
    zone: match[2] ? String(Number(match[2])) : null,
    code: `${match[1]}${match[2]}`,
  }
}

function parseTime(value: string | null): string | null {
  if (!value) return null
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000).toISOString()
  if (/^\d{13}$/.test(value)) return new Date(Number(value)).toISOString()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/** Cuerpo de la peticion: JSON, formulario o texto plano. */
export function parseBody(raw: string, contentType: string | null): unknown {
  const text = raw.trim()
  if (!text) return {}
  if (contentType?.includes('json') || text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch {
      // cae a texto
    }
  }
  if (contentType?.includes('form') || /^[\w.-]+=/.test(text)) {
    return Object.fromEntries(new URLSearchParams(text))
  }
  return { raw: text }
}

export function normalizeAlarmEvent(
  body: unknown,
  query: Record<string, string> = {},
): NormalizedAlarmEvent {
  const flat = flatten({
    ...query,
    ...(typeof body === 'object' && body !== null && !Array.isArray(body) ? body : { raw: body }),
  })
  // El token nunca se guarda en el historial.
  for (const key of [...flat.keys()]) if (/^(key|token|apikey)$/.test(key)) flat.delete(key)

  const typeText = pick(flat, TYPE_KEYS)
  const codeText = pick(flat, CODE_KEYS)
  const allText = [...flat.values()].join(' ')

  let type = typeFromText(typeText)
  let zone = pick(flat, ZONE_KEYS)
  let rawCode: string | null = codeText

  // Codigos estandar: tienen prioridad si el texto no fue concluyente.
  const cid = parseContactId(codeText) ?? (type ? null : parseContactId(allText))
  const sia = cid ? null : (parseSia(codeText) ?? (type ? null : parseSia(typeText)))
  if (cid && (!type || type === 'OTHER')) {
    type = cid.type
    zone = zone ?? cid.zone
    rawCode = cid.code
  } else if (sia && (!type || type === 'OTHER')) {
    type = sia.type
    zone = zone ?? sia.zone
    rawCode = sia.code
  }
  if (!type) type = typeFromText(pick(flat, MESSAGE_KEYS)) ?? 'OTHER'

  return {
    event_type: type,
    zone: zone ? zone.slice(0, 80) : null,
    raw_code: rawCode ? rawCode.slice(0, 40) : null,
    message: pick(flat, MESSAGE_KEYS)?.slice(0, 300) ?? null,
    occurred_at: parseTime(pick(flat, TIME_KEYS)),
    payload: Object.fromEntries([...flat.entries()].slice(0, 60)),
  }
}

/** Token de la alarma: ?key= / ?token=, cabecera o ultimo segmento de la ruta. */
export function extractToken(url: URL, headers: Headers): string | null {
  const fromQuery = url.searchParams.get('key') ?? url.searchParams.get('token')
  const fromHeader =
    headers.get('x-edifeasy-key') ??
    headers.get('x-alarm-key') ??
    headers.get('authorization')?.match(/^(?:token|key)\s+(\S+)$/i)?.[1] ??
    null
  const segment = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const fromPath = /^[0-9a-f]{64}$/i.test(segment) ? segment : null
  const token = (fromQuery ?? fromHeader ?? fromPath)?.trim() ?? null
  return token && /^[0-9a-f]{64}$/i.test(token) ? token.toLowerCase() : null
}

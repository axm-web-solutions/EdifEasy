/**
 * Reglas de negocio de la gestion inmobiliaria (sin React ni Supabase):
 * vencimientos y preaviso, incremento del canon, mora, cartera por edades,
 * liquidacion al propietario y la plantilla del contrato de arrendamiento.
 *
 * Las cuentas de la liquidacion y del incremento son las mismas que hace la
 * base (generate_owner_settlement, apply_rent_increase): aqui solo se usan
 * para mostrar la vista previa.
 */
import dayjs from 'dayjs'
import type {
  IncreaseRule,
  LeaseUse,
  ManagementAgreementRow,
  PropertyLeaseRow,
  SettlementStatus,
  SignerRole,
} from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'

// ------------------------------------------------------------ etiquetas
export const LEASE_USES: { value: LeaseUse; label: string; help: string }[] = [
  {
    value: 'VIVIENDA',
    label: 'Vivienda',
    help: 'Ley 820 de 2003: sin deposito, incremento hasta el IPC, preaviso de 3 meses.',
  },
  {
    value: 'COMERCIAL',
    label: 'Comercial',
    help: 'Codigo de Comercio: incremento pactado, preaviso (desahucio) de 6 meses.',
  },
]

export const INCREASE_RULES: { value: IncreaseRule; label: string }[] = [
  { value: 'IPC', label: 'IPC del ano anterior' },
  { value: 'IPC_PLUS', label: 'IPC + puntos' },
  { value: 'FIXED', label: 'Porcentaje fijo pactado' },
]

export const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'gold' },
  APPROVED: { label: 'Aprobada', color: 'blue' },
  PAID: { label: 'Girada', color: 'green' },
  VOID: { label: 'Anulada', color: 'default' },
}

export const SIGNER_ROLES: Record<SignerRole, string> = {
  AGENCY: 'Inmobiliaria (arrendador)',
  OWNER: 'Propietario',
  TENANT: 'Arrendatario',
  GUARANTOR: 'Codeudor',
}

export const CONTRACT_STATUS = {
  NONE: { label: 'Sin enviar a firma', color: 'default' },
  SENT: { label: 'Esperando firmas', color: 'gold' },
  SIGNED: { label: 'Firmado', color: 'green' },
} as const

// --------------------------------------------------------------- fechas
const ISO = 'YYYY-MM-DD'
const day = (value: string | Date) => dayjs(value).startOf('day')

type LeaseTerms = Pick<
  PropertyLeaseRow,
  | 'start_date'
  | 'end_date'
  | 'term_months'
  | 'auto_renew'
  | 'notice_months'
  | 'notice_given_at'
  | 'last_increase_at'
  | 'policy_expires_at'
  | 'status'
>

/**
 * Fin del periodo vigente. Sin fecha de fin se toma inicio + duracion; con
 * prorroga automatica, el periodo se renueva por la misma duracion hasta que
 * la fecha de fin quede en el futuro.
 */
export function leaseCurrentEnd(lease: LeaseTerms, today: Date = new Date()): string {
  const term = Math.max(1, lease.term_months || 12)
  let end = lease.end_date
    ? day(lease.end_date)
    : day(lease.start_date).add(term, 'month').subtract(1, 'day')
  const now = day(today)
  if (lease.auto_renew) {
    for (let guard = 0; guard < 240 && end.isBefore(now); guard += 1) {
      end = end.add(1, 'day').add(term, 'month').subtract(1, 'day')
    }
  }
  return end.format(ISO)
}

export type RenewalBucket = 'D30' | 'D60' | 'D90' | null

export interface RenewalInfo {
  endDate: string
  daysLeft: number
  bucket: RenewalBucket
  /** Ultimo dia para avisar la terminacion o no renovacion. */
  noticeDeadline: string
  noticeGiven: boolean
  /** Falta poco (30 dias) o ya paso el plazo del preaviso y no se ha dado. */
  noticeUrgent: boolean
  nextIncrease: string
  increaseDue: boolean
  policyExpiring: boolean
}

export function renewalInfo(lease: LeaseTerms, today: Date = new Date()): RenewalInfo {
  const now = day(today)
  const endDate = leaseCurrentEnd(lease, today)
  const end = day(endDate)
  const daysLeft = end.diff(now, 'day')
  const deadline = end.subtract(lease.notice_months || 3, 'month')
  const noticeGiven = Boolean(lease.notice_given_at)
  const nextIncrease = day(lease.last_increase_at ?? lease.start_date).add(12, 'month')
  const policy = lease.policy_expires_at ? day(lease.policy_expires_at) : null
  return {
    endDate,
    daysLeft,
    bucket: daysLeft <= 30 ? 'D30' : daysLeft <= 60 ? 'D60' : daysLeft <= 90 ? 'D90' : null,
    noticeDeadline: deadline.format(ISO),
    noticeGiven,
    noticeUrgent: !noticeGiven && !now.isBefore(deadline.subtract(30, 'day')),
    nextIncrease: nextIncrease.format(ISO),
    increaseDue: !now.isBefore(nextIncrease),
    policyExpiring: policy !== null && policy.diff(now, 'day') <= 30,
  }
}

// ------------------------------------------------------------ incremento
export function rentIncreasePreview(input: {
  rent: number
  indexPct: number
  rule: IncreaseRule
  points: number
  use: LeaseUse
}): { pct: number; newRent: number; capped: boolean } {
  const wanted = input.rule === 'IPC_PLUS' ? input.indexPct + input.points : input.indexPct
  const pct = input.use === 'VIVIENDA' ? Math.min(wanted, input.indexPct) : wanted
  return {
    pct: Math.round(pct * 1000) / 1000,
    newRent: Math.round(input.rent * (1 + pct / 100)),
    capped: pct < wanted,
  }
}

// ------------------------------------------------------------------ mora
/** Interes de mora simple: tasa mensual pactada, proporcional a los dias. */
export function lateInterest(amount: number, monthlyPct: number, daysLate: number): number {
  if (amount <= 0 || monthlyPct <= 0 || daysLate <= 0) return 0
  return Math.round((amount * monthlyPct * daysLate) / 100 / 30)
}

export function daysLate(dueDate: string, today: Date = new Date()): number {
  return Math.max(0, day(today).diff(day(dueDate), 'day'))
}

const AGING = [
  { key: 'd30', label: '1 a 30 dias', max: 30 },
  { key: 'd60', label: '31 a 60 dias', max: 60 },
  { key: 'd90', label: '61 a 90 dias', max: 90 },
  { key: 'more', label: 'Mas de 90 dias', max: Infinity },
] as const

/** Cartera vencida por edades (solo cobros pendientes con fecha pasada). */
export function agingBuckets(
  charges: { amount: number; dueDate: string; isPending: boolean }[],
  today: Date = new Date(),
) {
  const buckets = AGING.map((bucket) => ({ ...bucket, count: 0, total: 0 }))
  for (const charge of charges) {
    const late = charge.isPending ? daysLate(charge.dueDate, today) : 0
    if (late <= 0) continue
    const bucket = buckets.find((item) => late <= item.max)
    if (!bucket) continue
    bucket.count += 1
    bucket.total += charge.amount
  }
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    total: bucket.total,
    totalLabel: formatCurrency(bucket.total),
  }))
}

// ------------------------------------------------------------ liquidacion
type AgreementTerms = Pick<
  ManagementAgreementRow,
  'commission_pct' | 'charges_vat' | 'vat_pct' | 'withholding_pct'
>

/** Misma cuenta que generate_owner_settlement (vista previa). */
export function settlementPreview(gross: number, agreement: AgreementTerms, expenses = 0) {
  const commission = Math.round((gross * Number(agreement.commission_pct)) / 100)
  const vat = agreement.charges_vat ? Math.round((commission * Number(agreement.vat_pct)) / 100) : 0
  const withholding = Math.round((gross * Number(agreement.withholding_pct)) / 100)
  return {
    gross,
    commission,
    vat,
    withholding,
    expenses,
    net: gross - commission - vat - withholding - expenses,
  }
}

// ------------------------------------------------------ numeros en letras
const UNITS = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidos',
  'veintitres',
  'veinticuatro',
  'veinticinco',
  'veintiseis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
]

function belowThousand(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts = [HUNDREDS[hundreds]]
  if (rest < 30) parts.push(UNITS[rest])
  else {
    const tens = TENS[Math.floor(rest / 10)]
    parts.push(rest % 10 ? `${tens} y ${UNITS[rest % 10]}` : tens)
  }
  return parts.filter(Boolean).join(' ')
}

/** 2500000 -> "dos millones quinientos mil". Hasta 999.999.999.999. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (n === 0) return 'cero'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) {
    parts.push(millions === 1 ? 'un millon' : `${numberToWords(millions)} millones`)
  }
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${belowThousand(thousands)} mil`)
  if (rest) parts.push(belowThousand(rest))
  return parts
    .join(' ')
    .replace(/uno millones/g, 'un millones')
    .replace(/uno mil/g, 'un mil')
    .replace(/veintiuno mil/g, 'veintiun mil')
    .replace(/veintiuno millones/g, 'veintiun millones')
}

export function pesos(value: number): string {
  const words = numberToWords(value)
  const de = /(millon|millones)$/.test(words) ? ' de' : ''
  return `${formatCurrency(value)} (${words}${de} pesos m/cte)`
}

// --------------------------------------------------- plantilla del contrato
export interface ContractInput {
  city: string
  agency: { name: string; document?: string | null }
  ownerName?: string | null
  tenant: { name: string; document?: string | null; email?: string | null; phone?: string | null }
  guarantors: { name: string; document?: string | null }[]
  property: { title: string; address?: string | null; city?: string | null; type?: string | null }
  lease: Pick<
    PropertyLeaseRow,
    | 'lease_use'
    | 'start_date'
    | 'term_months'
    | 'auto_renew'
    | 'monthly_rent'
    | 'admin_fee'
    | 'due_day'
    | 'increase_rule'
    | 'increase_points'
    | 'notice_months'
    | 'late_interest_pct'
    | 'insurer'
    | 'policy_number'
    | 'deposit'
  >
}

const person = (name: string, document?: string | null) =>
  document ? `${name}, identificado(a) con documento No. ${document}` : name

/**
 * Plantilla del contrato con los datos del sistema. La inmobiliaria la revisa
 * y la ajusta antes de enviarla a firma (no reemplaza la asesoria juridica).
 */
export function contractTemplate(input: ContractInput): string {
  const { lease } = input
  // Vivienda salvo que se diga comercial (el uso por defecto en la base).
  const housing = lease.lease_use !== 'COMERCIAL'
  const start = formatDate(lease.start_date)
  const address = [input.property.address, input.property.city].filter(Boolean).join(', ')
  const clauses: [string, string][] = []
  const add = (title: string, body: string) => clauses.push([title, body])

  add(
    'OBJETO',
    `El ARRENDADOR entrega a titulo de arrendamiento al ARRENDATARIO el inmueble "${input.property.title}"${
      address ? `, ubicado en ${address}` : ''
    }, con las caracteristicas y el estado descritos en el inventario que hace parte de este contrato.`,
  )
  add(
    'DESTINACION',
    housing
      ? 'El inmueble se destinara exclusivamente a vivienda urbana del ARRENDATARIO y de su nucleo familiar. No podra cambiarse su destinacion sin autorizacion escrita del ARRENDADOR.'
      : 'El inmueble se destinara al desarrollo de la actividad comercial del ARRENDATARIO, quien se obliga a obtener los permisos que esa actividad requiera. No podra cambiarse su destinacion sin autorizacion escrita del ARRENDADOR.',
  )
  add(
    'CANON',
    `El canon mensual es de ${pesos(Number(lease.monthly_rent))}, que el ARRENDATARIO pagara por anticipado dentro de los primeros ${lease.due_day} dias de cada mes, en linea desde la aplicacion de EdiFeasy o en la cuenta que indique el ARRENDADOR.`,
  )
  if (Number(lease.admin_fee) > 0) {
    add(
      'CUOTA DE ADMINISTRACION',
      `Ademas del canon, el ARRENDATARIO pagara la cuota de administracion de la copropiedad, hoy de ${pesos(
        Number(lease.admin_fee),
      )} mensuales, y sus ajustes aprobados por la asamblea.`,
    )
  }
  add(
    'INCREMENTO',
    housing
      ? 'Cada doce (12) meses de ejecucion del contrato, el canon se incrementara en una proporcion que no sera superior al ciento por ciento (100 %) del incremento del indice de precios al consumidor (IPC) del ano calendario inmediatamente anterior, conforme al articulo 20 de la Ley 820 de 2003. El ARRENDADOR comunicara el nuevo valor por escrito.'
      : lease.increase_rule === 'IPC_PLUS'
        ? `Cada doce (12) meses el canon se incrementara en el IPC del ano calendario anterior mas ${Number(lease.increase_points)} puntos porcentuales.`
        : lease.increase_rule === 'FIXED'
          ? `Cada doce (12) meses el canon se incrementara en el ${Number(lease.increase_points)} % pactado por las partes.`
          : 'Cada doce (12) meses el canon se incrementara en el IPC del ano calendario anterior.',
  )
  add(
    'TERMINO',
    `El contrato tiene una duracion de ${lease.term_months} meses contados desde el ${start}.${
      lease.auto_renew
        ? ' Si ninguna de las partes avisa su intencion de terminarlo con la anticipacion pactada, se prorrogara automaticamente por un periodo igual y en las mismas condiciones, salvo el incremento del canon.'
        : ''
    }`,
  )
  add(
    'PREAVISO',
    housing
      ? `La parte que quiera terminar el contrato al vencimiento del periodo inicial o de sus prorrogas debe avisarlo por escrito a la otra con una antelacion no menor a ${lease.notice_months} meses, en los terminos de los articulos 22 a 24 de la Ley 820 de 2003.`
      : `El ARRENDADOR que quiera terminar el contrato debe desahuciar al ARRENDATARIO con una antelacion no menor a ${lease.notice_months} meses (articulo 520 del Codigo de Comercio), sin perjuicio del derecho de renovacion del articulo 518 del mismo codigo.`,
  )
  add(
    'SERVICIOS PUBLICOS',
    'Los servicios publicos domiciliarios y los demas que el ARRENDATARIO contrate estan a su cargo desde la entrega del inmueble. Si no los paga, el ARRENDADOR podra cobrarlos junto con el canon.',
  )
  add(
    'REPARACIONES Y MEJORAS',
    'Las reparaciones locativas (las que se originan en el uso normal del inmueble) estan a cargo del ARRENDATARIO; las necesarias para conservarlo estan a cargo del ARRENDADOR. El ARRENDATARIO no hara mejoras ni modificaciones sin autorizacion escrita; las que haga quedaran a favor del inmueble.',
  )
  const guarantees: string[] = []
  if (lease.insurer) {
    guarantees.push(
      `una poliza de arrendamiento expedida por ${lease.insurer}${
        lease.policy_number ? ` (No. ${lease.policy_number})` : ''
      }`,
    )
  }
  if (input.guarantors.length) {
    guarantees.push(
      `la firma solidaria de ${input.guarantors
        .map((guarantor) => person(guarantor.name, guarantor.document))
        .join(' y ')} como codeudor(es)`,
    )
  }
  add(
    'GARANTIAS',
    `${
      guarantees.length
        ? `Para respaldar sus obligaciones, el ARRENDATARIO ofrece ${guarantees.join(' y ')}. Los codeudores responden solidariamente por todas las obligaciones de este contrato y sus prorrogas.`
        : 'Las partes no pactan garantias adicionales.'
    }${
      housing
        ? ' Conforme al articulo 16 de la Ley 820 de 2003, no se exige deposito en dinero.'
        : Number(lease.deposit) > 0
          ? ` El ARRENDATARIO entrega un deposito de ${pesos(Number(lease.deposit))}, que se devolvera al terminar el contrato descontando lo que adeude.`
          : ''
    }`,
  )
  add(
    'MORA E INCUMPLIMIENTO',
    `${
      Number(lease.late_interest_pct) > 0
        ? `Si el canon no se paga a tiempo, el ARRENDATARIO pagara intereses de mora del ${Number(lease.late_interest_pct)} % mensual, sin exceder la tasa maxima legal permitida. `
        : ''
    }El no pago del canon o de los servicios, el subarriendo o la cesion no autorizados y el cambio de destinacion son causales para que el ARRENDADOR termine el contrato y pida la restitucion del inmueble.`,
  )
  add(
    'ENTREGA Y RESTITUCION',
    'El inmueble se entrega segun el inventario firmado por las partes. Al terminar el contrato, el ARRENDATARIO lo devolvera en el mismo estado, salvo el deterioro por el uso normal, con los servicios pagados al dia.',
  )
  add(
    'CESION Y SUBARRIENDO',
    'El ARRENDATARIO no podra ceder el contrato ni subarrendar el inmueble, total o parcialmente, sin autorizacion escrita del ARRENDADOR.',
  )
  add(
    'FIRMA ELECTRONICA',
    'Las partes aceptan firmar este contrato por medios electronicos y le reconocen plena validez, conforme a la Ley 527 de 1999 y al Decreto 2364 de 2012. Como evidencia se conservan el texto firmado y su huella digital (SHA-256), la fecha y hora, la direccion IP, el navegador y el trazo de la firma de cada firmante.',
  )
  add(
    'DATOS PERSONALES',
    'Las partes autorizan el tratamiento de sus datos personales para la ejecucion de este contrato, conforme a la Ley 1581 de 2012 y a la politica de tratamiento de datos del ARRENDADOR.',
  )
  add(
    'NOTIFICACIONES',
    `Las partes recibiran notificaciones en los datos de contacto registrados en la aplicacion${
      input.tenant.email ? `; el ARRENDATARIO, ademas, en ${input.tenant.email}` : ''
    }.`,
  )

  const ordinals = [
    'PRIMERA',
    'SEGUNDA',
    'TERCERA',
    'CUARTA',
    'QUINTA',
    'SEXTA',
    'SEPTIMA',
    'OCTAVA',
    'NOVENA',
    'DECIMA',
    'DECIMA PRIMERA',
    'DECIMA SEGUNDA',
    'DECIMA TERCERA',
    'DECIMA CUARTA',
    'DECIMA QUINTA',
    'DECIMA SEXTA',
    'DECIMA SEPTIMA',
    'DECIMA OCTAVA',
  ]
  const title = housing
    ? 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA'
    : 'CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL'
  const lessor = input.ownerName
    ? `${person(input.agency.name, input.agency.document)}, quien actua como administrador del inmueble en nombre de su propietario ${input.ownerName}`
    : person(input.agency.name, input.agency.document)
  const intro = `Entre ${lessor}, en adelante el ARRENDADOR, y ${person(
    input.tenant.name,
    input.tenant.document,
  )}, en adelante el ARRENDATARIO, se celebra el presente contrato, que se rige por ${
    housing ? 'la Ley 820 de 2003' : 'el Codigo de Comercio'
  } y por las siguientes clausulas:`

  return [
    title,
    '',
    intro,
    '',
    ...clauses.map(([name, body], index) => `${ordinals[index]} - ${name}. ${body}`),
    '',
    `Para constancia se firma electronicamente en ${input.city || 'Colombia'}.`,
  ].join('\n\n').replace(/\n{3,}/g, '\n\n')
}

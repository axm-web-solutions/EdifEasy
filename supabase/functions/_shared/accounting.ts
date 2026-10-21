// deno-lint-ignore-file no-explicit-any
/**
 * Adaptadores de sistemas contables -> formato comun de EdiFeasy.
 *
 * Todos los proveedores terminan en las mismas filas que recibe
 * import_accounting_data():
 *   UNIT_STATEMENTS: { unit, balance, overdue, interest, last_payment_date, last_payment_amount }
 *   UNIT_MOVEMENTS:  { unit, date, document, concept, debit, credit, external_id }
 *
 * `unit` es el codigo con el que el sistema contable identifica la unidad. Se
 * toma segun `matchBy`:
 *   - CODE_IN_NAME: codigo dentro del nombre del cliente ("T1-301 Ana Perez").
 *   - IDENTIFICATION: documento del cliente (NIT/cedula); la administracion lo
 *     enlaza una vez con la unidad (tabla accounting_unit_links).
 *
 * Es codigo puro (sin APIs de Deno) para poder probarlo con vitest. Los
 * campos se leen de forma tolerante porque cada API los nombra distinto.
 */

export type MatchBy = 'CODE_IN_NAME' | 'IDENTIFICATION'

export interface AccountingSettings {
  matchBy?: MatchBy
  monthsBack?: number
}

export interface StatementRow {
  unit: string
  balance: number
  overdue: number
  interest: number
  last_payment_date: string | null
  last_payment_amount: number | null
}

export interface MovementRow {
  unit: string
  date: string
  document: string | null
  concept: string
  debit: number
  credit: number
  external_id: string
}

export interface NormalizedDocument {
  kind: 'CHARGE' | 'PAYMENT'
  id: string
  date: string
  dueDate: string | null
  document: string | null
  concept: string
  amount: number
  balance: number
  customerName: string
  customerIdentification: string
}

/**
 * Codigo de unidad dentro de un texto: "T1-301", "Torre 2 apto 504",
 * "Casa 07", "Apto 1203". Devuelve null si no hay nada parecido.
 */
export function unitCodeFromName(name: string): string | null {
  const text = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const patterns = [
    /\b(?:torre|t|bloque|b|interior|int)\s*\.?\s*(\d{1,3})\s*[-/ ]?\s*(?:apto|apartamento|apt|casa|#)?\s*\.?\s*(\d{1,4})\b/i,
    /\b(?:apto|apartamento|apt|casa|local|unidad)\s*\.?\s*#?\s*([a-z]?\d{1,4}[a-z]?)\b/i,
    /^\s*(\d{1,3}\s*-\s*\d{1,4})\b/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    return match[2] ? `T${match[1]}-${match[2]}` : match[1].replace(/\s+/g, '')
  }
  return null
}

export function unitCode(
  doc: Pick<NormalizedDocument, 'customerName' | 'customerIdentification'>,
  matchBy: MatchBy = 'CODE_IN_NAME',
): string | null {
  if (matchBy === 'IDENTIFICATION') return doc.customerIdentification || null
  return unitCodeFromName(doc.customerName)
}

const num = (value: unknown): number => {
  const parsed =
    typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}
const day = (value: unknown): string | null => {
  const text = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

// ----------------------------------------------------------------- Alegra
export function fromAlegraInvoice(invoice: any): NormalizedDocument | null {
  if (!invoice || ['void', 'draft'].includes(String(invoice.status ?? '').toLowerCase()))
    return null
  const date = day(invoice.date)
  if (!date) return null
  return {
    kind: 'CHARGE',
    id: `alegra-inv-${invoice.id}`,
    date,
    dueDate: day(invoice.dueDate),
    document: invoice.numberTemplate?.fullNumber ?? invoice.number ?? null,
    concept: invoice.items?.[0]?.name ?? invoice.observations ?? 'Factura',
    amount: num(invoice.total),
    balance: num(invoice.balance),
    customerName: String(invoice.client?.name ?? ''),
    customerIdentification: String(
      invoice.client?.identification ?? invoice.client?.identificationObject?.number ?? '',
    ),
  }
}

export function fromAlegraPayment(payment: any): NormalizedDocument | null {
  if (!payment || String(payment.type ?? 'in') !== 'in') return null
  if (String(payment.status ?? '').toLowerCase() === 'void') return null
  const date = day(payment.date)
  if (!date) return null
  return {
    kind: 'PAYMENT',
    id: `alegra-pay-${payment.id}`,
    date,
    dueDate: null,
    document: payment.numberTemplate?.fullNumber ?? payment.number ?? null,
    concept: payment.observations || 'Pago recibido',
    amount: num(payment.amount),
    balance: 0,
    customerName: String(payment.client?.name ?? ''),
    customerIdentification: String(payment.client?.identification ?? ''),
  }
}

// ------------------------------------------------------------------ Siigo
export function fromSiigoInvoice(invoice: any): NormalizedDocument | null {
  if (!invoice || invoice.annulled === true) return null
  const date = day(invoice.date)
  if (!date) return null
  const dueDate =
    day(invoice.payments?.find((p: any) => p?.due_date)?.due_date) ?? day(invoice.due_date) ?? null
  return {
    kind: 'CHARGE',
    id: `siigo-inv-${invoice.id}`,
    date,
    dueDate,
    document: invoice.name ?? null,
    concept: invoice.items?.[0]?.description ?? invoice.observations ?? 'Factura',
    amount: num(invoice.total),
    balance: num(invoice.balance ?? invoice.total),
    customerName: String(invoice.customer?.name ?? invoice.customer?.commercial_name ?? ''),
    customerIdentification: String(invoice.customer?.identification ?? ''),
  }
}

export function fromSiigoVoucher(voucher: any): NormalizedDocument | null {
  if (!voucher || voucher.annulled === true) return null
  const date = day(voucher.date)
  if (!date) return null
  const amount = num(
    voucher.payment?.value ??
      (Array.isArray(voucher.items)
        ? voucher.items.reduce((sum: number, item: any) => sum + num(item?.value), 0)
        : 0),
  )
  return {
    kind: 'PAYMENT',
    id: `siigo-rc-${voucher.id}`,
    date,
    dueDate: null,
    document: voucher.name ?? null,
    concept: voucher.observations || 'Recibo de caja',
    amount,
    balance: 0,
    customerName: String(voucher.customer?.name ?? ''),
    customerIdentification: String(voucher.customer?.identification ?? ''),
  }
}

/**
 * Estado de cuenta y movimientos a partir de cargos (facturas) y pagos.
 * Saldo = suma de saldos pendientes; vencido = pendiente con vencimiento pasado.
 */
export function buildAccountingRows(
  docs: (NormalizedDocument | null)[],
  options: { today: string; matchBy?: MatchBy } = { today: new Date().toISOString().slice(0, 10) },
): { statements: StatementRow[]; movements: MovementRow[]; withoutUnit: string[] } {
  const statements = new Map<string, StatementRow>()
  const movements: MovementRow[] = []
  const withoutUnit = new Set<string>()

  for (const doc of docs) {
    if (!doc) continue
    const unit = unitCode(doc, options.matchBy)
    if (!unit) {
      withoutUnit.add(doc.customerName || doc.customerIdentification || doc.id)
      continue
    }
    movements.push({
      unit,
      date: doc.date,
      document: doc.document,
      concept: doc.concept.slice(0, 200),
      debit: doc.kind === 'CHARGE' ? doc.amount : 0,
      credit: doc.kind === 'PAYMENT' ? doc.amount : 0,
      external_id: doc.id,
    })

    const current = statements.get(unit) ?? {
      unit,
      balance: 0,
      overdue: 0,
      interest: 0,
      last_payment_date: null,
      last_payment_amount: null,
    }
    if (doc.kind === 'CHARGE') {
      current.balance = num(current.balance + doc.balance)
      if (doc.balance > 0 && doc.dueDate && doc.dueDate < options.today) {
        current.overdue = num(current.overdue + doc.balance)
      }
    } else if (!current.last_payment_date || doc.date > current.last_payment_date) {
      current.last_payment_date = doc.date
      current.last_payment_amount = doc.amount
    }
    statements.set(unit, current)
  }

  return {
    statements: [...statements.values()],
    movements,
    withoutUnit: [...withoutUnit].slice(0, 50),
  }
}

/** Fecha desde la que se sincroniza (por defecto 12 meses atras). */
export function syncStartDate(today: string, monthsBack = 12): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - Math.max(1, Math.min(36, monthsBack)))
  return date.toISOString().slice(0, 10)
}

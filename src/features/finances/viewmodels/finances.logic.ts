import type { StatementWithUnit } from '@/services/accountingService'
import type {
  AccountingImportKind,
  AccountingIntegrationRow,
  AccountingProvider,
  BudgetLineRow,
  FinancialStatementRow,
  PortfolioSnapshotRow,
  UnitAccountMovementRow,
} from '@/types/database'
import { formatCurrency, formatDate, formatRelative } from '@/utils/format'

// ------------------------------------------------------------------ CSV
/**
 * Lee un CSV exportado de Excel o de cualquier software contable. Detecta el
 * separador (Excel en espanol usa ";"), respeta comillas y quita el BOM.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best,
  )
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1
      row.push(field.trim())
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field.trim())
  if (row.some((cell) => cell !== '')) rows.push(row)
  return rows
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

interface KindSpec {
  label: string
  description: string
  required: string[]
  aliases: Record<string, string[]>
  example: string[][]
}

/** Columnas aceptadas por tipo de archivo (en espanol, como las exportan los programas). */
export const IMPORT_KINDS: Record<AccountingImportKind, KindSpec> = {
  UNIT_STATEMENTS: {
    label: 'Estado de cuenta por unidad',
    description: 'Saldo de cada casa o apartamento: total, vencido, intereses y ultimo pago.',
    required: ['unit', 'balance'],
    aliases: {
      unit: [
        'unidad',
        'apartamento',
        'apto',
        'casa',
        'inmueble',
        'codigo unidad',
        'codigo',
        'cliente',
        'tercero',
      ],
      balance: ['saldo', 'saldo total', 'total', 'deuda', 'saldo a la fecha'],
      overdue: ['vencido', 'saldo vencido', 'en mora', 'mora', 'cartera vencida'],
      interest: ['intereses', 'interes', 'intereses de mora', 'interes mora'],
      last_payment_date: ['fecha ultimo pago', 'ultimo pago fecha', 'fecha pago'],
      last_payment_amount: ['valor ultimo pago', 'ultimo pago', 'valor pago'],
    },
    example: [
      ['unidad', 'saldo', 'vencido', 'intereses', 'fecha ultimo pago', 'valor ultimo pago'],
      ['T1-101', '320.000', '0', '0', '05/10/2026', '320.000'],
      ['T1-102', '960.000', '640.000', '12.500', '', ''],
    ],
  },
  UNIT_MOVEMENTS: {
    label: 'Movimientos por unidad',
    description: 'Cuotas causadas, pagos, intereses y ajustes de cada unidad.',
    required: ['unit', 'date', 'concept'],
    aliases: {
      unit: [
        'unidad',
        'apartamento',
        'apto',
        'casa',
        'inmueble',
        'codigo unidad',
        'cliente',
        'tercero',
      ],
      date: ['fecha', 'fecha documento', 'fecha movimiento'],
      document: ['documento', 'comprobante', 'numero', 'factura', 'recibo'],
      concept: ['concepto', 'descripcion', 'detalle'],
      debit: ['debito', 'cargo', 'debe', 'valor cargo', 'causacion'],
      credit: ['credito', 'abono', 'haber', 'pago', 'valor abono'],
      external_id: ['id', 'identificador'],
    },
    example: [
      ['unidad', 'fecha', 'documento', 'concepto', 'debito', 'credito'],
      ['T1-101', '01/10/2026', 'CC-1001', 'Cuota de administracion octubre', '320.000', '0'],
      ['T1-101', '05/10/2026', 'RC-0077', 'Pago cuota octubre', '0', '320.000'],
    ],
  },
  FINANCIAL_STATEMENTS: {
    label: 'Estados financieros',
    description: 'Balance (situacion financiera) y estado de resultados por mes.',
    required: ['period', 'code', 'amount'],
    aliases: {
      period: ['periodo', 'mes', 'fecha corte', 'corte'],
      kind: ['tipo', 'estado', 'informe', 'reporte'],
      code: ['codigo', 'cuenta codigo', 'codigo cuenta', 'puc'],
      name: ['cuenta', 'nombre', 'nombre cuenta', 'descripcion'],
      amount: ['valor', 'saldo', 'monto', 'total'],
      level: ['nivel'],
    },
    example: [
      ['periodo', 'tipo', 'codigo', 'cuenta', 'valor'],
      ['2026-09', 'Balance', '1', 'Activo', '182.400.000'],
      ['2026-09', 'Balance', '11', 'Disponible', '64.200.000'],
      ['2026-09', 'Resultados', '4', 'Ingresos', '38.900.000'],
      ['2026-09', 'Resultados', '5', 'Gastos', '35.100.000'],
    ],
  },
  BUDGET: {
    label: 'Ejecucion presupuestal',
    description: 'Presupuesto aprobado en asamblea frente a lo ejecutado, por rubro.',
    required: ['year', 'code', 'budget'],
    aliases: {
      year: ['ano', 'anio', 'vigencia', 'periodo'],
      code: ['codigo', 'rubro codigo', 'cuenta'],
      name: ['rubro', 'nombre', 'concepto', 'descripcion'],
      kind: ['tipo', 'clase'],
      budget: ['presupuesto', 'presupuestado', 'aprobado', 'valor presupuestado'],
      executed: ['ejecutado', 'ejecucion', 'real', 'valor ejecutado'],
    },
    example: [
      ['ano', 'codigo', 'rubro', 'tipo', 'presupuesto', 'ejecutado'],
      ['2026', '4170', 'Cuotas de administracion', 'Ingreso', '400.000.000', '310.000.000'],
      ['2026', '5105', 'Vigilancia', 'Gasto', '120.000.000', '95.000.000'],
    ],
  },
}

export interface MappedImport {
  rows: Record<string, string>[]
  missing: string[]
  columns: Record<string, string>
}

const FIELD_LABELS: Record<string, string> = {
  unit: 'unidad',
  balance: 'saldo',
  date: 'fecha',
  concept: 'concepto',
  period: 'periodo',
  code: 'codigo',
  amount: 'valor',
  year: 'ano',
  budget: 'presupuesto',
}

/** Convierte la tabla del CSV a las filas que espera la base. */
export function mapImport(kind: AccountingImportKind, table: string[][]): MappedImport {
  const spec = IMPORT_KINDS[kind]
  const [header = [], ...body] = table
  const normalized = header.map(normalizeHeader)
  const columns: Record<string, string> = {}
  const indexes: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(spec.aliases)) {
    const candidates = [field, ...aliases].map(normalizeHeader)
    const index = normalized.findIndex((cell) => candidates.includes(cell))
    if (index >= 0) {
      indexes[field] = index
      columns[field] = header[index]
    }
  }
  const missing = spec.required.filter((field) => indexes[field] === undefined)
  const rows = missing.length
    ? []
    : body.map((cells) =>
        Object.fromEntries(
          Object.entries(indexes).map(([field, index]) => [field, cells[index] ?? '']),
        ),
      )
  return { rows, missing: missing.map((field) => FIELD_LABELS[field] ?? field), columns }
}

export function templateCsv(kind: AccountingImportKind): string {
  return IMPORT_KINDS[kind].example.map((row) => row.join(';')).join('\r\n')
}

// ------------------------------------------------------------ conexiones
export const PROVIDERS: {
  value: AccountingProvider
  label: string
  mode: 'API' | 'FILE'
  hint: string
}[] = [
  {
    value: 'SIIGO',
    label: 'Siigo Nube',
    mode: 'API',
    hint: 'Conexion directa: usuario API y llave de acceso.',
  },
  {
    value: 'ALEGRA',
    label: 'Alegra',
    mode: 'API',
    hint: 'Conexion directa: correo y token de la API.',
  },
  {
    value: 'WORLD_OFFICE',
    label: 'World Office',
    mode: 'FILE',
    hint: 'Exporta a Excel/CSV y cargalo aqui.',
  },
  { value: 'HELISA', label: 'Helisa', mode: 'FILE', hint: 'Exporta a Excel/CSV y cargalo aqui.' },
  {
    value: 'CONTAPYME',
    label: 'ContaPyme',
    mode: 'FILE',
    hint: 'Exporta a Excel/CSV y cargalo aqui.',
  },
  {
    value: 'OTHER',
    label: 'Otro programa',
    mode: 'FILE',
    hint: 'Cualquier programa que exporte a Excel/CSV.',
  },
]

const PROVIDER_LABEL = Object.fromEntries(PROVIDERS.map((p) => [p.value, p.label])) as Record<
  AccountingProvider,
  string
>

export function toIntegrationView(row: AccountingIntegrationRow) {
  const status = {
    CONNECTED: { label: 'Conectado', color: 'green' },
    PENDING: { label: 'Pendiente', color: 'default' },
    ERROR: { label: 'Con error', color: 'red' },
    DISABLED: { label: 'Pausado', color: 'default' },
  }[row.status]
  return {
    id: row.id,
    provider: row.provider,
    mode: row.mode,
    label: PROVIDER_LABEL[row.provider] ?? row.provider,
    modeLabel: row.mode === 'API' ? 'Sincronizacion automatica' : 'Carga de archivos',
    statusLabel: status.label,
    statusColor: status.color,
    lastSyncLabel: row.last_sync_at
      ? `Actualizado ${formatRelative(row.last_sync_at)}`
      : 'Sin sincronizar',
    error: row.last_error,
  }
}

// --------------------------------------------------------- estado de cuenta
type UnitRef = StatementWithUnit['apartment']

export function unitName(apartment: UnitRef): string {
  if (!apartment) return 'Unidad'
  return `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`
}

export function toStatementView(statement: StatementWithUnit) {
  const overdue = Number(statement.overdue)
  return {
    apartmentId: statement.apartment_id,
    unit: unitName(statement.apartment),
    balance: formatCurrency(Number(statement.balance)),
    overdue: formatCurrency(overdue),
    interest: formatCurrency(Number(statement.interest)),
    lastPayment: statement.last_payment_at
      ? `${formatCurrency(Number(statement.last_payment_amount ?? 0))} el ${formatDate(statement.last_payment_at)}`
      : 'Sin pagos registrados',
    inArrears: overdue > 0,
    statusLabel: overdue > 0 ? 'En mora' : 'Al dia',
    statusColor: overdue > 0 ? 'volcano' : 'green',
    updatedLabel: `Corte ${formatDate(statement.as_of)} · actualizado ${formatRelative(statement.synced_at)}`,
  }
}

export function toMovementViews(movements: UnitAccountMovementRow[]) {
  return movements.map((movement) => ({
    id: movement.id,
    date: formatDate(movement.movement_date),
    document: movement.document,
    concept: movement.concept,
    debit: Number(movement.debit) ? formatCurrency(Number(movement.debit)) : '',
    credit: Number(movement.credit) ? formatCurrency(Number(movement.credit)) : '',
  }))
}

// ------------------------------------------------------ estados financieros
interface StatementLine {
  code: string
  name: string
  amount: number
  level: number
}

export function financialPeriods(rows: FinancialStatementRow[]) {
  return [...new Set(rows.map((row) => row.period))].map((period) => ({
    value: period,
    label: new Date(`${period}T12:00:00`).toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    }),
  }))
}

export function financialLines(
  rows: FinancialStatementRow[],
  period: string | null,
  kind: 'BALANCE' | 'RESULTS',
) {
  const row = rows.find((item) => item.period === period && item.kind === kind)
  const lines = (Array.isArray(row?.lines) ? (row?.lines as unknown as StatementLine[]) : []).map(
    (line) => ({
      code: line.code,
      name: line.name || line.code,
      amount: formatCurrency(Number(line.amount)),
      negative: Number(line.amount) < 0,
      // Nivel 1 (clase) en negrilla; la sangria crece con el nivel del PUC.
      indent: Math.max(0, Math.min(4, (Number(line.level) || line.code.length) - 1)),
      strong: (Number(line.level) || line.code.length) <= 1,
    }),
  )
  return { lines, updatedLabel: row ? `Actualizado ${formatRelative(row.synced_at)}` : null }
}

// ------------------------------------------------------------ presupuesto
export function budgetYears(rows: BudgetLineRow[]): number[] {
  return [...new Set(rows.map((row) => row.year))].sort((a, b) => b - a)
}

export function budgetView(rows: BudgetLineRow[], year: number | null) {
  const lines = rows
    .filter((row) => row.year === year)
    .map((row) => {
      const budget = Number(row.budget)
      const executed = Number(row.executed)
      const percent = budget > 0 ? Math.round((executed / budget) * 100) : 0
      return {
        code: row.code,
        name: row.name,
        kind: row.kind,
        budget: formatCurrency(budget),
        executed: formatCurrency(executed),
        percent,
        // En gastos, pasarse es mala noticia; en ingresos, quedarse corto.
        status:
          row.kind === 'EXPENSE'
            ? percent > 100
              ? 'exception'
              : percent >= 90
                ? 'warning'
                : 'normal'
            : 'normal',
      }
    })
  const total = (kind: 'INCOME' | 'EXPENSE') => {
    const items = rows.filter((row) => row.year === year && row.kind === kind)
    const budget = items.reduce((sum, row) => sum + Number(row.budget), 0)
    const executed = items.reduce((sum, row) => sum + Number(row.executed), 0)
    return {
      budget: formatCurrency(budget),
      executed: formatCurrency(executed),
      percent: budget > 0 ? Math.round((executed / budget) * 100) : 0,
      count: items.length,
    }
  }
  return {
    income: lines.filter((line) => line.kind === 'INCOME'),
    expense: lines.filter((line) => line.kind === 'EXPENSE'),
    totals: { income: total('INCOME'), expense: total('EXPENSE') },
  }
}

// ---------------------------------------------------------------- cartera
export function portfolioView(snapshots: PortfolioSnapshotRow[]) {
  const [latest, previous] = snapshots
  if (!latest) return null
  const overdue = Number(latest.total_overdue)
  const change = previous ? overdue - Number(previous.total_overdue) : null
  return {
    totalOverdue: formatCurrency(overdue),
    totalBalance: formatCurrency(Number(latest.total_balance)),
    unitsOverdue: latest.units_overdue,
    unitsTotal: latest.units_total,
    percentUnits: latest.units_total
      ? Math.round((latest.units_overdue / latest.units_total) * 100)
      : 0,
    asOf: formatDate(latest.as_of),
    trend:
      change === null
        ? null
        : change === 0
          ? 'Igual que en el corte anterior'
          : `${change > 0 ? 'Subio' : 'Bajo'} ${formatCurrency(Math.abs(change))} frente al corte anterior`,
    trendGood: change === null ? null : change <= 0,
    history: [...snapshots]
      .slice(0, 12)
      .reverse()
      .map((snapshot) => ({
        label: formatDate(snapshot.as_of),
        value: Number(snapshot.total_overdue),
      })),
  }
}

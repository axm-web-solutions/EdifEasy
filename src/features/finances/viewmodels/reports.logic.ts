import type {
  FinancialReportCategory,
  FinancialReportRow,
  FinancialReportType,
  TaxAuthority,
  TaxObligationRow,
} from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'

// --------------------------------------------------------------- reportes
export const CATEGORIES: { value: FinancialReportCategory; label: string; description: string }[] =
  [
    {
      value: 'FINANCIAL_STATEMENTS',
      label: 'Estados financieros',
      description: 'Situacion financiera y resultados de cada mes.',
    },
    {
      value: 'BUDGET',
      label: 'Presupuesto',
      description: 'Lo aprobado en asamblea frente a lo ejecutado.',
    },
    {
      value: 'PORTFOLIO',
      label: 'Cartera',
      description: 'Cuanto se le debe al conjunto y como evoluciona.',
    },
    {
      value: 'TAXES',
      label: 'Impuestos y DIAN',
      description: 'Declaraciones y certificados tributarios.',
    },
    {
      value: 'AUDIT',
      label: 'Revisoria fiscal',
      description: 'Dictamenes e informes del revisor fiscal.',
    },
    {
      value: 'ASSEMBLY',
      label: 'Asamblea',
      description: 'Informes de gestion y documentos para la asamblea.',
    },
    { value: 'OTHER', label: 'Otros', description: 'Otros informes del contador.' },
  ]

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
  FinancialReportCategory,
  string
>

export const REPORT_TYPES: { value: FinancialReportType; label: string; hint: string }[] = [
  {
    value: 'BALANCE',
    label: 'Estado de situacion financiera',
    hint: 'Se arma con los datos contables del mes elegido.',
  },
  {
    value: 'RESULTS',
    label: 'Estado de resultados',
    hint: 'Se arma con los datos contables del mes elegido.',
  },
  {
    value: 'BUDGET',
    label: 'Ejecucion presupuestal',
    hint: 'Se arma con el presupuesto del ano elegido.',
  },
  {
    value: 'PORTFOLIO',
    label: 'Cartera del conjunto',
    hint: 'Muestra el ultimo corte de cartera cargado.',
  },
  {
    value: 'DOCUMENT',
    label: 'Documento (PDF)',
    hint: 'Sube el informe tal cual lo entrego el contador.',
  },
]

const TYPE_LABEL = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t.label])) as Record<
  FinancialReportType,
  string
>

/** Categoria sugerida segun el tipo (el contador la puede cambiar). */
export function defaultCategory(type: FinancialReportType): FinancialReportCategory {
  if (type === 'BUDGET') return 'BUDGET'
  if (type === 'PORTFOLIO') return 'PORTFOLIO'
  if (type === 'DOCUMENT') return 'OTHER'
  return 'FINANCIAL_STATEMENTS'
}

export function monthLabel(period: string): string {
  return new Date(`${period.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })
}

export interface ReportView {
  id: string
  title: string
  category: FinancialReportCategory
  categoryLabel: string
  type: FinancialReportType
  typeLabel: string
  periodLabel: string | null
  summary: string | null
  isDraft: boolean
  statusLabel: string
  publishedLabel: string
  hasFile: boolean
  filePath: string | null
  period: string | null
  year: number | null
}

export function toReportView(row: FinancialReportRow): ReportView {
  const periodLabel =
    row.report_type === 'BALANCE' || row.report_type === 'RESULTS'
      ? row.period
        ? monthLabel(row.period)
        : null
      : row.report_type === 'BUDGET'
        ? row.year
          ? `Ano ${row.year}`
          : null
        : row.report_type === 'PORTFOLIO'
          ? 'Ultimo corte'
          : null
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    categoryLabel: CATEGORY_LABEL[row.category] ?? row.category,
    type: row.report_type,
    typeLabel: TYPE_LABEL[row.report_type] ?? row.report_type,
    periodLabel,
    summary: row.summary,
    isDraft: row.status === 'DRAFT',
    statusLabel: row.status === 'DRAFT' ? 'Borrador' : 'Publicado',
    publishedLabel: row.published_at
      ? `Publicado el ${formatDate(row.published_at)}`
      : 'Sin publicar',
    hasFile: Boolean(row.file_path),
    filePath: row.file_path,
    period: row.period,
    year: row.year,
  }
}

/** Reportes agrupados por categoria, en el orden de CATEGORIES. */
export function groupReports(
  reports: ReportView[],
  category: FinancialReportCategory | 'ALL' = 'ALL',
) {
  return CATEGORIES.filter((c) => category === 'ALL' || c.value === category)
    .map((c) => ({
      key: c.value,
      label: c.label,
      description: c.description,
      reports: reports.filter((report) => report.category === c.value),
    }))
    .filter((group) => group.reports.length > 0)
}

export function categoryCounts(reports: ReportView[]) {
  return CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
    count: reports.filter((report) => report.category === c.value).length,
  })).filter((item) => item.count > 0)
}

// ---------------------------------------------------- obligaciones fiscales
export const AUTHORITIES: { value: TaxAuthority; label: string }[] = [
  { value: 'DIAN', label: 'DIAN' },
  { value: 'MUNICIPIO', label: 'Municipio / Secretaria de Hacienda' },
  { value: 'UGPP', label: 'UGPP / Seguridad social' },
  { value: 'SUPERSOLIDARIA', label: 'Supersolidaria' },
  { value: 'OTRA', label: 'Otra entidad' },
]

/**
 * Obligaciones frecuentes de una propiedad horizontal. Muchas dependen del
 * caso (actividades comerciales, empleados, municipio): por eso "si aplica".
 * El contador decide cuales registrar y sus fechas.
 */
export const TAX_PRESETS: { name: string; authority: TaxAuthority }[] = [
  { name: 'Retencion en la fuente (formulario 350)', authority: 'DIAN' },
  { name: 'Informacion exogena (medios magneticos)', authority: 'DIAN' },
  { name: 'Declaracion de ingresos y patrimonio (si aplica)', authority: 'DIAN' },
  { name: 'Declaracion de IVA (si aplica)', authority: 'DIAN' },
  { name: 'Actualizacion del RUT', authority: 'DIAN' },
  { name: 'Retencion de ICA - ReteICA (si aplica)', authority: 'MUNICIPIO' },
  { name: 'Industria y comercio - ICA (si aplica)', authority: 'MUNICIPIO' },
  { name: 'Planilla de seguridad social - PILA', authority: 'UGPP' },
]

const STATUS = {
  PENDING: { label: 'Pendiente', color: 'default' },
  FILED: { label: 'Presentada', color: 'blue' },
  PAID: { label: 'Pagada', color: 'green' },
  NOT_APPLICABLE: { label: 'No aplica', color: 'default' },
} as const

const DAY = 86_400_000

export interface ObligationView {
  id: string
  name: string
  authorityLabel: string
  periodLabel: string | null
  dueLabel: string
  dueHint: string
  statusLabel: string
  statusColor: string
  urgency: 'overdue' | 'soon' | 'ok' | 'done'
  amount: string | null
  reference: string | null
  notes: string | null
  filePath: string | null
  isPending: boolean
}

export function toObligationView(row: TaxObligationRow, today = new Date()): ObligationView {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const due = new Date(`${row.due_date}T00:00:00`)
  const days = Math.round((due.getTime() - start.getTime()) / DAY)
  const pending = row.status === 'PENDING'
  const urgency: ObligationView['urgency'] = !pending
    ? 'done'
    : days < 0
      ? 'overdue'
      : days <= 7
        ? 'soon'
        : 'ok'
  const status =
    urgency === 'overdue'
      ? { label: 'Vencida', color: 'red' }
      : urgency === 'soon'
        ? { label: 'Vence pronto', color: 'gold' }
        : STATUS[row.status]
  return {
    id: row.id,
    name: row.name,
    authorityLabel: AUTHORITIES.find((a) => a.value === row.authority)?.label ?? row.authority,
    periodLabel: row.period_label,
    dueLabel: formatDate(row.due_date),
    dueHint: !pending
      ? row.completed_at
        ? `${STATUS[row.status].label} el ${formatDate(row.completed_at)}`
        : STATUS[row.status].label
      : days < 0
        ? `Vencio hace ${-days} ${-days === 1 ? 'dia' : 'dias'}`
        : days === 0
          ? 'Vence hoy'
          : `Faltan ${days} ${days === 1 ? 'dia' : 'dias'}`,
    statusLabel: status.label,
    statusColor: status.color,
    urgency,
    amount: row.amount !== null ? formatCurrency(Number(row.amount)) : null,
    reference: row.reference,
    notes: row.notes,
    filePath: row.file_path,
    isPending: pending,
  }
}

export function obligationsSummary(views: ObligationView[]) {
  const next = views.find((view) => view.isPending)
  return {
    pending: views.filter((view) => view.isPending).length,
    overdue: views.filter((view) => view.urgency === 'overdue').length,
    soon: views.filter((view) => view.urgency === 'soon').length,
    next: next ? `${next.name} · ${next.dueLabel}` : null,
  }
}

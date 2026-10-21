import { describe, expect, it } from 'vitest'
import type { FinancialReportRow, TaxObligationRow } from '@/types/database'
import {
  categoryCounts,
  defaultCategory,
  groupReports,
  obligationsSummary,
  toObligationView,
  toReportView,
} from './reports.logic'

const report = (overrides: Partial<FinancialReportRow> = {}): FinancialReportRow => ({
  id: 'r1',
  condominium_id: 'c',
  title: 'Estados financieros septiembre',
  category: 'FINANCIAL_STATEMENTS',
  report_type: 'BALANCE',
  period: '2026-09-01',
  year: null,
  summary: null,
  file_path: null,
  status: 'PUBLISHED',
  published_at: '2026-10-05T12:00:00Z',
  published_by: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const obligation = (overrides: Partial<TaxObligationRow> = {}): TaxObligationRow => ({
  id: 't1',
  condominium_id: 'c',
  name: 'Retencion en la fuente',
  authority: 'DIAN',
  period_label: 'Octubre 2026',
  due_date: '2026-11-12',
  status: 'PENDING',
  amount: null,
  reference: null,
  notes: null,
  file_path: null,
  completed_at: null,
  created_by: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const TODAY = new Date('2026-11-08T15:00:00')

describe('reportes', () => {
  it('etiquetas de periodo segun el tipo', () => {
    expect(toReportView(report()).periodLabel).toMatch(/septiembre/i)
    expect(
      toReportView(report({ report_type: 'BUDGET', period: null, year: 2026 })).periodLabel,
    ).toBe('Ano 2026')
    expect(toReportView(report({ report_type: 'PORTFOLIO', period: null })).periodLabel).toBe(
      'Ultimo corte',
    )
    expect(
      toReportView(report({ report_type: 'DOCUMENT', period: null, file_path: 'x.pdf' })),
    ).toMatchObject({
      periodLabel: null,
      hasFile: true,
    })
    expect(toReportView(report({ status: 'DRAFT', published_at: null }))).toMatchObject({
      isDraft: true,
      publishedLabel: 'Sin publicar',
    })
  })

  it('agrupa por categoria en orden y filtra', () => {
    const views = [
      toReportView(report({ id: 'a', category: 'BUDGET', report_type: 'BUDGET', year: 2026 })),
      toReportView(report({ id: 'b' })),
      toReportView(report({ id: 'c', category: 'TAXES', report_type: 'DOCUMENT', file_path: 'x' })),
    ]
    expect(groupReports(views).map((g) => g.key)).toEqual([
      'FINANCIAL_STATEMENTS',
      'BUDGET',
      'TAXES',
    ])
    expect(groupReports(views, 'TAXES').map((g) => g.reports.map((r) => r.id))).toEqual([['c']])
    expect(categoryCounts(views).map((c) => [c.value, c.count])).toEqual([
      ['FINANCIAL_STATEMENTS', 1],
      ['BUDGET', 1],
      ['TAXES', 1],
    ])
    expect(defaultCategory('PORTFOLIO')).toBe('PORTFOLIO')
    expect(defaultCategory('RESULTS')).toBe('FINANCIAL_STATEMENTS')
  })
})

describe('obligaciones fiscales', () => {
  it('urgencia por fecha de vencimiento', () => {
    expect(toObligationView(obligation(), TODAY)).toMatchObject({
      urgency: 'soon',
      statusLabel: 'Vence pronto',
      dueHint: 'Faltan 4 dias',
    })
    expect(toObligationView(obligation({ due_date: '2026-11-07' }), TODAY)).toMatchObject({
      urgency: 'overdue',
      statusLabel: 'Vencida',
      dueHint: 'Vencio hace 1 dia',
    })
    expect(toObligationView(obligation({ due_date: '2026-11-08' }), TODAY).dueHint).toBe(
      'Vence hoy',
    )
    expect(toObligationView(obligation({ due_date: '2026-12-30' }), TODAY).urgency).toBe('ok')
    expect(
      toObligationView(
        obligation({ status: 'PAID', completed_at: '2026-11-10T10:00:00Z', amount: 450000 }),
        TODAY,
      ),
    ).toMatchObject({ urgency: 'done', statusLabel: 'Pagada', isPending: false })
  })

  it('resumen', () => {
    const views = [
      toObligationView(obligation({ id: '1', due_date: '2026-11-01' }), TODAY),
      toObligationView(obligation({ id: '2' }), TODAY),
      toObligationView(obligation({ id: '3', status: 'FILED' }), TODAY),
    ]
    expect(obligationsSummary(views)).toMatchObject({ pending: 2, overdue: 1, soon: 1 })
    expect(obligationsSummary(views).next).toMatch(/^Retencion en la fuente · /)
  })
})

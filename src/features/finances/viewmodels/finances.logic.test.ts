import { describe, expect, it } from 'vitest'
import type { BudgetLineRow, FinancialStatementRow, PortfolioSnapshotRow } from '@/types/database'
import {
  budgetView,
  budgetYears,
  financialLines,
  financialPeriods,
  mapImport,
  parseCsv,
  portfolioView,
  templateCsv,
  toStatementView,
} from './finances.logic'

describe('CSV', () => {
  it('Excel en espanol (punto y coma, comillas y BOM)', () => {
    const csv = '\uFEFFunidad;saldo;"concepto ""largo"""\r\nT1-101;"1.234,50";x\r\n\r\nT1-102;0;y\n'
    expect(parseCsv(csv)).toEqual([
      ['unidad', 'saldo', 'concepto "largo"'],
      ['T1-101', '1.234,50', 'x'],
      ['T1-102', '0', 'y'],
    ])
  })
  it('coma y tabulador', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('mapeo de columnas', () => {
  it('reconoce encabezados en espanol con tildes y mayusculas', () => {
    const result = mapImport('UNIT_STATEMENTS', [
      ['Apartamento', 'Saldo Total', 'Cartera Vencida', 'Intereses de Mora'],
      ['T1-101', '320.000', '0', '0'],
    ])
    expect(result.missing).toEqual([])
    expect(result.rows).toEqual([
      { unit: 'T1-101', balance: '320.000', overdue: '0', interest: '0' },
    ])
  })
  it('avisa las columnas obligatorias que faltan', () => {
    expect(
      mapImport('BUDGET', [
        ['rubro', 'valor'],
        ['x', '1'],
      ]).missing,
    ).toEqual(['ano', 'codigo', 'presupuesto'])
  })
  it('las plantillas se leen sin faltantes', () => {
    for (const kind of [
      'UNIT_STATEMENTS',
      'UNIT_MOVEMENTS',
      'FINANCIAL_STATEMENTS',
      'BUDGET',
    ] as const) {
      const result = mapImport(kind, parseCsv(templateCsv(kind)))
      expect(result.missing, kind).toEqual([])
      expect(result.rows.length, kind).toBeGreaterThan(0)
    }
  })
})

describe('vistas', () => {
  it('estado de cuenta en mora', () => {
    const view = toStatementView({
      apartment_id: 'a',
      condominium_id: 'c',
      balance: 960000,
      overdue: 640000,
      interest: 12500,
      last_payment_at: null,
      last_payment_amount: null,
      as_of: '2026-10-20',
      source: 'FILE',
      synced_at: '2026-10-20T12:00:00Z',
      apartment: { id: 'a', number: '102', building: { name: 'Torre 1' } },
    })
    expect(view).toMatchObject({
      unit: 'Torre 1 · 102',
      inArrears: true,
      statusLabel: 'En mora',
      lastPayment: 'Sin pagos registrados',
    })
  })

  it('estados financieros por periodo', () => {
    const rows: FinancialStatementRow[] = [
      {
        condominium_id: 'c',
        period: '2026-09-01',
        kind: 'BALANCE',
        lines: [
          { code: '1', name: 'Activo', amount: 100, level: 1 },
          { code: '11', name: 'Disponible', amount: -5, level: 2 },
        ],
        synced_at: '2026-10-20T12:00:00Z',
      },
      { condominium_id: 'c', period: '2026-08-01', kind: 'BALANCE', lines: [], synced_at: '' },
    ]
    expect(financialPeriods(rows).map((p) => p.value)).toEqual(['2026-09-01', '2026-08-01'])
    const { lines } = financialLines(rows, '2026-09-01', 'BALANCE')
    expect(lines.map((l) => [l.indent, l.strong, l.negative])).toEqual([
      [0, true, false],
      [1, false, true],
    ])
    expect(financialLines(rows, '2026-09-01', 'RESULTS').lines).toEqual([])
  })

  it('presupuesto con alertas de sobre-ejecucion', () => {
    const line = (
      code: string,
      kind: 'INCOME' | 'EXPENSE',
      budget: number,
      executed: number,
      year = 2026,
    ): BudgetLineRow => ({
      condominium_id: 'c',
      year,
      code,
      name: code,
      kind,
      budget,
      executed,
      synced_at: '',
    })
    const rows = [
      line('5105', 'EXPENSE', 100, 105),
      line('5110', 'EXPENSE', 100, 92),
      line('4170', 'INCOME', 400, 300),
      line('5105', 'EXPENSE', 1, 1, 2025),
    ]
    expect(budgetYears(rows)).toEqual([2026, 2025])
    const view = budgetView(rows, 2026)
    expect(view.expense.map((l) => l.status)).toEqual(['exception', 'warning'])
    expect(view.totals.expense.percent).toBe(99)
    expect(view.totals.income.percent).toBe(75)
  })

  it('cartera con tendencia', () => {
    const snap = (as_of: string, total_overdue: number): PortfolioSnapshotRow => ({
      condominium_id: 'c',
      as_of,
      total_overdue,
      total_balance: 1000000,
      units_overdue: 3,
      units_total: 12,
      synced_at: '',
    })
    const view = portfolioView([snap('2026-10-20', 500000), snap('2026-09-20', 800000)])
    expect(view).toMatchObject({ percentUnits: 25, trendGood: true })
    expect(view?.trend).toMatch(/^Bajo /)
    expect(view?.history.map((h) => h.value)).toEqual([800000, 500000])
    expect(portfolioView([])).toBeNull()
  })
})

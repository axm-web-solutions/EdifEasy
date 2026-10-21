import { Card, Progress } from 'antd'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/ui/states'
import type { budgetView, financialLines, portfolioView } from '../viewmodels/finances.logic'

type Lines = ReturnType<typeof financialLines>['lines']
type Budget = ReturnType<typeof budgetView>
type Portfolio = NonNullable<ReturnType<typeof portfolioView>>

export function Kpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'ok'
}) {
  return (
    <Card size="small" className="surface-card">
      <p className="m-0 text-xs text-slate-500">{label}</p>
      <p
        className={`m-0 text-lg font-semibold ${
          tone === 'danger' ? 'text-red-600' : tone === 'ok' ? 'text-emerald-700' : 'text-slate-800'
        }`}
      >
        {value}
      </p>
    </Card>
  )
}

export function StatementLines({ lines }: { lines: Lines }) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Sin datos para este periodo"
        description="El contador aun no ha cargado este estado para el mes del reporte."
      />
    )
  }
  return (
    <Card className="surface-card" styles={{ body: { padding: 0 } }}>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0">
        {lines.map((line) => (
          <li
            key={`${line.code}-${line.name}`}
            className="flex items-center gap-3 py-2 pr-4 text-sm"
            style={{ paddingLeft: 16 + line.indent * 16 }}
          >
            <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">{line.code}</span>
            <span
              className={`min-w-0 flex-1 ${line.strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
            >
              {line.name}
            </span>
            <span
              className={`tabular-nums ${line.negative ? 'text-red-600' : 'text-slate-800'} ${line.strong ? 'font-semibold' : ''}`}
            >
              {line.amount}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BudgetSection({
  title,
  lines,
  total,
}: {
  title: string
  lines: Budget['expense']
  total: Budget['totals']['expense']
}) {
  if (lines.length === 0) return null
  return (
    <Card
      size="small"
      className="surface-card"
      title={title}
      extra={
        <span className="text-xs text-slate-500">
          {total.executed} de {total.budget} ({total.percent}%)
        </span>
      }
    >
      <ul className="m-0 list-none space-y-3 p-0">
        {lines.map((line) => (
          <li key={line.code}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-800">{line.name}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {line.executed} / {line.budget}
              </span>
            </div>
            <Progress
              percent={Math.min(line.percent, 100)}
              format={() => `${line.percent}%`}
              size="small"
              status={line.status === 'exception' ? 'exception' : 'normal'}
              strokeColor={line.status === 'warning' ? '#d97706' : undefined}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function BudgetContent({ budget }: { budget: Budget }) {
  if (budget.income.length === 0 && budget.expense.length === 0) {
    return <EmptyState title="Sin presupuesto para este ano" />
  }
  return (
    <div className="space-y-3">
      <BudgetSection title="Ingresos" lines={budget.income} total={budget.totals.income} />
      <BudgetSection title="Gastos" lines={budget.expense} total={budget.totals.expense} />
    </div>
  )
}

export function PortfolioContent({ portfolio }: { portfolio: Portfolio | null }) {
  if (!portfolio) return <EmptyState title="Sin informacion de cartera" />
  const max = Math.max(1, ...portfolio.history.map((h) => h.value))
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Cartera vencida"
          value={portfolio.totalOverdue}
          tone={portfolio.unitsOverdue ? 'danger' : 'ok'}
        />
        <Kpi
          label="Unidades en mora"
          value={`${portfolio.unitsOverdue} de ${portfolio.unitsTotal} (${portfolio.percentUnits}%)`}
        />
        <Kpi label="Saldo por cobrar" value={portfolio.totalBalance} />
      </div>
      {portfolio.trend ? (
        <p
          className={`m-0 flex items-center gap-1 text-sm ${portfolio.trendGood ? 'text-emerald-700' : 'text-red-600'}`}
        >
          {portfolio.trendGood ? <TrendingDown size={16} /> : <TrendingUp size={16} />}{' '}
          {portfolio.trend}
        </p>
      ) : null}
      {portfolio.history.length > 1 ? (
        <Card size="small" className="surface-card" title="Evolucion de la cartera vencida">
          <div
            className="flex h-32 items-end gap-2"
            role="img"
            aria-label="Evolucion de la cartera vencida"
          >
            {portfolio.history.map((h) => (
              <div key={h.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-500/80"
                  style={{ height: `${Math.max(4, (h.value / max) * 100)}px` }}
                />
                <span className="w-full truncate text-center text-[10px] text-slate-500">
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <p className="m-0 text-xs text-slate-500">
        Corte {portfolio.asOf}. No se muestran datos de otras unidades.
      </p>
    </div>
  )
}

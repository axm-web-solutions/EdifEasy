import type { ReactNode } from 'react'
import { Card, Skeleton } from 'antd'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/states'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/utils/format'

const PALETTE = [
  '#2559eb',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#db2777',
  '#4f46e5',
  '#94a3b8',
]

export interface ChartPoint {
  name: string
  value: number
  color?: string
}

function ChartShell({
  title,
  subtitle,
  loading,
  isEmpty,
  height = 280,
  extra,
  children,
}: {
  title: string
  subtitle?: string
  loading?: boolean
  isEmpty?: boolean
  height?: number
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      className="surface-card h-full"
      title={
        <div>
          <p className="m-0 text-sm font-semibold text-slate-800">{title}</p>
          {subtitle ? <p className="m-0 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      }
      extra={extra}
      styles={{ body: { padding: 12 } }}
    >
      {loading ? (
        <div style={{ height }}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      ) : isEmpty ? (
        <div style={{ height }} className="flex items-center justify-center">
          <EmptyState title="Sin datos" description="Aun no hay informacion para graficar." />
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </Card>
  )
}

export function AreaChartCard({
  title,
  subtitle,
  data,
  loading,
  currency = false,
  height,
}: {
  title: string
  subtitle?: string
  data: ChartPoint[]
  loading?: boolean
  currency?: boolean
  height?: number
}) {
  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      loading={loading}
      isEmpty={data.length === 0}
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2559eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2559eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={currency ? 70 : 44}
            tickFormatter={(value: number) =>
              currency ? formatCompactCurrency(value) : formatNumber(value)
            }
          />
          <Tooltip
            formatter={(value: number) => (currency ? formatCurrency(value) : formatNumber(value))}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={currency ? 'Total' : 'Cantidad'}
            stroke="#2559eb"
            strokeWidth={2}
            fill="url(#areaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function BarChartCard({
  title,
  subtitle,
  data,
  loading,
  currency = false,
  height,
}: {
  title: string
  subtitle?: string
  data: ChartPoint[]
  loading?: boolean
  currency?: boolean
  height?: number
}) {
  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      loading={loading}
      isEmpty={data.length === 0}
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={currency ? 70 : 40}
            allowDecimals={false}
            tickFormatter={(value: number) =>
              currency ? formatCompactCurrency(value) : formatNumber(value)
            }
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            formatter={(value: number) => (currency ? formatCurrency(value) : formatNumber(value))}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Bar dataKey="value" name={currency ? 'Total' : 'Cantidad'} radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color ?? PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function PieChartCard({
  title,
  subtitle,
  data,
  loading,
  currency = false,
  height,
}: {
  title: string
  subtitle?: string
  data: ChartPoint[]
  loading?: boolean
  currency?: boolean
  height?: number
}) {
  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      loading={loading}
      isEmpty={data.length === 0}
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="80%"
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color ?? PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => (currency ? formatCurrency(value) : formatNumber(value))}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

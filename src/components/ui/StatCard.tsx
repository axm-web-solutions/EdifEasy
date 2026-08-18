import type { ReactNode } from 'react'
import { Card, Skeleton, Tooltip } from 'antd'
import { Link } from 'react-router-dom'

export interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  /** Clases de color del contenedor del icono. */
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate'
  hint?: string
  to?: string
  loading?: boolean
  footer?: ReactNode
}

const TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function StatCard({
  title,
  value,
  icon,
  tone = 'blue',
  hint,
  to,
  loading = false,
  footer,
}: StatCardProps) {
  const content = (
    <Card className="surface-card h-full" styles={{ body: { padding: 18 } }} hoverable={Boolean(to)}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 m-0">
                {title}
              </p>
              <p className="stat-value mt-1 mb-0 truncate">{value}</p>
            </div>
            <span className={`shrink-0 rounded-lg p-2.5 ${TONES[tone]}`}>{icon}</span>
          </div>
          {footer ? <div className="mt-3 text-xs text-slate-500">{footer}</div> : null}
        </>
      )}
    </Card>
  )

  const wrapped = hint ? (
    <Tooltip title={hint}>
      <div className="h-full">{content}</div>
    </Tooltip>
  ) : (
    content
  )

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {wrapped}
      </Link>
    )
  }

  return wrapped
}

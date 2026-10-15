import type { ReactNode } from 'react'
import { Card } from 'antd'

interface SectionCardProps {
  title: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  dataTour?: string
}

/** Card de seccion con el titulo y estilo comunes de la app (`surface-card`). */
export function SectionCard({ title, extra, children, className, dataTour }: SectionCardProps) {
  return (
    <Card
      className={`surface-card ${className ?? ''}`.trim()}
      title={<span className="text-sm font-semibold">{title}</span>}
      extra={extra}
      data-tour={dataTour}
    >
      {children}
    </Card>
  )
}

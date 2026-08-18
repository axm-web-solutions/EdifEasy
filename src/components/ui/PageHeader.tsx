import type { ReactNode } from 'react'
import { Breadcrumb, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

export interface BreadcrumbItem {
  label: string
  to?: string
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  extra,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  extra?: ReactNode
}) {
  return (
    <div className="mb-5">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb
          className="mb-2"
          items={breadcrumbs.map((item) => ({
            title: item.to ? <Link to={item.to}>{item.label}</Link> : item.label,
          }))}
        />
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Title level={3} className="!mb-1 !text-slate-800 truncate">
            {title}
          </Title>
          {subtitle ? (
            <Text type="secondary" className="text-sm">
              {subtitle}
            </Text>
          ) : null}
          {extra}
        </div>

        {actions ? (
          <Space wrap className="shrink-0">
            {actions}
          </Space>
        ) : null}
      </div>
    </div>
  )
}

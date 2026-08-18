import type { ReactNode } from 'react'
import { Alert, Button, Card, Empty, Result, Skeleton, Space } from 'antd'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  title = 'Sin informacion',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="py-10">
      <Empty
        image={<Inbox className="mx-auto text-slate-300" size={56} strokeWidth={1.25} />}
        description={
          <div className="space-y-1">
            <p className="text-slate-700 font-medium m-0">{title}</p>
            {description ? <p className="text-slate-500 text-sm m-0">{description}</p> : null}
          </div>
        }
      >
        {action}
      </Empty>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
export function ErrorState({
  title = 'No se pudo cargar la informacion',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="py-6">
      <Alert
        type="error"
        showIcon
        icon={<AlertTriangle size={18} />}
        message={title}
        description={description}
        action={
          onRetry ? (
            <Button size="small" icon={<RefreshCw size={14} />} onClick={onRetry}>
              Reintentar
            </Button>
          ) : null
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading / skeletons
// ---------------------------------------------------------------------------
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton.Input key={index} active block style={{ height: 40 }} />
      ))}
    </div>
  )
}

/** Rejilla de tarjetas en carga. Solo la usa `PageSkeleton`. */
function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="card-grid">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="surface-card">
          <Skeleton active paragraph={{ rows: 1 }} />
        </Card>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <Space direction="vertical" size="large" className="w-full">
      <Skeleton active paragraph={{ rows: 1 }} />
      <CardsSkeleton />
      <Card className="surface-card">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    </Space>
  )
}

export function DetailSkeleton() {
  return (
    <Card className="surface-card">
      <Skeleton active avatar paragraph={{ rows: 5 }} />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------
export function AccessDenied({ description }: { description?: string }) {
  return (
    <Result
      status="403"
      title="Acceso restringido"
      subTitle={
        description ??
        'Tu rol actual no tiene permisos para ver esta seccion. Si crees que es un error, contacta al administrador del condominio.'
      }
    />
  )
}


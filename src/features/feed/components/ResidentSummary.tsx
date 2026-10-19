import { Alert, Card, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, FileQuestion, Gavel, Home, MessageCircle, Siren, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  QuickAccessKey,
  ResidentSummaryViewModel,
} from '../viewmodels/useResidentSummaryViewModel'

const ICONS: Record<QuickAccessKey, ReactNode> = {
  apartment: <Home size={18} />,
  alerts: <Siren size={18} />,
  fines: <Gavel size={18} />,
  requests: <FileQuestion size={18} />,
  reservations: <CalendarClock size={18} />,
  messages: <MessageCircle size={18} />,
}

/** Alertas importantes arriba del feed. */
export function CriticalAlerts({ vm }: { vm: ResidentSummaryViewModel }) {
  if (vm.criticalAlerts.length === 0) return null
  return (
    <Alert
      type="error"
      showIcon
      className="mb-4"
      message={`Tienes ${vm.criticalAlerts.length} alerta(s) importante(s)`}
      description={
        <ul className="m-0 list-disc pl-5">
          {vm.criticalAlerts.map((alert) => (
            <li key={alert.id} className="text-sm">
              <strong>{alert.title}</strong> — {alert.description}
            </li>
          ))}
        </ul>
      }
      action={<Link to="/alerts">Ver alertas</Link>}
    />
  )
}

/** Accesos rapidos del residente con sus contadores. */
export function QuickAccessCard({ vm }: { vm: ResidentSummaryViewModel }) {
  return (
    <Card
      className="surface-card"
      data-tour="quick-access"
      title={<span className="text-sm font-semibold">Lo tuyo</span>}
      styles={{ body: { padding: 8 } }}
    >
      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 3 }} className="p-2" />
      ) : (
        <ul className="m-0 list-none p-0">
          {vm.quickAccess.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-slate-700 no-underline hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
                  {ICONS[item.key]}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{item.title}</span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-slate-900">{item.value}</span>
                  {item.footer ? <span className="block text-[11px] text-slate-500">{item.footer}</span> : null}
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
            </li>
          ))}
          {vm.showMarketplace ? (
            <li>
              <Link
                to="/marketplace"
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-slate-700 no-underline hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
                  <Store size={18} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">
                  Marketplace
                  <span className="block text-xs font-normal text-slate-500">
                    Aseo, plomeros, taxis y mas cerca de ti
                  </span>
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  )
}

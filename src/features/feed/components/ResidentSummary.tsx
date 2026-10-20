import { Card, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  Gavel,
  Home,
  MapPinned,
  MessageCircle,
  Siren,
  Store,
  Vote,
} from 'lucide-react'
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
  surveys: <Vote size={18} />,
  services: <MapPinned size={18} />,
}

/**
 * Aviso suave de alertas importantes: tono ambar, colapsado y descartable.
 * Va en la columna lateral, no encima del feed.
 */
export function AlertsNotice({ vm }: { vm: ResidentSummaryViewModel }) {
  const notice = vm.notice
  if (!notice) return null
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3" aria-live="polite">
      <div className="flex items-start gap-2">
        <BellRing size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={vm.toggleNotice}
            aria-expanded={notice.expanded}
            className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-sm font-medium text-amber-900"
          >
            {notice.title}
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${notice.expanded ? 'rotate-180' : ''}`}
            />
          </button>
          {notice.expanded ? (
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {notice.alerts.map((alert) => (
                <li key={alert.id} className="text-sm text-amber-900">
                  <strong className="font-medium">{alert.title}</strong>
                  <span className="block text-xs text-amber-800">{alert.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex gap-3 text-xs">
            <Link to="/alerts" className="font-medium text-amber-800">
              Ver alertas
            </Link>
            <button
              type="button"
              onClick={vm.dismissNotice}
              className="cursor-pointer border-0 bg-transparent p-0 text-amber-700 hover:underline"
            >
              Ocultar
            </button>
          </div>
        </div>
      </div>
    </section>
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
                  {item.footer ? (
                    <span className="block text-[11px] text-slate-500">{item.footer}</span>
                  ) : null}
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

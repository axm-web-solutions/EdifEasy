import { Alert, Button, Card, Modal, Skeleton, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { BellRing, CalendarClock, FileText, ShieldAlert, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { DateField, NumberField, SelectField } from '@/components/forms/fields'
import { useRenewalsViewModel, type RenewalsViewModel } from '../viewmodels/useRenewalsViewModel'

const STAT_ICONS = {
  expiring: CalendarClock,
  notice: BellRing,
  increase: TrendingUp,
  policy: ShieldAlert,
} as const

function Item({ item, vm }: { item: RenewalsViewModel['items'][number]; vm: RenewalsViewModel }) {
  return (
    <Card size="small" className="surface-card" styles={{ body: { padding: 14 } }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{item.property}</span>
        {item.bucketLabel ? (
          <Tag color={item.urgency ?? undefined} bordered={false} className="!m-0">
            Vence en {item.bucketLabel}
          </Tag>
        ) : null}
        <Tag bordered={false} className="!m-0">
          {item.use}
        </Tag>
      </div>
      <p className="m-0 text-sm text-slate-700">
        {item.tenant} · {item.rent} / mes
      </p>
      <p className="m-0 mt-1 text-xs text-slate-500">{item.endLabel}</p>
      <p className={`m-0 text-xs ${item.noticeUrgent ? 'font-medium text-red-600' : 'text-slate-500'}`}>
        {item.notice}
      </p>
      <p className={`m-0 text-xs ${item.increaseDue ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
        {item.increase}
      </p>
      {item.policy ? (
        <p className={`m-0 text-xs ${item.policyExpiring ? 'font-medium text-red-600' : 'text-slate-500'}`}>
          {item.policy}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Link to={item.contractHref}>
          <Button size="small" icon={<FileText size={14} />}>
            Contrato
          </Button>
        </Link>
        {item.hasNotice ? (
          <Button size="small" onClick={() => vm.clearNotice(item.id)}>
            Quitar preaviso
          </Button>
        ) : (
          <Button size="small" icon={<BellRing size={14} />} onClick={() => vm.openNotice(item.id)}>
            Registrar preaviso
          </Button>
        )}
        {item.increaseDue ? (
          <Button
            size="small"
            type="primary"
            icon={<TrendingUp size={14} />}
            onClick={() => vm.openIncrease(item.id)}
          >
            Aplicar incremento
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

export function RenewalsPage() {
  const vm = useRenewalsViewModel()
  return (
    <div>
      <PageHeader
        title="Vencimientos"
        subtitle="Contratos por vencer, preavisos, incrementos anuales y polizas."
      />
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {vm.stats.map((stat) => {
              const Icon = STAT_ICONS[stat.key as keyof typeof STAT_ICONS]
              return (
                <button
                  key={stat.key}
                  type="button"
                  aria-pressed={vm.filter === stat.key}
                  onClick={() => vm.setFilter(stat.key)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-left transition ${
                    vm.filter === stat.key ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    {Icon ? <Icon size={18} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-slate-900">{stat.value}</span>
                    <span className="block text-xs text-slate-500">{stat.label}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {vm.items.length === 0 ? (
            <EmptyState
              title={vm.totalActive ? 'Todo al dia' : 'Aun no hay contratos vigentes'}
              description={
                vm.totalActive
                  ? 'Ningun contrato vence en los proximos 90 dias ni tiene pendientes.'
                  : 'Cuando tengas contratos, aqui veras sus vencimientos.'
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {vm.items.map((item) => (
                <Item key={item.id} item={item} vm={vm} />
              ))}
            </div>
          )}

          {vm.history.length ? (
            <section>
              <h3 className="m-0 mb-2 text-sm font-semibold text-slate-600">Ultimos ajustes</h3>
              <ul className="m-0 list-none space-y-1 p-0">
                {vm.history.map((row) => (
                  <li key={row.id} className="text-sm text-slate-700">
                    {row.label} <span className="text-xs text-slate-500">· {row.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <Modal
        open={vm.increaseOpen}
        title={vm.increaseTitle}
        okText="Aplicar incremento"
        cancelText="Volver"
        onOk={vm.submitIncrease}
        onCancel={vm.closeIncrease}
        confirmLoading={vm.applying}
        destroyOnHidden
      >
        <Alert type="info" showIcon message={vm.increaseRule} className="!mb-4" />
        {vm.increaseError ? (
          <Alert type="error" showIcon message={vm.increaseError} className="!mb-4" />
        ) : null}
        <form onSubmit={vm.submitIncrease} noValidate>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <NumberField
              control={vm.increaseControl}
              name="index_pct"
              label="IPC del ano anterior (%)"
              required
              min={0}
              max={30}
              step={0.01}
            />
            <DateField
              control={vm.increaseControl}
              name="effective_date"
              label="Desde"
              required
            />
          </div>
        </form>
        {vm.preview ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Canon actual</span>
              <span>{vm.preview.current}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900">
              <span>Nuevo canon ({vm.preview.pct})</span>
              <span>{vm.preview.next}</span>
            </div>
            {vm.preview.capped ? (
              <p className="m-0 mt-1 text-xs text-amber-700">
                Limitado al IPC por ser vivienda.
              </p>
            ) : null}
            <p className="m-0 mt-1 text-xs text-slate-500">
              Los cobros pendientes desde esa fecha toman el canon nuevo y se le avisa al
              arrendatario.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={vm.noticeOpen}
        title="Registrar preaviso"
        okText="Registrar"
        cancelText="Volver"
        onOk={vm.submitNotice}
        onCancel={vm.closeNotice}
        confirmLoading={vm.savingNotice}
        destroyOnHidden
      >
        <p className="text-sm text-slate-600">
          Deja constancia del aviso escrito de terminacion o no renovacion. Guarda la carta en los
          documentos del contrato.
        </p>
        <form onSubmit={vm.submitNotice} noValidate>
          <DateField
            control={vm.noticeControl}
            name="notice_given_at"
            label="Fecha del aviso"
            required
          />
          <SelectField
            control={vm.noticeControl}
            name="notice_by"
            label="Quien avisa"
            options={vm.noticeByOptions}
          />
        </form>
      </Modal>
    </div>
  )
}

import { Button, Card, Select, Skeleton, Tabs, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ConnectionsPanel } from '../components/ConnectionsPanel'
import { ReportsPanel } from '../components/ReportsPanel'
import { TaxObligationsPanel } from '../components/TaxObligationsPanel'
import { Kpi } from '../components/ReportContent'
import { useFinancesViewModel, type FinancesViewModel } from '../viewmodels/useFinancesViewModel'

function AccountTab({ vm }: { vm: FinancesViewModel }) {
  if (vm.accountLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (vm.accountError) return <ErrorState onRetry={vm.retryAccount} />
  if (!vm.statement) return <EmptyState title="Sin estado de cuenta" description={vm.emptyHint} />
  const s = vm.statement
  return (
    <div className="space-y-4">
      {vm.seesAllUnits || vm.unitOptions.length > 1 ? (
        <Select
          className="w-full sm:w-72"
          showSearch
          optionFilterProp="label"
          value={vm.unitId ?? undefined}
          onChange={(value: string) => vm.setUnitId(value)}
          options={vm.unitOptions}
          aria-label="Unidad"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-slate-800">{s.unit}</span>
        <Tag color={s.statusColor} bordered={false} className="!m-0">
          {s.statusLabel}
        </Tag>
        <span className="text-xs text-slate-500">{s.updatedLabel}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Saldo total" value={s.balance} />
        <Kpi label="Vencido" value={s.overdue} tone={s.inArrears ? 'danger' : 'ok'} />
        <Kpi label="Intereses de mora" value={s.interest} />
        <Kpi label="Ultimo pago" value={s.lastPayment} />
      </div>
      {s.inArrears && !vm.seesAllUnits ? (
        <Link to="/admin-fees">
          <Button type="primary">Pagar en linea</Button>
        </Link>
      ) : null}
      <Card className="surface-card" title="Movimientos" styles={{ body: { padding: 0 } }}>
        {vm.movementsLoading ? (
          <Skeleton active className="p-4" />
        ) : vm.movements.length === 0 ? (
          <p className="m-0 p-4 text-sm text-slate-500">Sin movimientos cargados.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.movements.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm text-slate-800">{m.concept}</p>
                  <p className="m-0 text-xs text-slate-500">
                    {m.date}
                    {m.document ? ` · ${m.document}` : ''}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  {m.debit ? <p className="m-0 text-slate-800">{m.debit}</p> : null}
                  {m.credit ? <p className="m-0 text-emerald-700">−{m.credit}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function FinancesPage() {
  const vm = useFinancesViewModel()

  return (
    <div>
      <PageHeader
        title="Finanzas del conjunto"
        subtitle={
          vm.canManage
            ? 'Publica los reportes del contador, lleva las obligaciones fiscales y carga la contabilidad.'
            : 'Los informes del contador y tu estado de cuenta, siempre al dia.'
        }
        dataTour="finances-header"
      />
      <Tabs
        activeKey={vm.tab}
        onChange={vm.setTab}
        items={vm.tabs.map((tab) => ({ key: tab.key, label: tab.label }))}
      />
      {vm.tab === 'reportes' ? <ReportsPanel canManage={vm.canManage} /> : null}
      {vm.tab === 'cuenta' ? <AccountTab vm={vm} /> : null}
      {vm.tab === 'fiscal' ? <TaxObligationsPanel canManage={vm.canManage} /> : null}
      {vm.tab === 'carga' ? <ConnectionsPanel /> : null}
    </div>
  )
}

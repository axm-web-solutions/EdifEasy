import { Alert, Button, Card, Checkbox, Dropdown, Segmented, Select, Skeleton, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { Ban, Banknote, CalendarPlus, MoreVertical } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useChargesViewModel, type ChargeFilter } from '../viewmodels/useChargesViewModel'

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card size="small" className="surface-card">
      <p className="m-0 text-xs text-slate-500">{label}</p>
      <p
        className={`m-0 text-lg font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-slate-800'}`}
      >
        {value}
      </p>
    </Card>
  )
}

export function ChargesPage() {
  const vm = useChargesViewModel()

  return (
    <div>
      <PageHeader
        title="Cobros y pagos"
        subtitle="Canon y administracion de cada contrato, mes a mes."
        dataTour="agency-charges"
      />

      {!vm.hasOnlinePayments ? (
        <Alert
          className="!mb-4"
          type="info"
          showIcon
          message="Conecta tu cuenta Wompi para que los arrendatarios paguen en linea"
          description={<Link to="/agency/store">Ir a Tienda y pagos en linea</Link>}
        />
      ) : null}

      <Card size="small" className="surface-card !mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-sm text-slate-700">Generar cobros de</span>
          <Select
            className="w-full capitalize sm:w-56"
            value={vm.period}
            onChange={vm.setPeriod}
            options={vm.periodOptions}
          />
          <Button
            type="primary"
            icon={<CalendarPlus size={16} />}
            loading={vm.generating}
            onClick={vm.generate}
          >
            Generar y avisar
          </Button>
        </div>
        <p className="m-0 mt-2 text-xs text-slate-500">
          Crea el canon y la administracion de cada contrato vigente y avisa a los arrendatarios. Si
          ya existen, no se duplican.
        </p>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Kpi
          label={`Pendiente por cobrar (${vm.summary.pendingCount})`}
          value={vm.summary.pendingTotal}
        />
        <Kpi
          label={`Vencido (${vm.summary.overdueCount})`}
          value={vm.summary.overdueTotal}
          tone={vm.summary.overdueCount ? 'danger' : undefined}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={vm.filter}
            onChange={(value) => vm.setFilter(value as ChargeFilter)}
            options={vm.filterOptions}
          />
        </div>
        {vm.selected.length ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'cash',
                  label: 'Recibido en efectivo',
                  onClick: () => vm.registerPayment('CASH'),
                },
                {
                  key: 'transfer',
                  label: 'Recibido por transferencia',
                  onClick: () => vm.registerPayment('TRANSFER'),
                },
              ],
            }}
          >
            <Button type="primary" icon={<Banknote size={16} />} loading={vm.registering}>
              Registrar pago ({vm.selected.length})
            </Button>
          </Dropdown>
        ) : null}
      </div>

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.charges.length === 0 ? (
        <EmptyState
          title={vm.filter === 'pending' ? 'No hay cobros pendientes' : 'Sin cobros'}
          description="Genera los cobros del mes para los contratos vigentes."
        />
      ) : (
        <Card className="surface-card" styles={{ body: { padding: 0 } }}>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.charges.map((charge) => (
              <li
                key={charge.id}
                className={`flex items-start gap-3 px-4 py-3 ${charge.isOverdue ? 'bg-red-50/60' : ''}`}
              >
                {charge.isPending ? (
                  <Checkbox
                    className="pt-0.5"
                    checked={vm.selected.includes(charge.id)}
                    onChange={() => vm.toggle(charge.id)}
                    aria-label={`Seleccionar ${charge.concept} de ${charge.property}`}
                  />
                ) : (
                  <span className="w-4" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{charge.property}</span>
                    <Tag color={charge.statusColor} bordered={false} className="!m-0">
                      {charge.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs capitalize text-slate-600">
                    {charge.concept} · {charge.periodLabel}
                  </p>
                  <p className="m-0 text-xs text-slate-500">
                    {charge.tenant}
                    {charge.phone ? ` · ${charge.phone}` : ''} · vence {charge.dueLabel}
                  </p>
                  {charge.paidLabel ? (
                    <p className="m-0 text-xs text-emerald-700">{charge.paidLabel}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {charge.amountLabel}
                </span>
                {charge.isPending ? (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'void',
                          label: 'Anular cobro',
                          danger: true,
                          icon: <Ban size={14} />,
                          onClick: async () => {
                            if (await confirmDelete({ title: 'Anular cobro', okText: 'Anular' }))
                              vm.voidCharge(charge.id)
                          },
                        },
                      ],
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreVertical size={16} />}
                      aria-label="Opciones del cobro"
                    />
                  </Dropdown>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

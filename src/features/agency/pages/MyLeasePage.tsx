import { Alert, Button, Card, Checkbox, Skeleton, Tag } from 'antd'
import { CreditCard, Home } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PendingSignatures } from '../components/PendingSignatures'
import { EmptyState } from '@/components/ui/states'
import { useMyLeaseViewModel } from '../viewmodels/useMyLeaseViewModel'

export function MyLeasePage() {
  const vm = useMyLeaseViewModel()

  return (
    <div>
      <PageHeader
        title="Mi arriendo"
        subtitle="Tu contrato y tus pagos, en un solo lugar."
        dataTour="agency-my-lease"
      />
      <PendingSignatures />
      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !vm.hasLease ? (
        <EmptyState
          title="Aun no tienes un contrato vigente"
          description="Cuando la inmobiliaria registre tu contrato, aqui veras tus pagos."
        />
      ) : (
        <div className="space-y-4">
          <Card className="surface-card overflow-hidden" styles={{ body: { padding: 0 } }}>
            <div className="flex flex-col sm:flex-row">
              <div className="aspect-[4/3] w-full shrink-0 bg-slate-100 sm:w-56">
                {vm.property?.cover ? (
                  <img src={vm.property.cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-slate-400">
                    <Home size={32} />
                  </span>
                )}
              </div>
              <div className="space-y-1 p-4">
                <p className="m-0 text-base font-semibold text-slate-900">{vm.property?.title}</p>
                {vm.property?.address ? (
                  <p className="m-0 text-sm text-slate-600">{vm.property.address}</p>
                ) : null}
                {vm.property?.specs.length ? (
                  <p className="m-0 text-xs text-slate-500">{vm.property.specs.join(' · ')}</p>
                ) : null}
                <p className="m-0 pt-1 text-sm text-slate-800">
                  Canon {vm.lease?.rent}
                  {vm.lease?.adminFee ? ` + administracion ${vm.lease.adminFee}` : ''} · pagas los{' '}
                  {vm.lease?.dueDay} de cada mes
                </p>
                <p className="m-0 text-xs text-slate-500">{vm.lease?.period}</p>
              </div>
            </div>
          </Card>

          <Card className="surface-card" title="Por pagar">
            {vm.pending.length === 0 ? (
              <p className="m-0 text-sm text-emerald-700">Estas al dia. ¡Gracias!</p>
            ) : (
              <>
                <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                  {vm.pending.map((charge) => (
                    <li key={charge.id} className="flex items-center gap-3 py-2.5">
                      <Checkbox
                        checked={vm.chosen.includes(charge.id)}
                        onChange={() => vm.toggle(charge.id)}
                        aria-label={charge.concept}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm text-slate-800">{charge.concept}</p>
                        <p className="m-0 text-xs capitalize text-slate-500">
                          {charge.periodLabel} · vence {charge.dueLabel}
                        </p>
                      </div>
                      {charge.isOverdue ? (
                        <Tag color="red" bordered={false} className="!m-0">
                          Vencido
                        </Tag>
                      ) : null}
                      <span className="text-sm font-semibold tabular-nums">
                        {charge.amountLabel}
                      </span>
                    </li>
                  ))}
                </ul>
                {vm.payError ? (
                  <Alert type="error" showIcon message={vm.payError} className="!mt-3" />
                ) : null}
                <Button
                  type="primary"
                  size="large"
                  block
                  className="!mt-3"
                  icon={<CreditCard size={18} />}
                  disabled={vm.chosen.length === 0}
                  loading={vm.paying}
                  onClick={vm.pay}
                >
                  Pagar {vm.totalLabel} en linea
                </Button>
                <p className="m-0 mt-2 text-center text-xs text-slate-500">
                  Pago seguro con Wompi: tarjeta, PSE, Nequi o Bancolombia. El dinero llega directo
                  a la inmobiliaria.
                </p>
              </>
            )}
          </Card>

          {vm.history.length ? (
            <Card className="surface-card" title="Historial" styles={{ body: { padding: 0 } }}>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                {vm.history.map((charge) => (
                  <li key={charge.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm text-slate-800">{charge.concept}</p>
                      <p className="m-0 text-xs capitalize text-slate-500">
                        {charge.periodLabel}
                        {charge.paidLabel ? ` · ${charge.paidLabel}` : ''}
                      </p>
                    </div>
                    <Tag color={charge.statusColor} bordered={false} className="!m-0">
                      {charge.statusLabel}
                    </Tag>
                    <span className="text-sm tabular-nums text-slate-700">
                      {charge.amountLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}

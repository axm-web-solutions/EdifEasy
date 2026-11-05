import { Button, Card, Modal, Skeleton, Tag } from 'antd'
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { PendingSignatures } from '../components/PendingSignatures'
import { useOwnerStatementsViewModel } from '../viewmodels/useOwnerStatementsViewModel'

/** Propietario: /agency/statements */
export function OwnerStatementsPage() {
  const vm = useOwnerStatementsViewModel()
  return (
    <div>
      <PageHeader
        title="Mis liquidaciones"
        subtitle={`Lo que la inmobiliaria cobro por ti y lo que te giro. Este ano: ${vm.paidThisYear}`}
      />
      <PendingSignatures />

      {vm.pendingExpenses.length ? (
        <Card size="small" className="surface-card !mb-4" title="Gastos por aprobar">
          <ul className="m-0 list-none space-y-3 p-0">
            {vm.pendingExpenses.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Wrench size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-slate-900">{item.description}</p>
                  <p className="m-0 text-xs text-slate-500">
                    {item.property} · {item.date} · {item.amount}
                  </p>
                </div>
                <Button
                  size="small"
                  type="primary"
                  loading={vm.approving}
                  onClick={() =>
                    Modal.confirm({
                      title: 'Aprobar gasto',
                      content: `${item.description}: ${item.amount}. Se descontara de tu proxima liquidacion.`,
                      okText: 'Aprobar',
                      cancelText: 'Volver',
                      onOk: () => vm.approveExpense(item.id),
                    })
                  }
                >
                  Aprobar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.statements.length === 0 ? (
        <EmptyState
          title="Aun no tienes liquidaciones"
          description="Cada mes la inmobiliaria liquida el canon cobrado y te gira el neto."
        />
      ) : (
        <div className="space-y-3">
          {vm.statements.map((item) => (
            <Card key={item.id} size="small" className="surface-card" styles={{ body: { padding: 14 } }}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
                aria-expanded={item.open}
                onClick={() => vm.toggle(item.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-slate-900">
                      {item.title}
                    </span>
                    <Tag color={item.statusColor} bordered={false} className="!m-0">
                      {item.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs text-slate-500">{item.paid}</p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-xs text-slate-500">Neto</p>
                  <p className="m-0 text-base font-semibold text-slate-900">{item.net}</p>
                </div>
                {item.open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {item.open ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {vm.linesLoading ? (
                    <Skeleton active paragraph={{ rows: 3 }} title={false} />
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {vm.lines.map((line) => (
                          <tr key={line.id} className="border-b border-slate-50">
                            <td className="py-1.5 pr-2 text-slate-700">{line.description}</td>
                            <td className="py-1.5 text-right text-slate-800">{line.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

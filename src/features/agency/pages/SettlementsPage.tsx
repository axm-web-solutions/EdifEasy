import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CheckCircle2,
  Eye,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
} from '@/components/forms/fields'
import {
  useSettlementsViewModel,
  type SettlementsViewModel,
} from '../viewmodels/useSettlementsViewModel'

function SettlementList({ vm }: { vm: SettlementsViewModel }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-48"
          value={vm.period}
          onChange={vm.setPeriod}
          options={vm.periodOptions}
          aria-label="Mes a liquidar"
        />
        <Button
          type="primary"
          icon={<RefreshCw size={16} />}
          loading={vm.generating}
          onClick={vm.generate}
          disabled={!vm.hasAgreements}
        >
          Generar liquidaciones
        </Button>
      </div>
      {!vm.hasAgreements ? (
        <Alert
          type="info"
          showIcon
          message="Primero registra los mandatos"
          description={
            <span>
              Las liquidaciones salen del mandato de cada propiedad (comision y cuenta del dueno).{' '}
              <Link to="/agency/agreements">Ir a Propietarios</Link>
            </span>
          }
        />
      ) : null}
      {vm.actionError ? <Alert type="error" showIcon message={vm.actionError} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {vm.totals.map((total) => (
          <Card key={total.label} size="small" className="surface-card">
            <p className="m-0 text-xs text-slate-500">{total.label}</p>
            <p className="m-0 text-lg font-semibold text-slate-900">{total.value}</p>
          </Card>
        ))}
      </div>

      {vm.settlements.length === 0 ? (
        <EmptyState
          title={`Sin liquidaciones de ${vm.periodName}`}
          description="Genera las del mes: se toma el canon pagado y aun no liquidado de cada propiedad con mandato."
        />
      ) : (
        <div className="space-y-3">
          {vm.settlements.map((item) => (
            <Card
              key={item.id}
              size="small"
              className="surface-card"
              styles={{ body: { padding: 14 } }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{item.owner}</span>
                    <Tag color={item.statusColor} bordered={false} className="!m-0">
                      {item.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs text-slate-500">{item.property}</p>
                  {item.paidLabel ? (
                    <p className="m-0 text-xs text-emerald-700">{item.paidLabel}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-xs md:w-80">
                  <div>
                    <p className="m-0 text-slate-500">Cobrado</p>
                    <p className="m-0 font-medium text-slate-800">{item.gross}</p>
                  </div>
                  <div>
                    <p className="m-0 text-slate-500">Descuentos</p>
                    <p className="m-0 font-medium text-slate-800">- {item.deductions}</p>
                  </div>
                  <div>
                    <p className="m-0 text-slate-500">Neto</p>
                    <p className="m-0 font-semibold text-slate-900">{item.net}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button size="small" icon={<Eye size={14} />} onClick={() => vm.openDetail(item.id)}>
                  Ver detalle
                </Button>
                {item.canRegenerate ? (
                  <Button
                    size="small"
                    icon={<RefreshCw size={14} />}
                    disabled={vm.busy}
                    onClick={() => vm.regenerate(item.agreementId)}
                  >
                    Recalcular
                  </Button>
                ) : null}
                {item.canApprove ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircle2 size={14} />}
                    disabled={vm.busy}
                    onClick={() => vm.approve(item.id)}
                  >
                    Aprobar
                  </Button>
                ) : null}
                {item.canPay ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<Banknote size={14} />}
                    onClick={() => vm.openPay(item.id)}
                  >
                    Registrar giro
                  </Button>
                ) : null}
                {item.canVoid ? (
                  <Button
                    size="small"
                    danger
                    icon={<XCircle size={14} />}
                    onClick={() =>
                      Modal.confirm({
                        title: 'Anular liquidacion',
                        content:
                          'Los pagos y gastos vuelven a quedar libres para la proxima liquidacion.',
                        okText: 'Anular',
                        okButtonProps: { danger: true },
                        cancelText: 'Volver',
                        onOk: () => vm.voidSettlement(item.id),
                      })
                    }
                  >
                    Anular
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpenseList({ vm }: { vm: SettlementsViewModel }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-slate-600">
          Reparaciones y gastos que pagaste por el propietario. Se descuentan en su liquidacion
          cuando estan aprobados.
        </p>
        <Button icon={<Plus size={16} />} onClick={vm.openExpense} disabled={!vm.hasAgreements}>
          Registrar gasto
        </Button>
      </div>
      {vm.expenses.length === 0 ? (
        <EmptyState title="Sin gastos" description="Aqui veras los gastos de cada propiedad." />
      ) : (
        vm.expenses.map((item) => (
          <Card key={item.id} size="small" className="surface-card" styles={{ body: { padding: 12 } }}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Wrench size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-slate-900">{item.description}</p>
                <p className="m-0 text-xs text-slate-500">
                  {item.property} · {item.date}
                </p>
                <Tag color={item.statusColor} bordered={false} className="!m-0 !mt-1">
                  {item.statusLabel}
                </Tag>
              </div>
              <div className="text-right">
                <p className="m-0 text-sm font-semibold text-slate-900">{item.amount}</p>
                <div className="mt-1 flex justify-end gap-1">
                  {item.canApprove ? (
                    <Button size="small" onClick={() => vm.approveExpense(item.id)}>
                      Aprobar
                    </Button>
                  ) : null}
                  {item.canRemove ? (
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<Trash2 size={14} />}
                      aria-label="Eliminar gasto"
                      onClick={() => vm.removeExpense(item.id)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function SettlementDetail({ vm }: { vm: SettlementsViewModel }) {
  const detail = vm.detail
  return (
    <Drawer
      open={vm.detailOpen}
      onClose={vm.closeDetail}
      width={520}
      title="Detalle de la liquidacion"
      extra={
        <Button icon={<Printer size={16} />} onClick={vm.print}>
          Imprimir
        </Button>
      }
    >
      {vm.linesLoading || !detail ? (
        <Skeleton active />
      ) : (
        <div className="print-area space-y-4">
          <div>
            <p className="m-0 text-xs text-slate-500">{detail.agency}</p>
            <h3 className="m-0 text-lg font-semibold text-slate-900">{detail.title}</h3>
            <p className="m-0 text-sm text-slate-700">
              {detail.owner} · {detail.property}
            </p>
            <p className="m-0 text-xs text-slate-500">
              {detail.statusLabel} · generada {detail.generated}
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-700">{line.description}</td>
                  <td
                    className={`py-2 text-right ${line.negative ? 'text-slate-600' : 'text-slate-900'}`}
                  >
                    {line.amount}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-3 font-semibold text-slate-900">Neto a girar</td>
                <td className="pt-3 text-right text-base font-semibold text-slate-900">
                  {detail.net}
                </td>
              </tr>
            </tbody>
          </table>
          {detail.bank ? (
            <p className="m-0 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              Cuenta: {detail.bank}
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  )
}

export function SettlementsPage() {
  const vm = useSettlementsViewModel()
  return (
    <div>
      <PageHeader
        title="Liquidaciones"
        subtitle="Lo que cobraste, tu comision y lo que le giras a cada propietario."
      />
      <Segmented
        className="!mb-4"
        value={vm.tab}
        onChange={(value) => vm.setTab(value as 'settlements' | 'expenses')}
        options={[
          { value: 'settlements', label: 'Liquidaciones' },
          { value: 'expenses', label: 'Gastos' },
        ]}
      />
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.tab === 'settlements' ? (
        <SettlementList vm={vm} />
      ) : (
        <ExpenseList vm={vm} />
      )}

      <SettlementDetail vm={vm} />

      <Modal
        open={Boolean(vm.payingId)}
        title="Registrar giro al propietario"
        okText="Registrar"
        cancelText="Volver"
        onOk={vm.confirmPay}
        onCancel={vm.closePay}
        confirmLoading={vm.busy}
      >
        <p className="text-sm text-slate-600">
          Despues de hacer la transferencia, escribe la referencia para dejar constancia. Le avisamos
          al propietario.
        </p>
        <Input
          value={vm.reference}
          onChange={(event) => vm.setReference(event.target.value)}
          placeholder="Referencia de la transferencia"
          maxLength={60}
          aria-label="Referencia de la transferencia"
        />
      </Modal>

      <FormDrawer
        open={vm.expenseOpen}
        title="Registrar gasto"
        description="Se descuenta en la liquidacion del propietario cuando lo aprueba."
        onClose={vm.closeExpense}
        onSubmit={vm.submitExpense}
        submitting={vm.savingExpense}
      >
        <form onSubmit={vm.submitExpense} noValidate>
          {vm.expenseError ? (
            <Alert type="error" showIcon message={vm.expenseError} className="!mb-4" />
          ) : null}
          <SelectField
            control={vm.expenseControl}
            name="property_id"
            label="Propiedad"
            required
            options={vm.propertyOptions}
          />
          <TextField
            control={vm.expenseControl}
            name="description"
            label="Descripcion"
            required
            placeholder="Ej: Cambio de calentador"
          />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <NumberField
              control={vm.expenseControl}
              name="amount"
              label="Valor"
              required
              min={0}
              addonBefore="$"
            />
            <DateField control={vm.expenseControl} name="expense_date" label="Fecha" required />
          </div>
          <SwitchField
            control={vm.expenseControl}
            name="approved"
            label="El propietario ya lo autorizo"
            help="Si no, el propietario lo aprueba desde su app."
          />
        </form>
      </FormDrawer>
    </div>
  )
}

import { Button, Col, DatePicker, InputNumber, Row, Space, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Ban,
  Banknote,
  CalendarPlus,
  CircleDollarSign,
  Clock,
  CreditCard,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { AmountList, AmountListItem } from '@/components/ui/AmountListItem'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states'
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import type { AdminFeeWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import {
  useAdminFeesManagerViewModel,
  useAdminFeesMode,
  useMyAdminFeesViewModel,
  type AdminFeesManagerViewModel,
} from '../viewmodels/useAdminFeesViewModel'
import { feeStatus, formatPeriod, paymentMethodLabel } from '../viewmodels/adminFees.logic'

function StatusTag({ status }: { status: { label: string; color: string } }) {
  return (
    <Tag color={status.color} bordered={false}>
      {status.label}
    </Tag>
  )
}

/**
 * Cuotas de administracion. La administracion genera y controla las cuotas;
 * el propietario paga las de sus apartamentos en linea con Wompi.
 */
export function AdminFeesPage() {
  const { loading, mode } = useAdminFeesMode()
  if (loading) return <PageSkeleton />
  return mode === 'manager' ? <AdminFeesManager /> : <MyAdminFees />
}

// ---------------------------------------------------------------------------
// Vista de la administracion
// ---------------------------------------------------------------------------
const EXPORT_COLUMNS: ExportColumn<AdminFeeWithRelations>[] = [
  { key: 'apartment', header: 'Apartamento', value: (row) => row.apartment?.number ?? '' },
  { key: 'period', header: 'Mes', value: (row) => formatPeriod(row.period) },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'due', header: 'Vence', value: (row) => formatDate(row.due_date) },
  { key: 'status', header: 'Estado', value: (row) => feeStatus(row).label },
  {
    key: 'paid',
    header: 'Pagada el',
    value: (row) => (row.paid_at ? formatDateTime(row.paid_at) : ''),
  },
  { key: 'method', header: 'Medio', value: (row) => paymentMethodLabel(row.payment_method) },
]

function managerColumns(vm: AdminFeesManagerViewModel): ColumnsType<AdminFeeWithRelations> {
  return [
    {
      title: 'Apartamento',
      key: 'apartment',
      fixed: 'left',
      width: 200,
      render: (_, row) => (
        <span className="font-medium text-slate-800">{vm.row.describe(row).apartment}</span>
      ),
    },
    {
      title: 'Mes',
      dataIndex: 'period',
      key: 'period',
      sorter: true,
      width: 160,
      render: (_, row) => <span className="capitalize">{vm.row.describe(row).period}</span>,
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
    },
    {
      title: 'Vence',
      dataIndex: 'due_date',
      key: 'due_date',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (_, row) => <StatusTag status={vm.row.describe(row).status} />,
    },
    {
      title: 'Pago',
      key: 'payment',
      width: 200,
      render: (_, row) =>
        row.paid_at ? (
          <div>
            <div className="text-xs text-slate-700">{formatDateTime(row.paid_at)}</div>
            <div className="text-xs text-slate-500">{vm.row.describe(row).paymentMethod}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) =>
        vm.row.canSettle(row) ? (
          <Space size={4}>
            <Tooltip title="Registrar pago en efectivo o consignacion">
              <Button
                size="small"
                icon={<Banknote size={14} />}
                aria-label="Registrar pago"
                onClick={() => void vm.actions.registerCash(row)}
              />
            </Tooltip>
            <Tooltip title="Anular cuota">
              <Button
                size="small"
                danger
                icon={<Ban size={14} />}
                aria-label="Anular cuota"
                onClick={() => void vm.actions.cancel(row)}
              />
            </Tooltip>
          </Space>
        ) : null,
    },
  ]
}

function AdminFeesManager() {
  const vm = useAdminFeesManagerViewModel()
  const { stats, generator, table } = vm

  return (
    <>
      <PageHeader
        title="Cuotas de administracion"
        subtitle="Define el valor mensual, genera las cuotas y controla quien ha pagado."
        dataTour="page-header"
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={8}>
          <StatCard
            title="Recaudado"
            value={formatCompactCurrency(stats.paidAmount)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
            loading={stats.loading}
            hint="Total de las cuotas que cumplen los filtros aplicados"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Pendiente por cobrar"
            value={formatCompactCurrency(stats.pendingAmount)}
            icon={<Wallet size={20} />}
            tone="orange"
            loading={stats.loading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Cuotas vencidas"
            value={stats.overdueCount}
            icon={<Clock size={20} />}
            tone="red"
            loading={stats.loading}
            footer={`${formatCompactCurrency(stats.overdueAmount)} en mora`}
          />
        </Col>
      </Row>

      <SectionCard title="Generar cuotas del mes" className="mb-4">
        <p className="m-0 mb-4 text-sm text-slate-500">
          Se crea una cuota por cada apartamento con propietario activo. Todos pagan el mismo valor.
          Si el mes ya tiene cuotas generadas, no se duplican.
        </p>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Valor mensual por apartamento</span>
            <InputNumber<number>
              className="!w-full"
              min={1000}
              step={10000}
              value={generator.amount}
              onChange={generator.setAmount}
              prefix="$"
              formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value) => Number((value ?? '').replace(/\./g, ''))}
              placeholder="350.000"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Mes a cobrar</span>
            <DatePicker
              picker="month"
              className="!w-full"
              value={generator.period}
              allowClear={false}
              format="MMMM YYYY"
              onChange={(value) => value && generator.setPeriod(value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Fecha limite de pago</span>
            <DatePicker
              className="!w-full"
              value={generator.dueDate}
              allowClear={false}
              format="DD/MM/YYYY"
              disabledDate={generator.isDueDateDisabled}
              onChange={(value) => value && generator.setDueDate(value)}
            />
          </label>
          <Button
            type="primary"
            icon={<CalendarPlus size={16} />}
            disabled={!generator.canSubmit}
            loading={generator.submitting}
            onClick={generator.submit}
          >
            Generar cuotas
          </Button>
        </div>
      </SectionCard>

      <DataTable<AdminFeeWithRelations>
        columns={managerColumns(vm)}
        data={table.rows}
        total={table.total}
        loading={table.loading}
        isError={table.isError}
        errorMessage={table.errorMessage}
        onRetry={table.retry}
        params={table.params}
        onPageChange={table.handlers.setPage}
        onSearch={table.handlers.setSearch}
        onSort={table.handlers.setSort}
        onFilter={table.handlers.setFilter}
        onDateRange={table.handlers.setDateRange}
        onReset={table.handlers.reset}
        hasActiveFilters={table.hasActiveFilters}
        showDateFilter
        filters={table.filters}
        searchPlaceholder="Buscar en notas"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="cuotas-administracion"
        exportFetcher={table.exportFetcher}
        emptyTitle="Aun no hay cuotas generadas"
        scrollX={1050}
        dataTour="fees-list"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Vista del propietario
// ---------------------------------------------------------------------------
function MyAdminFees() {
  const vm = useMyAdminFeesViewModel()

  if (vm.loading) return <PageSkeleton />

  return (
    <>
      <PageHeader
        title="Pagar administracion"
        subtitle="Paga en linea la cuota de administracion de tus apartamentos."
        dataTour="page-header"
      />

      {vm.error ? (
        <ErrorState
          title="No se pudieron cargar tus cuotas"
          description={vm.error}
          onRetry={vm.retry}
        />
      ) : null}

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12}>
          <StatCard
            title="Por pagar"
            value={formatCurrency(vm.totals.pendingAmount)}
            icon={<Wallet size={20} />}
            tone={vm.totals.pendingAmount > 0 ? 'orange' : 'green'}
            footer={`${vm.totals.pendingCount} cuota(s) pendiente(s)`}
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatCard
            title={`Pagado en ${vm.year}`}
            value={formatCurrency(vm.totals.paidThisYear)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
          />
        </Col>
      </Row>

      <SectionCard title="Cuotas pendientes" className="mb-4" dataTour="fees-list">
        {vm.pending.length === 0 ? (
          <EmptyState title="Estas al dia" description="No tienes cuotas pendientes." />
        ) : (
          <AmountList>
            {vm.pending.map((item) => (
              <AmountListItem
                key={item.fee.id}
                title={<span className="capitalize">{item.period}</span>}
                description={`${item.apartment} · Vence el ${formatDate(item.fee.due_date)}`}
                status={<StatusTag status={item.status} />}
                amount={item.amount}
                action={
                  <Button
                    type="primary"
                    icon={<CreditCard size={16} />}
                    loading={vm.isPaying(item.fee)}
                    disabled={vm.paying}
                    onClick={() => vm.pay(item.fee)}
                  >
                    Pagar
                  </Button>
                }
              />
            ))}
          </AmountList>
        )}
        <p className="m-0 mt-3 text-xs text-slate-500">
          Seras redirigido a Wompi para pagar con PSE, tarjeta, Nequi o Boton Bancolombia.
        </p>
      </SectionCard>

      <SectionCard title="Historial de pagos">
        {vm.paid.length === 0 ? (
          <EmptyState
            title="Sin pagos registrados"
            description="Aqui veras las cuotas que ya pagaste."
          />
        ) : (
          <AmountList>
            {vm.paid.map((item) => (
              <AmountListItem
                key={item.fee.id}
                title={<span className="capitalize">{item.period}</span>}
                description={`${item.apartment} · Pagada el ${item.fee.paid_at ? formatDateTime(item.fee.paid_at) : '—'}${
                  item.paymentMethod ? ` · ${item.paymentMethod}` : ''
                }`}
                status={<StatusTag status={item.status} />}
                amount={item.amount}
              />
            ))}
          </AmountList>
        )}
      </SectionCard>
    </>
  )
}

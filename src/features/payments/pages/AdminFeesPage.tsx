import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  InputNumber,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
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
import { confirmDelete } from '@/components/ui/FormDrawer'
import { PageSkeleton } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useTableParams } from '@/hooks/useTableParams'
import { useCondominium } from '@/hooks/useCondominiums'
import {
  useAdminFeeMutations,
  useAdminFees,
  useCheckout,
  useMyAdminFees,
} from '@/hooks/usePayments'
import { ADMIN_FEE_STATUS, toOptions } from '@/constants/enums'
import { paymentService } from '@/services/paymentService'
import { readSetting } from '@/utils/brand'
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { AdminFeeWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  WOMPI: 'En linea (Wompi)',
  CASH: 'Efectivo / consignacion',
}

/** "2026-10-01" -> "octubre de 2026" */
export function formatPeriod(period: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}T00:00:00Z`))
}

function isOverdue(fee: Pick<AdminFeeWithRelations, 'status' | 'due_date'>) {
  return fee.status === 'PENDING' && dayjs(fee.due_date).isBefore(dayjs(), 'day')
}

function apartmentLabel(fee: AdminFeeWithRelations) {
  if (!fee.apartment) return '—'
  return `${fee.apartment.building?.name ? `${fee.apartment.building.name} · ` : ''}Apto ${fee.apartment.number}`
}

function FeeStatusTag({ fee }: { fee: AdminFeeWithRelations }) {
  if (isOverdue(fee)) {
    return (
      <Tag color="red" bordered={false}>
        Vencida
      </Tag>
    )
  }
  return (
    <Tag color={ADMIN_FEE_STATUS[fee.status].color} bordered={false}>
      {ADMIN_FEE_STATUS[fee.status].label}
    </Tag>
  )
}

/**
 * Cuotas de administracion. El administrador define el valor mensual (igual
 * para todos los apartamentos), genera las cuotas y registra pagos en efectivo;
 * el propietario paga las de sus apartamentos en linea con Wompi.
 */
export function AdminFeesPage() {
  const { hasPermission, loadingContext } = useAuth()
  if (loadingContext) return <PageSkeleton />
  return hasPermission('manageFinance') ? <AdminFeesManager /> : <MyAdminFees />
}

// ---------------------------------------------------------------------------
// Vista del administrador
// ---------------------------------------------------------------------------
const EXPORT_COLUMNS: ExportColumn<AdminFeeWithRelations>[] = [
  { key: 'apartment', header: 'Apartamento', value: (row) => apartmentLabel(row) },
  { key: 'period', header: 'Mes', value: (row) => formatPeriod(row.period) },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'due', header: 'Vence', value: (row) => formatDate(row.due_date) },
  {
    key: 'status',
    header: 'Estado',
    value: (row) => (isOverdue(row) ? 'Vencida' : ADMIN_FEE_STATUS[row.status].label),
  },
  {
    key: 'paid',
    header: 'Pagada el',
    value: (row) => (row.paid_at ? formatDateTime(row.paid_at) : ''),
  },
  {
    key: 'method',
    header: 'Medio',
    value: (row) =>
      row.payment_method ? (PAYMENT_METHOD_LABEL[row.payment_method] ?? row.payment_method) : '',
  },
]

function AdminFeesManager() {
  const { currentCondominiumId } = useAuth()
  const condominiumQuery = useCondominium(currentCondominiumId)
  const table = useTableParams({ pageSize: 10 })
  const query = useAdminFees(currentCondominiumId, table.params)
  const { generate, update } = useAdminFeeMutations()

  const [amount, setAmount] = useState<number | null>(null)
  const [period, setPeriod] = useState<Dayjs>(dayjs().startOf('month'))
  const [dueDate, setDueDate] = useState<Dayjs>(dayjs().startOf('month').date(10))

  // Valor por defecto: el ultimo que uso el conjunto.
  const savedAmount = Number(readSetting(condominiumQuery.data?.settings, 'adminFeeAmount')) || null
  useEffect(() => {
    if (savedAmount && amount === null) setAmount(savedAmount)
  }, [savedAmount, amount])

  const rows = query.data?.data ?? []
  const paid = rows
    .filter((row) => row.status === 'PAID')
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const pending = rows
    .filter((row) => row.status === 'PENDING')
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const overdue = rows.filter(isOverdue).length

  const submitGenerate = () => {
    if (!currentCondominiumId || !amount) return
    generate.mutate({
      condominiumId: currentCondominiumId,
      period: period.startOf('month').format('YYYY-MM-DD'),
      amount,
      dueDate: dueDate.format('YYYY-MM-DD'),
    })
  }

  const columns: ColumnsType<AdminFeeWithRelations> = [
    {
      title: 'Apartamento',
      key: 'apartment',
      fixed: 'left',
      width: 200,
      render: (_, row) => <span className="font-medium text-slate-800">{apartmentLabel(row)}</span>,
    },
    {
      title: 'Mes',
      dataIndex: 'period',
      key: 'period',
      sorter: true,
      width: 160,
      render: (value: string) => <span className="capitalize">{formatPeriod(value)}</span>,
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
      render: (_, row) => <FeeStatusTag fee={row} />,
    },
    {
      title: 'Pago',
      key: 'payment',
      width: 200,
      render: (_, row) =>
        row.paid_at ? (
          <div>
            <div className="text-xs text-slate-700">{formatDateTime(row.paid_at)}</div>
            <Text type="secondary" className="text-xs">
              {row.payment_method
                ? (PAYMENT_METHOD_LABEL[row.payment_method] ?? row.payment_method)
                : ''}
            </Text>
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
        row.status === 'PENDING' ? (
          <Space size={4}>
            <Tooltip title="Registrar pago en efectivo o consignacion">
              <Button
                size="small"
                icon={<Banknote size={14} />}
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: `Registrar el pago de ${apartmentLabel(row)}?`,
                    content: `Se marcara como pagada la cuota de ${formatPeriod(row.period)} por ${formatCurrency(row.amount)}.`,
                    okText: 'Registrar pago',
                    danger: false,
                  })
                  if (ok) {
                    await update.mutateAsync({
                      id: row.id,
                      values: {
                        status: 'PAID',
                        paid_at: new Date().toISOString(),
                        payment_method: 'CASH',
                      },
                    })
                  }
                }}
              />
            </Tooltip>
            <Tooltip title="Anular cuota">
              <Button
                size="small"
                danger
                icon={<Ban size={14} />}
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: `Anular la cuota de ${apartmentLabel(row)}?`,
                    okText: 'Anular',
                  })
                  if (ok) await update.mutateAsync({ id: row.id, values: { status: 'CANCELLED' } })
                }}
              />
            </Tooltip>
          </Space>
        ) : null,
    },
  ]

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
            value={formatCompactCurrency(paid)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
            loading={query.isLoading}
            hint="Suma de los registros visibles con los filtros aplicados"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Pendiente por cobrar"
            value={formatCompactCurrency(pending)}
            icon={<Wallet size={20} />}
            tone="orange"
            loading={query.isLoading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Cuotas vencidas"
            value={overdue}
            icon={<Clock size={20} />}
            tone="red"
            loading={query.isLoading}
          />
        </Col>
      </Row>

      <Card
        className="surface-card mb-4"
        title={<span className="text-sm font-semibold">Generar cuotas del mes</span>}
      >
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
              value={amount}
              onChange={setAmount}
              addonBefore="$"
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
              value={period}
              allowClear={false}
              format="MMMM YYYY"
              onChange={(value) => {
                if (!value) return
                setPeriod(value.startOf('month'))
                setDueDate(value.startOf('month').date(10))
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Fecha limite de pago</span>
            <DatePicker
              className="!w-full"
              value={dueDate}
              allowClear={false}
              format="DD/MM/YYYY"
              disabledDate={(date) => date.isBefore(period.startOf('month'), 'day')}
              onChange={(value) => value && setDueDate(value)}
            />
          </label>
          <Button
            type="primary"
            icon={<CalendarPlus size={16} />}
            disabled={!amount}
            loading={generate.isPending}
            onClick={submitGenerate}
          >
            Generar cuotas
          </Button>
        </div>
      </Card>

      <DataTable<AdminFeeWithRelations>
        columns={columns}
        data={rows}
        total={query.data?.total ?? 0}
        loading={query.isFetching}
        isError={query.isError}
        errorMessage={query.error ? getErrorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
        params={table.params}
        onPageChange={table.setPage}
        onSearch={table.setSearch}
        onSort={table.setSort}
        onFilter={table.setFilter}
        onDateRange={table.setDateRange}
        onReset={table.reset}
        hasActiveFilters={table.hasActiveFilters}
        showDateFilter
        filters={[{ key: 'status', label: 'Estado', options: toOptions(ADMIN_FEE_STATUS) }]}
        searchPlaceholder="Buscar en notas"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="cuotas-administracion"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await paymentService.listAdminFees(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
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
  const { currentCondominiumId, user } = useAuth()
  const query = useMyAdminFees(currentCondominiumId, user?.id)
  const { payAdminFee } = useCheckout()

  const fees = query.data ?? []
  const pendingFees = fees.filter((fee) => fee.status === 'PENDING')
  const paidFees = fees.filter((fee) => fee.status === 'PAID')
  const pendingTotal = pendingFees.reduce((sum, fee) => sum + Number(fee.amount), 0)
  const paidThisYear = paidFees
    .filter((fee) => dayjs(fee.period).year() === dayjs().year())
    .reduce((sum, fee) => sum + Number(fee.amount), 0)

  if (query.isLoading) return <PageSkeleton />

  return (
    <>
      <PageHeader
        title="Pagar administracion"
        subtitle="Paga en linea la cuota de administracion de tus apartamentos."
        dataTour="page-header"
      />

      {query.isError ? (
        <Alert type="error" showIcon className="mb-4" message={getErrorMessage(query.error)} />
      ) : null}

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12}>
          <StatCard
            title="Por pagar"
            value={formatCurrency(pendingTotal)}
            icon={<Wallet size={20} />}
            tone={pendingTotal > 0 ? 'orange' : 'green'}
            footer={`${pendingFees.length} cuota(s) pendiente(s)`}
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatCard
            title={`Pagado en ${dayjs().year()}`}
            value={formatCurrency(paidThisYear)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
          />
        </Col>
      </Row>

      <Card
        className="surface-card mb-4"
        title={<span className="text-sm font-semibold">Cuotas pendientes</span>}
        data-tour="fees-list"
      >
        {pendingFees.length === 0 ? (
          <Empty
            description="Estas al dia. No tienes cuotas pendientes."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {pendingFees.map((fee) => (
              <li key={fee.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-medium capitalize text-slate-800">
                    {formatPeriod(fee.period)}
                  </p>
                  <p className="m-0 text-xs text-slate-500">
                    {apartmentLabel(fee)} · Vence el {formatDate(fee.due_date)}
                  </p>
                </div>
                <FeeStatusTag fee={fee} />
                <strong className="w-28 text-right tabular-nums">
                  {formatCurrency(fee.amount)}
                </strong>
                <Button
                  type="primary"
                  icon={<CreditCard size={16} />}
                  loading={payAdminFee.isPending && payAdminFee.variables === fee.id}
                  disabled={payAdminFee.isPending}
                  onClick={() => payAdminFee.mutate(fee.id)}
                >
                  Pagar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-3 text-xs text-slate-400">
          Seras redirigido a Wompi para pagar con PSE, tarjeta, Nequi o Boton Bancolombia.
        </p>
      </Card>

      <Card
        className="surface-card"
        title={<span className="text-sm font-semibold">Historial de pagos</span>}
      >
        {paidFees.length === 0 ? (
          <Empty
            description="Aun no tienes pagos registrados."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {paidFees.map((fee) => (
              <li key={fee.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-medium capitalize text-slate-800">
                    {formatPeriod(fee.period)}
                  </p>
                  <p className="m-0 text-xs text-slate-500">
                    {apartmentLabel(fee)} · Pagada el{' '}
                    {fee.paid_at ? formatDateTime(fee.paid_at) : '—'}
                    {fee.payment_method
                      ? ` · ${PAYMENT_METHOD_LABEL[fee.payment_method] ?? fee.payment_method}`
                      : ''}
                  </p>
                </div>
                <FeeStatusTag fee={fee} />
                <strong className="w-28 text-right tabular-nums">
                  {formatCurrency(fee.amount)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

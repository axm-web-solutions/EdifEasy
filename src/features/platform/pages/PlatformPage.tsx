import { Button, Col, Row, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BadgeCheck, Building2, DoorOpen, LogIn, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { DataTable } from '@/components/ui/DataTable'
import { formatDate, formatDateTime, formatNumber } from '@/utils/format'
import type { PlatformCondominium } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { usePlatformViewModel, type PlatformViewModel } from '../viewmodels/usePlatformViewModel'
import { PLAN_STATE_META, planLabel, planState } from '../viewmodels/platform.logic'

const EXPORT_COLUMNS: ExportColumn<PlatformCondominium>[] = [
  { key: 'name', header: 'Conjunto', value: (row) => row.name },
  { key: 'city', header: 'Ciudad', value: (row) => row.city ?? '' },
  { key: 'status', header: 'Estado', value: (row) => row.status },
  { key: 'apartments', header: 'Apartamentos', value: (row) => row.apartments },
  { key: 'members', header: 'Usuarios', value: (row) => row.members },
  {
    key: 'admins',
    header: 'Administradores',
    value: (row) => row.admins.map((a) => a.email).join(', '),
  },
  {
    key: 'plan',
    header: 'Plan',
    value: (row) => `${PLAN_STATE_META[planState(row)].label} ${planLabel(row)}`,
  },
  { key: 'ends', header: 'Vence', value: (row) => (row.plan ? formatDate(row.plan.ends_at) : '') },
]

function columns(vm: PlatformViewModel): ColumnsType<PlatformCondominium> {
  return [
    {
      title: 'Conjunto',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      fixed: 'left',
      width: 240,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.name}</p>
          <p className="m-0 text-xs text-slate-500">{row.city ?? 'Sin ciudad'}</p>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (_, row) => (
        <Tag color={vm.row.status(row).color} bordered={false}>
          {vm.row.status(row).label}
        </Tag>
      ),
    },
    {
      title: 'Apartamentos',
      dataIndex: 'apartments',
      key: 'apartments',
      sorter: true,
      align: 'right',
      width: 130,
      render: (value: number) => formatNumber(value),
    },
    {
      title: 'Usuarios',
      dataIndex: 'members',
      key: 'members',
      sorter: true,
      align: 'right',
      width: 110,
      render: (value: number, row) => (
        <span title={`${row.owners} propietarios`}>{formatNumber(value)}</span>
      ),
    },
    {
      title: 'Administracion',
      key: 'admins',
      width: 220,
      render: (_, row) => <span className="text-sm text-slate-700">{vm.row.admins(row)}</span>,
    },
    {
      title: 'Plan',
      key: 'plan',
      width: 180,
      render: (_, row) => {
        const plan = vm.row.plan(row)
        return (
          <div>
            <Tag color={plan.color} bordered={false}>
              {plan.label}
            </Tag>
            {plan.endsAt ? (
              <div className="mt-1 text-xs text-slate-500">
                {plan.period} · vence {formatDate(plan.endsAt)}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      title: 'Ultimo pago',
      dataIndex: 'last_payment_at',
      key: 'last_payment_at',
      width: 160,
      render: (value: string | null) => (value ? formatDateTime(value) : '—'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, row) => (
        <Button size="small" icon={<LogIn size={14} />} onClick={() => vm.open(row)}>
          Administrar
        </Button>
      ),
    },
  ]
}

/** Panel de plataforma del super administrador: todos los conjuntos en un solo lugar. */
export function PlatformPage() {
  const vm = usePlatformViewModel()
  const { stats, table } = vm

  return (
    <>
      <PageHeader
        title="Plataforma"
        subtitle="Todos los conjuntos de EdiFeasy: tamano, administracion y estado del plan."
        dataTour="page-header"
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Conjuntos"
            value={stats.condominiums}
            icon={<Building2 size={20} />}
            tone="blue"
            loading={stats.loading}
            footer={stats.activeCondominiums}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Apartamentos"
            value={stats.apartments}
            icon={<DoorOpen size={20} />}
            tone="purple"
            loading={stats.loading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Usuarios"
            value={stats.users}
            icon={<Users size={20} />}
            tone="slate"
            loading={stats.loading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Planes al dia"
            value={stats.upToDate}
            icon={<BadgeCheck size={20} />}
            tone="green"
            loading={stats.loading}
            footer={`${stats.withoutPlan} vencidos o sin plan`}
          />
        </Col>
      </Row>

      <DataTable<PlatformCondominium>
        columns={columns(vm)}
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
        onReset={table.handlers.reset}
        hasActiveFilters={table.hasActiveFilters}
        filters={table.filters}
        searchPlaceholder="Buscar por conjunto, ciudad o administrador"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="conjuntos-edifeasy"
        exportFetcher={table.exportFetcher}
        emptyTitle="No hay conjuntos con esos filtros"
        scrollX={1300}
        dataTour="data-table"
      />
    </>
  )
}

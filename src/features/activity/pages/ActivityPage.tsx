import { Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useAuditLogs } from '@/hooks/useDashboard'
import { reportService, type AuditLogWithUser } from '@/services/reportService'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { AuditAction } from '@/types/database'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const ACTION_META: Record<AuditAction, { label: string; color: string }> = {
  CREATE: { label: 'Creacion', color: 'green' },
  UPDATE: { label: 'Actualizacion', color: 'blue' },
  DELETE: { label: 'Eliminacion', color: 'red' },
  LOGIN: { label: 'Inicio de sesion', color: 'default' },
  LOGOUT: { label: 'Cierre de sesion', color: 'default' },
  UPLOAD: { label: 'Carga de archivo', color: 'cyan' },
  DOWNLOAD: { label: 'Descarga', color: 'cyan' },
  MESSAGE_SENT: { label: 'Mensaje enviado', color: 'purple' },
  ALERT_CREATED: { label: 'Alerta publicada', color: 'volcano' },
  FINE_CREATED: { label: 'Multa registrada', color: 'magenta' },
  EXPENSE_CREATED: { label: 'Gasto registrado', color: 'gold' },
}

const ENTITY_LABEL: Record<string, string> = {
  alerts: 'Alertas',
  announcements: 'Comunicados',
  apartments: 'Apartamentos',
  buildings: 'Bloques',
  condominiums: 'Condominios',
  condominium_members: 'Usuarios',
  documents: 'Documentos',
  expenses: 'Gastos',
  fines: 'Multas',
  incidents: 'Incidentes',
  messages: 'Mensajes',
  purchases: 'Compras',
  requests: 'Solicitudes',
  auth: 'Autenticacion',
}

const EXPORT_COLUMNS: ExportColumn<AuditLogWithUser>[] = [
  { key: 'date', header: 'Fecha', value: (row) => formatDateTime(row.created_at) },
  { key: 'user', header: 'Usuario', value: (row) => row.user?.full_name ?? 'Sistema' },
  { key: 'action', header: 'Accion', value: (row) => ACTION_META[row.action].label },
  { key: 'entity', header: 'Modulo', value: (row) => ENTITY_LABEL[row.entity] ?? row.entity },
  { key: 'entity_id', header: 'Registro', value: (row) => row.entity_id },
]

export function ActivityPage() {
  const { currentCondominiumId } = useAuth()
  const table = useTableParams({ pageSize: 20 })
  const query = useAuditLogs(currentCondominiumId, table.params)

  const columns: ColumnsType<AuditLogWithUser> = [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Usuario',
      key: 'user',
      width: 200,
      render: (_, row) => (
        <div>
          <p className="m-0 text-sm font-medium text-slate-800">{row.user?.full_name ?? 'Sistema'}</p>
          <Text type="secondary" className="text-xs">
            {row.user?.email ?? '—'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Accion',
      dataIndex: 'action',
      key: 'action',
      width: 170,
      render: (value: AuditAction) => (
        <Tag color={ACTION_META[value].color} bordered={false}>
          {ACTION_META[value].label}
        </Tag>
      ),
    },
    {
      title: 'Modulo',
      dataIndex: 'entity',
      key: 'entity',
      width: 150,
      render: (value: string) => ENTITY_LABEL[value] ?? value,
    },
    {
      title: 'Registro',
      dataIndex: 'entity_id',
      key: 'entity_id',
      render: (value: string | null) => (
        <Text type="secondary" className="text-xs">
          {value ?? '—'}
        </Text>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Registro automatico de todas las acciones criticas sobre el condominio."
      />

      <DataTable<AuditLogWithUser>
        columns={columns}
        data={query.data?.data ?? []}
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
        filters={[
          {
            key: 'action',
            label: 'Accion',
            width: 190,
            options: (Object.keys(ACTION_META) as AuditAction[]).map((action) => ({
              value: action,
              label: ACTION_META[action].label,
            })),
          },
          {
            key: 'entity',
            label: 'Modulo',
            width: 170,
            options: Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
        searchPlaceholder="Filtra por modulo con el selector"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="auditoria"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await reportService.auditLogs(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin registros de auditoria"
        scrollX={900}
      />
    </>
  )
}

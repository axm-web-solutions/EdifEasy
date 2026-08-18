import { useState } from 'react'
import { Badge, Button, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useAlertMutations, useAlerts } from '@/hooks/useAlerts'
import {
  ALERT_STATUS,
  ALERT_TYPE,
  AUDIENCE_TYPE,
  PRIORITY_LEVEL,
  toOptions,
} from '@/constants/enums'
import { alertService } from '@/services/alertService'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { AlertRow, TablesInsert } from '@/types/database'
import type { AlertWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { AlertForm } from '../components/AlertForm'

const { Paragraph, Text } = Typography

const EXPORT_COLUMNS: ExportColumn<AlertWithRelations>[] = [
  { key: 'title', header: 'Titulo', value: (row) => row.title },
  { key: 'type', header: 'Tipo', value: (row) => ALERT_TYPE[row.type].label },
  { key: 'priority', header: 'Prioridad', value: (row) => PRIORITY_LEVEL[row.priority].label },
  { key: 'status', header: 'Estado', value: (row) => ALERT_STATUS[row.status].label },
  { key: 'audience', header: 'Destinatarios', value: (row) => AUDIENCE_TYPE[row.audience].label },
  { key: 'start', header: 'Inicio', value: (row) => formatDateTime(row.start_at) },
  { key: 'end', header: 'Fin', value: (row) => (row.end_at ? formatDateTime(row.end_at) : '') },
  { key: 'author', header: 'Publicado por', value: (row) => row.author?.full_name ?? '' },
]

export function AlertsPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageAlerts')

  const table = useTableParams({ pageSize: 10 })
  const query = useAlerts(currentCondominiumId, table.params)
  const { create, update, remove } = useAlertMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AlertRow | null>(null)

  const handleSubmit = async (values: TablesInsert<'alerts'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const columns: ColumnsType<AlertWithRelations> = [
    {
      title: 'Alerta',
      dataIndex: 'title',
      key: 'title',
      fixed: 'left',
      width: 300,
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <Badge color={PRIORITY_LEVEL[row.priority].hex} />
            <span className="font-medium text-slate-800">{row.title}</span>
          </div>
          <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-xs text-slate-500">
            {row.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (value: AlertRow['type']) => (
        <Tag color={ALERT_TYPE[value].color} bordered={false}>
          {ALERT_TYPE[value].label}
        </Tag>
      ),
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (value: AlertRow['priority']) => (
        <Tag color={PRIORITY_LEVEL[value].color} bordered={false}>
          {PRIORITY_LEVEL[value].label}
        </Tag>
      ),
    },
    {
      title: 'Destinatarios',
      key: 'audience',
      width: 190,
      render: (_, row) => (
        <div>
          <Tag color={AUDIENCE_TYPE[row.audience].color} bordered={false}>
            {AUDIENCE_TYPE[row.audience].label}
          </Tag>
          {row.building ? (
            <Text type="secondary" className="block text-xs">
              {row.building.name}
            </Text>
          ) : null}
          {row.apartment ? (
            <Text type="secondary" className="block text-xs">
              Apto {row.apartment.number}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Vigencia',
      key: 'validity',
      width: 200,
      render: (_, row) => (
        <div className="text-xs text-slate-500">
          <div>Desde: {formatDateTime(row.start_at)}</div>
          <div>Hasta: {row.end_at ? formatDateTime(row.end_at) : 'Sin fecha'}</div>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: AlertRow['status']) => (
        <Tag color={ALERT_STATUS[value].color} bordered={false}>
          {ALERT_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Publicada por',
      key: 'author',
      width: 160,
      render: (_, row) => row.author?.full_name ?? '—',
    },
    ...(canManage
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            fixed: 'right' as const,
            width: 110,
            render: (_: unknown, row: AlertWithRelations) => (
              <Space size={4}>
                <Tooltip title="Editar">
                  <Button
                    size="small"
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setEditing(row)
                      setFormOpen(true)
                    }}
                  />
                </Tooltip>
                <Tooltip title="Eliminar">
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={async () => {
                      const ok = await confirmDelete({ title: `Eliminar la alerta "${row.title}"?` })
                      if (ok) await remove.mutateAsync(row.id)
                    }}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Alertas"
        subtitle="Comunicacion urgente en tiempo real con los residentes del condominio."
        actions={
          canManage ? (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              Nueva alerta
            </Button>
          ) : null
        }
      />

      <DataTable<AlertWithRelations>
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
          { key: 'type', label: 'Tipo', options: toOptions(ALERT_TYPE) },
          { key: 'priority', label: 'Prioridad', options: toOptions(PRIORITY_LEVEL) },
          { key: 'status', label: 'Estado', options: toOptions(ALERT_STATUS) },
        ]}
        searchPlaceholder="Buscar alertas por titulo o descripcion"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="alertas"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await alertService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin alertas"
        emptyDescription="No hay alertas registradas para los filtros seleccionados."
        scrollX={1400}
      />

      {currentCondominiumId && user ? (
        <AlertForm
          open={formOpen}
          alert={editing}
          condominiumId={currentCondominiumId}
          createdBy={user.id}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

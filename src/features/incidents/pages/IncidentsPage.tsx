import { useState } from 'react'
import { Button, Drawer, Descriptions, Space, Tag, Timeline, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Eye, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { AttachmentsList, parseAttachments } from '@/components/forms/AttachmentsField'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useIncidentMutations, useIncidents } from '@/hooks/useIncidents'
import { INCIDENT_STATUS, INCIDENT_TYPE, PRIORITY_LEVEL, toOptions } from '@/constants/enums'
import { incidentService } from '@/services/incidentService'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { IncidentRow, TablesInsert } from '@/types/database'
import type { IncidentWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { IncidentForm } from '../components/IncidentForm'

const { Paragraph, Text, Title } = Typography

const EXPORT_COLUMNS: ExportColumn<IncidentWithRelations>[] = [
  { key: 'code', header: 'Codigo', value: (row) => row.code },
  { key: 'title', header: 'Titulo', value: (row) => row.title },
  { key: 'type', header: 'Tipo', value: (row) => INCIDENT_TYPE[row.type].label },
  { key: 'priority', header: 'Prioridad', value: (row) => PRIORITY_LEVEL[row.priority].label },
  { key: 'status', header: 'Estado', value: (row) => INCIDENT_STATUS[row.status].label },
  { key: 'location', header: 'Ubicacion', value: (row) => row.location },
  { key: 'occurred', header: 'Ocurrio', value: (row) => formatDateTime(row.occurred_at) },
  { key: 'reporter', header: 'Reportado por', value: (row) => row.reporter?.full_name ?? '' },
  { key: 'assignee', header: 'Asignado a', value: (row) => row.assignee?.full_name ?? '' },
]

export function IncidentsPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageIncidents')

  const table = useTableParams({ pageSize: 10 })
  const query = useIncidents(currentCondominiumId, table.params)
  const { create, update, remove } = useIncidentMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<IncidentRow | null>(null)
  const [detail, setDetail] = useState<IncidentWithRelations | null>(null)

  const handleSubmit = async (values: TablesInsert<'incidents'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const columns: ColumnsType<IncidentWithRelations> = [
    {
      title: 'Incidente',
      dataIndex: 'title',
      key: 'title',
      fixed: 'left',
      width: 300,
      render: (_, row) => (
        <div>
          <Space size={6}>
            <Text code className="text-[11px]">
              {row.code ?? '—'}
            </Text>
            <span className="font-medium text-slate-800">{row.title}</span>
          </Space>
          <Paragraph ellipsis={{ rows: 1 }} className="!mb-0 text-xs text-slate-500">
            {row.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (value: IncidentRow['type']) => (
        <Tag color={INCIDENT_TYPE[value].color} bordered={false}>
          {INCIDENT_TYPE[value].label}
        </Tag>
      ),
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (value: IncidentRow['priority']) => (
        <Tag color={PRIORITY_LEVEL[value].color} bordered={false}>
          {PRIORITY_LEVEL[value].label}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: IncidentRow['status']) => (
        <Tag color={INCIDENT_STATUS[value].color} bordered={false}>
          {INCIDENT_STATUS[value].label}
        </Tag>
      ),
    },
    { title: 'Ubicacion', dataIndex: 'location', key: 'location', width: 160, render: (v) => v ?? '—' },
    {
      title: 'Ocurrio',
      dataIndex: 'occurred_at',
      key: 'occurred_at',
      sorter: true,
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Reportado por',
      key: 'reporter',
      width: 160,
      render: (_, row) => row.reporter?.full_name ?? '—',
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button
              size="small"
              icon={<Eye size={14} />}
              onClick={(event) => {
                event.stopPropagation()
                setDetail(row)
              }}
            />
          </Tooltip>
          {canManage ? (
            <>
              <Tooltip title="Editar">
                <Button
                  size="small"
                  icon={<Pencil size={14} />}
                  onClick={(event) => {
                    event.stopPropagation()
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
                  onClick={async (event) => {
                    event.stopPropagation()
                    const ok = await confirmDelete({ title: `Eliminar el incidente "${row.title}"?` })
                    if (ok) await remove.mutateAsync(row.id)
                  }}
                />
              </Tooltip>
            </>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Incidentes"
        subtitle="Registro y seguimiento de eventos de seguridad y convivencia."
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Registrar incidente
          </Button>
        }
      />

      <DataTable<IncidentWithRelations>
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
          { key: 'status', label: 'Estado', options: toOptions(INCIDENT_STATUS) },
          { key: 'type', label: 'Tipo', width: 190, options: toOptions(INCIDENT_TYPE) },
          { key: 'priority', label: 'Prioridad', options: toOptions(PRIORITY_LEVEL) },
        ]}
        searchPlaceholder="Buscar por titulo, descripcion, ubicacion o codigo"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="incidentes"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await incidentService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        onRowClick={(row) => setDetail(row)}
        emptyTitle="Sin incidentes"
        scrollX={1450}
      />

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={620} title="Detalle del incidente">
        {detail ? (
          <div className="space-y-4">
            <div>
              <Title level={4} className="!mb-1">
                {detail.title}
              </Title>
              <Space wrap>
                <Text code>{detail.code ?? '—'}</Text>
                <Tag color={INCIDENT_STATUS[detail.status].color} bordered={false}>
                  {INCIDENT_STATUS[detail.status].label}
                </Tag>
                <Tag color={INCIDENT_TYPE[detail.type].color} bordered={false}>
                  {INCIDENT_TYPE[detail.type].label}
                </Tag>
                <Tag color={PRIORITY_LEVEL[detail.priority].color} bordered={false}>
                  {PRIORITY_LEVEL[detail.priority].label}
                </Tag>
              </Space>
            </div>

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Ubicacion">{detail.location ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Fecha del incidente">
                {formatDateTime(detail.occurred_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Apartamento">
                {detail.apartment ? `Apto ${detail.apartment.number}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Reportado por">
                {detail.reporter?.full_name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Asignado a">
                {detail.assignee?.full_name ?? 'Sin asignar'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>Descripcion</Title>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>
            </div>

            <div>
              <Title level={5} className="flex items-center gap-2">
                <Paperclip size={16} /> Evidencias
              </Title>
              <AttachmentsList
                attachments={parseAttachments(detail.evidence)}
                emptyText="Sin evidencias adjuntas"
              />
            </div>

            {detail.resolution ? (
              <div>
                <Title level={5}>Resolucion</Title>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.resolution}</p>
              </div>
            ) : null}

            <Timeline
              items={[
                {
                  color: 'blue',
                  children: (
                    <div className="text-sm">
                      Incidente reportado
                      <div className="text-xs text-slate-400">{formatDateTime(detail.created_at)}</div>
                    </div>
                  ),
                },
                ...(detail.assignee
                  ? [
                      {
                        color: 'orange',
                        children: (
                          <div className="text-sm">
                            Asignado a <strong>{detail.assignee.full_name}</strong>
                          </div>
                        ),
                      },
                    ]
                  : []),
                ...(detail.resolved_at
                  ? [
                      {
                        color: 'green',
                        children: (
                          <div className="text-sm">
                            Incidente cerrado
                            <div className="text-xs text-slate-400">
                              {formatDateTime(detail.resolved_at)}
                            </div>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        ) : null}
      </Drawer>

      {currentCondominiumId && user ? (
        <IncidentForm
          open={formOpen}
          incident={editing}
          condominiumId={currentCondominiumId}
          reportedBy={user.id}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

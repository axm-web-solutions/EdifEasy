import { useState } from 'react'
import { Button, Descriptions, Drawer, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DoorOpen, LogIn, LogOut, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useVisitorMutations, useVisitors } from '@/hooks/useVisitors'
import { VISITOR_STATUS, VISITOR_TYPE, toOptions } from '@/constants/enums'
import { visitorService } from '@/services/visitorService'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { TablesInsert, VisitorRow, VisitorStatus } from '@/types/database'
import type { VisitorWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { VisitorForm } from '../components/VisitorForm'

const { Paragraph, Title } = Typography

const EXPORT_COLUMNS: ExportColumn<VisitorWithRelations>[] = [
  { key: 'full_name', header: 'Nombre', value: (row) => row.full_name },
  { key: 'document_number', header: 'Documento', value: (row) => row.document_number ?? '' },
  { key: 'phone', header: 'Telefono', value: (row) => row.phone ?? '' },
  { key: 'type', header: 'Tipo', value: (row) => VISITOR_TYPE[row.type].label },
  { key: 'status', header: 'Estado', value: (row) => VISITOR_STATUS[row.status].label },
  {
    key: 'apartment',
    header: 'Apartamento',
    value: (row) => (row.apartment ? `${row.apartment.building?.name ?? 'Bloque'} - Apto ${row.apartment.number}` : ''),
  },
  { key: 'scheduled_at', header: 'Programado', value: (row) => formatDateTime(row.scheduled_at) },
  { key: 'entry_at', header: 'Entrada', value: (row) => formatDateTime(row.entry_at) },
  { key: 'exit_at', header: 'Salida', value: (row) => formatDateTime(row.exit_at) },
]

const STATUS_ACTIONS: Partial<Record<VisitorStatus, { next: VisitorStatus; label: string; icon: typeof LogIn }>> = {
  EXPECTED: { next: 'INSIDE', label: 'Entro', icon: LogIn },
  INSIDE: { next: 'LEFT', label: 'Salio', icon: LogOut },
}

export function VisitorsPage() {
  const { currentCondominiumId, user, hasPermission } = useAuth()
  const canManage = hasPermission('manageVisitors')

  const table = useTableParams({ pageSize: 10 })
  const query = useVisitors(currentCondominiumId, table.params)
  const { create, update, changeStatus, remove } = useVisitorMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VisitorRow | null>(null)
  const [detail, setDetail] = useState<VisitorWithRelations | null>(null)

  const handleSubmit = async (values: TablesInsert<'visitors'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const handleStatus = (row: VisitorWithRelations, next: VisitorStatus) => {
    void changeStatus.mutate({ id: row.id, status: next })
  }

  const columns: ColumnsType<VisitorWithRelations> = [
    {
      title: 'Visitante',
      key: 'full_name',
      fixed: 'left',
      width: 220,
      render: (_, row) => (
        <div>
          <Space size={6}>
            <DoorOpen size={14} className="text-slate-400" />
            <span className="font-medium text-slate-800">{row.full_name}</span>
          </Space>
          <Paragraph ellipsis={{ rows: 1 }} className="!mb-0 text-xs text-slate-500">
            {[row.document_number, row.company].filter(Boolean).join(' · ') || 'Sin documento'}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Apartamento',
      key: 'apartment',
      width: 130,
      render: (_, row) =>
        row.apartment ? `${row.apartment.building?.name ?? 'Bloque'} · Apto ${row.apartment.number}` : '—',
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 105,
      render: (value: VisitorRow['type']) => (
        <Tag color={VISITOR_TYPE[value].color} bordered={false}>
          {VISITOR_TYPE[value].label}
        </Tag>
      ),
    },
    {
      title: 'Programado',
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      sorter: true,
      width: 145,
      render: (value: string | null) => (value ? formatDateTime(value) : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 105,
      render: (value: VisitorRow['status']) => (
        <Tag color={VISITOR_STATUS[value].color} bordered={false}>
          {VISITOR_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Entrada',
      dataIndex: 'entry_at',
      key: 'entry_at',
      width: 145,
      render: (value: string | null) => (value ? formatDateTime(value) : '—'),
    },
    {
      title: 'Salida',
      dataIndex: 'exit_at',
      key: 'exit_at',
      width: 145,
      render: (value: string | null) => (value ? formatDateTime(value) : '—'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 170,
      render: (_, row) => {
        const transition = STATUS_ACTIONS[row.status]
        const transitionIcon = transition ? (() => {
          const IconComponent = transition.icon
          return <IconComponent size={14} />
        })() : null
        return (
          <Space size={4}>
            <Tooltip title="Ver detalle">
              <Button
                size="small"
                icon={<DoorOpen size={14} />}
                onClick={(event) => {
                  event.stopPropagation()
                  setDetail(row)
                }}
              />
            </Tooltip>
            {canManage ? (
              <>
                {transition ? (
                  <>
                    <Tooltip title={`Registrar: ${transition.label.toLowerCase()}`}>
                      <Button
                        size="small"
                        type="primary"
                        icon={transitionIcon}
                        loading={changeStatus.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleStatus(row, transition.next)
                        }}
                      >
                        {transition.label}
                      </Button>
                    </Tooltip>
                    {row.status === 'EXPECTED' ? (
                      <Tooltip title="Cancelar visita">
                        <Button
                          size="small"
                          danger
                          icon={<X size={14} />}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleStatus(row, 'CANCELLED')
                          }}
                        />
                      </Tooltip>
                    ) : null}
                  </>
                ) : null}
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
                      const ok = await confirmDelete({ title: `Eliminar el visitante "${row.full_name}"?` })
                      if (ok) await remove.mutateAsync(row.id)
                    }}
                  />
                </Tooltip>
              </>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Visitantes"
        subtitle="Control de ingreso de visitas, domicilios y proveedores por apartamento."
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
              Registrar visitante
            </Button>
          ) : undefined
        }
      />

      <DataTable<VisitorWithRelations>
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
          { key: 'status', label: 'Estado', options: toOptions(VISITOR_STATUS) },
          { key: 'type', label: 'Tipo', width: 180, options: toOptions(VISITOR_TYPE) },
        ]}
        searchPlaceholder="Buscar por nombre, documento, telefono, placa o empresa"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="visitantes"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await visitorService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        onRowClick={(row) => setDetail(row)}
        emptyTitle="Sin visitantes registrados"
        scrollX={1180}
      />

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={580} title="Detalle del visitante">
        {detail ? (
          <div className="space-y-4">
            <div>
              <Title level={4} className="!mb-1">
                {detail.full_name}
              </Title>
              <Space wrap>
                <Tag color={VISITOR_STATUS[detail.status].color} bordered={false}>
                  {VISITOR_STATUS[detail.status].label}
                </Tag>
                <Tag color={VISITOR_TYPE[detail.type].color} bordered={false}>
                  {VISITOR_TYPE[detail.type].label}
                </Tag>
              </Space>
            </div>

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Apartamento">
                {detail.apartment
                  ? `${detail.apartment.building?.name ?? 'Bloque'} · Apto ${detail.apartment.number}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Documento">{detail.document_number ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Telefono">{detail.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Empresa">{detail.company ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Placa">{detail.plate ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Programado">
                {formatDateTime(detail.scheduled_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Ingreso">
                {formatDateTime(detail.entry_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Salida">
                {formatDateTime(detail.exit_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">
                {detail.registeredBy?.full_name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Creado el">{formatDateTime(detail.created_at)}</Descriptions.Item>
            </Descriptions>

            {detail.notes ? (
              <div>
                <Title level={5}>Notas</Title>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {currentCondominiumId && user ? (
        <VisitorForm
          open={formOpen}
          visitor={editing}
          condominiumId={currentCondominiumId}
          registeredBy={user.id}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}
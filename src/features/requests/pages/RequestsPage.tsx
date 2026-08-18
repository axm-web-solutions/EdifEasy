import { useState } from 'react'
import { Avatar, Button, Drawer, Input, List, Space, Tag, Timeline, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Eye, MessageSquare, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { AttachmentsList, parseAttachments } from '@/components/forms/AttachmentsField'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { EmptyState } from '@/components/ui/states'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useRequestComments, useRequestMutations, useRequests } from '@/hooks/useRequests'
import { PRIORITY_LEVEL, REQUEST_STATUS, REQUEST_TYPE, toOptions } from '@/constants/enums'
import { requestService } from '@/services/requestService'
import { formatDateTime, initials } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { RequestRow, TablesInsert } from '@/types/database'
import type { RequestWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { RequestForm } from '../components/RequestForm'

const { Paragraph, Text, Title } = Typography

const EXPORT_COLUMNS: ExportColumn<RequestWithRelations>[] = [
  { key: 'code', header: 'Codigo', value: (row) => row.code },
  { key: 'title', header: 'Titulo', value: (row) => row.title },
  { key: 'type', header: 'Tipo', value: (row) => REQUEST_TYPE[row.type].label },
  { key: 'priority', header: 'Prioridad', value: (row) => PRIORITY_LEVEL[row.priority].label },
  { key: 'status', header: 'Estado', value: (row) => REQUEST_STATUS[row.status].label },
  { key: 'apartment', header: 'Apartamento', value: (row) => row.apartment?.number ?? '' },
  { key: 'author', header: 'Creada por', value: (row) => row.author?.full_name ?? '' },
  { key: 'assignee', header: 'Asignada a', value: (row) => row.assignee?.full_name ?? '' },
  { key: 'created', header: 'Creada', value: (row) => formatDateTime(row.created_at) },
]

export function RequestsPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageRequests')

  const table = useTableParams({ pageSize: 10 })
  const query = useRequests(currentCondominiumId, table.params)
  const { create, update, remove, addComment } = useRequestMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RequestRow | null>(null)
  const [detail, setDetail] = useState<RequestWithRelations | null>(null)
  const [comment, setComment] = useState('')

  const commentsQuery = useRequestComments(detail?.id ?? null)

  const handleSubmit = async (values: TablesInsert<'requests'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const handleAddComment = async () => {
    if (!detail || !comment.trim() || !user) return
    await addComment.mutateAsync({
      request_id: detail.id,
      author_id: user.id,
      body: comment.trim(),
      is_internal: false,
    })
    setComment('')
  }

  const columns: ColumnsType<RequestWithRelations> = [
    {
      title: 'Solicitud',
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
      width: 150,
      render: (value: RequestRow['type']) => (
        <Tag color={REQUEST_TYPE[value].color} bordered={false}>
          {REQUEST_TYPE[value].label}
        </Tag>
      ),
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (value: RequestRow['priority']) => (
        <Tag color={PRIORITY_LEVEL[value].color} bordered={false}>
          {PRIORITY_LEVEL[value].label}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: RequestRow['status']) => (
        <Tag color={REQUEST_STATUS[value].color} bordered={false}>
          {REQUEST_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Apartamento',
      key: 'apartment',
      width: 130,
      render: (_, row) => (row.apartment ? `Apto ${row.apartment.number}` : '—'),
    },
    {
      title: 'Asignada a',
      key: 'assignee',
      width: 170,
      render: (_, row) => row.assignee?.full_name ?? 'Sin asignar',
    },
    {
      title: 'Creada',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 150,
      render: (value: string) => formatDateTime(value),
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
          {canManage ? (
            <Tooltip title="Eliminar">
              <Button
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={async (event) => {
                  event.stopPropagation()
                  const ok = await confirmDelete({ title: `Eliminar la solicitud "${row.title}"?` })
                  if (ok) await remove.mutateAsync(row.id)
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Solicitudes"
        subtitle="Requerimientos de los residentes y su seguimiento."
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Nueva solicitud
          </Button>
        }
      />

      <DataTable<RequestWithRelations>
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
          { key: 'status', label: 'Estado', options: toOptions(REQUEST_STATUS) },
          { key: 'type', label: 'Tipo', options: toOptions(REQUEST_TYPE) },
          { key: 'priority', label: 'Prioridad', options: toOptions(PRIORITY_LEVEL) },
        ]}
        searchPlaceholder="Buscar por titulo, descripcion o codigo"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="solicitudes"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await requestService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        onRowClick={(row) => setDetail(row)}
        emptyTitle="Sin solicitudes"
        emptyDescription="Crea una solicitud para reportar una necesidad."
        scrollX={1400}
      />

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={640} title="Detalle de la solicitud">
        {detail ? (
          <div className="space-y-4">
            <div>
              <Title level={4} className="!mb-1">
                {detail.title}
              </Title>
              <Space wrap>
                <Text code>{detail.code ?? '—'}</Text>
                <Tag color={REQUEST_STATUS[detail.status].color} bordered={false}>
                  {REQUEST_STATUS[detail.status].label}
                </Tag>
                <Tag color={REQUEST_TYPE[detail.type].color} bordered={false}>
                  {REQUEST_TYPE[detail.type].label}
                </Tag>
                <Tag color={PRIORITY_LEVEL[detail.priority].color} bordered={false}>
                  {PRIORITY_LEVEL[detail.priority].label}
                </Tag>
              </Space>
            </div>

            <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>

            <div>
              <Title level={5} className="flex items-center gap-2">
                <Paperclip size={16} /> Adjuntos
              </Title>
              <AttachmentsList attachments={parseAttachments(detail.attachments)} />
            </div>

            <Timeline
              items={[
                {
                  color: 'blue',
                  children: (
                    <div className="text-sm">
                      <strong>{detail.author?.full_name ?? 'Usuario'}</strong> creo la solicitud
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
                            Asignada a <strong>{detail.assignee.full_name}</strong>
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
                            Resuelta
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

            <div>
              <Title level={5} className="flex items-center gap-2">
                <MessageSquare size={16} /> Comentarios
              </Title>
              {commentsQuery.data && commentsQuery.data.length > 0 ? (
                <List
                  dataSource={commentsQuery.data}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar size={30} style={{ backgroundColor: '#94a3b8' }}>
                            {initials(item.author?.full_name)}
                          </Avatar>
                        }
                        title={
                          <span className="text-sm">
                            {item.author?.full_name ?? 'Usuario'}{' '}
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(item.created_at)}
                            </span>
                          </span>
                        }
                        description={<span className="text-sm text-slate-600">{item.body}</span>}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <EmptyState title="Sin comentarios" description="Se el primero en comentar." />
              )}

              <Space.Compact className="mt-3 w-full">
                <Input.TextArea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Escribe un comentario..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                />
                <Button
                  type="primary"
                  loading={addComment.isPending}
                  disabled={!comment.trim()}
                  onClick={() => void handleAddComment()}
                >
                  Comentar
                </Button>
              </Space.Compact>
            </div>
          </div>
        ) : null}
      </Drawer>

      {currentCondominiumId && user ? (
        <RequestForm
          open={formOpen}
          request={editing}
          condominiumId={currentCondominiumId}
          createdBy={user.id}
          canAssign={canManage}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

import { useState } from 'react'
import { Button, Card, Drawer, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncementMutations, useAnnouncements } from '@/hooks/useAnnouncements'
import { ANNOUNCEMENT_STATUS, AUDIENCE_TYPE, toOptions } from '@/constants/enums'
import { announcementService } from '@/services/announcementService'
import { formatDate, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { AnnouncementRow, TablesInsert } from '@/types/database'
import type { AnnouncementWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { AnnouncementForm } from '../components/AnnouncementForm'

const { Paragraph, Title, Text } = Typography

const EXPORT_COLUMNS: ExportColumn<AnnouncementWithRelations>[] = [
  { key: 'title', header: 'Titulo', value: (row) => row.title },
  { key: 'status', header: 'Estado', value: (row) => ANNOUNCEMENT_STATUS[row.status].label },
  { key: 'audience', header: 'Destinatarios', value: (row) => AUDIENCE_TYPE[row.audience].label },
  { key: 'published', header: 'Publicado', value: (row) => formatDate(row.published_at) },
  { key: 'expires', header: 'Expira', value: (row) => (row.expires_at ? formatDate(row.expires_at) : '') },
  { key: 'author', header: 'Autor', value: (row) => row.author?.full_name ?? '' },
]

export function AnnouncementsPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageAnnouncements')

  const table = useTableParams({ pageSize: 10 })
  const query = useAnnouncements(currentCondominiumId, table.params)
  const { create, update, remove } = useAnnouncementMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementRow | null>(null)
  const [preview, setPreview] = useState<AnnouncementWithRelations | null>(null)

  const handleSubmit = async (values: TablesInsert<'announcements'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const columns: ColumnsType<AnnouncementWithRelations> = [
    {
      title: 'Comunicado',
      dataIndex: 'title',
      key: 'title',
      fixed: 'left',
      width: 320,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.title}</p>
          <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 text-xs text-slate-500">
            {row.content}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Destinatarios',
      dataIndex: 'audience',
      key: 'audience',
      width: 170,
      render: (value: AnnouncementRow['audience']) => (
        <Tag color={AUDIENCE_TYPE[value].color} bordered={false}>
          {AUDIENCE_TYPE[value].label}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: AnnouncementRow['status']) => (
        <Tag color={ANNOUNCEMENT_STATUS[value].color} bordered={false}>
          {ANNOUNCEMENT_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Publicado',
      dataIndex: 'published_at',
      key: 'published_at',
      sorter: true,
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Expira',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 130,
      render: (value: string | null) => (value ? formatDate(value) : '—'),
    },
    { title: 'Autor', key: 'author', width: 160, render: (_, row) => row.author?.full_name ?? '—' },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Ver">
            <Button size="small" icon={<Eye size={14} />} onClick={() => setPreview(row)} />
          </Tooltip>
          {canManage ? (
            <>
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
                    const ok = await confirmDelete({ title: `Eliminar "${row.title}"?` })
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
        title="Comunicados"
        subtitle="Publicaciones informativas dirigidas a la comunidad."
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
              Nuevo comunicado
            </Button>
          ) : null
        }
      />

      <DataTable<AnnouncementWithRelations>
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
          { key: 'status', label: 'Estado', options: toOptions(ANNOUNCEMENT_STATUS) },
          { key: 'audience', label: 'Destinatarios', options: toOptions(AUDIENCE_TYPE) },
        ]}
        searchPlaceholder="Buscar comunicados"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="comunicados"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await announcementService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        onRowClick={(row) => setPreview(row)}
        emptyTitle="Sin comunicados"
        scrollX={1250}
      />

      <Drawer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        width={620}
        title="Comunicado"
      >
        {preview ? (
          <div>
            <Title level={4}>{preview.title}</Title>
            <Space wrap className="mb-3">
              <Tag color={ANNOUNCEMENT_STATUS[preview.status].color} bordered={false}>
                {ANNOUNCEMENT_STATUS[preview.status].label}
              </Tag>
              <Tag color={AUDIENCE_TYPE[preview.audience].color} bordered={false}>
                {AUDIENCE_TYPE[preview.audience].label}
              </Tag>
              <Text type="secondary" className="text-xs">
                {formatDateTime(preview.published_at)} · {preview.author?.full_name ?? 'Administracion'}
              </Text>
            </Space>

            {preview.image_url ? (
              <img
                src={preview.image_url}
                alt={preview.title}
                className="mb-4 w-full rounded-lg object-cover"
                style={{ maxHeight: 260 }}
              />
            ) : null}

            <Card className="border-slate-100">
              <p className="m-0 whitespace-pre-wrap text-sm text-slate-700">{preview.content}</p>
            </Card>
          </div>
        ) : null}
      </Drawer>

      {currentCondominiumId && user ? (
        <AnnouncementForm
          open={formOpen}
          announcement={editing}
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

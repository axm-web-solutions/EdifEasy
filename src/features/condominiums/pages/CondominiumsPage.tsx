import { useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Ban, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useCondominiumMutations, useCondominiums } from '@/hooks/useCondominiums'
import { useAuth } from '@/hooks/useAuth'
import { CONDOMINIUM_STATUS, toOptions } from '@/constants/enums'
import { condominiumService } from '@/services/condominiumService'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { CondominiumRow, TablesInsert } from '@/types/database'
import type { ExportColumn } from '@/utils/export'
import { CondominiumForm } from '../components/CondominiumForm'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<CondominiumRow>[] = [
  { key: 'name', header: 'Nombre', value: (row) => row.name },
  { key: 'nit', header: 'NIT', value: (row) => row.nit },
  { key: 'city', header: 'Ciudad', value: (row) => row.city },
  { key: 'address', header: 'Direccion', value: (row) => row.address },
  { key: 'phone', header: 'Telefono', value: (row) => row.phone },
  { key: 'email', header: 'Correo', value: (row) => row.email },
  { key: 'status', header: 'Estado', value: (row) => CONDOMINIUM_STATUS[row.status].label },
  { key: 'created_at', header: 'Creado', value: (row) => formatDate(row.created_at) },
]

export function CondominiumsPage() {
  const { isSuperAdmin, setCurrentCondominium } = useAuth()
  const table = useTableParams({ pageSize: 10, sortBy: 'name', sortDir: 'asc' })
  const query = useCondominiums(table.params)
  const { create, update, deactivate, remove } = useCondominiumMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CondominiumRow | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (row: CondominiumRow) => {
    setEditing(row)
    setFormOpen(true)
  }

  const handleSubmit = async (values: TablesInsert<'condominiums'>) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, values })
    } else {
      await create.mutateAsync(values)
    }
    setFormOpen(false)
  }

  const handleDelete = async (row: CondominiumRow) => {
    const confirmed = await confirmDelete({
      title: `Eliminar ${row.name}?`,
      content:
        'Se eliminaran todos los bloques, apartamentos, residentes y registros asociados. Esta accion no se puede deshacer.',
    })
    if (confirmed) await remove.mutateAsync(row.id)
  }

  const handleDeactivate = async (row: CondominiumRow) => {
    const confirmed = await confirmDelete({
      title: `Desactivar ${row.name}?`,
      content: 'El condominio quedara inactivo pero se conservara toda la informacion.',
      okText: 'Desactivar',
    })
    if (confirmed) await deactivate.mutateAsync(row.id)
  }

  const columns: ColumnsType<CondominiumRow> = [
    {
      title: 'Condominio',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      fixed: 'left',
      width: 240,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.name}</p>
          <Text type="secondary" className="text-xs">
            {row.nit ?? 'Sin NIT'}
          </Text>
        </div>
      ),
    },
    { title: 'Ciudad', dataIndex: 'city', key: 'city', sorter: true, render: (v) => v ?? '—' },
    { title: 'Direccion', dataIndex: 'address', key: 'address', render: (v) => v ?? '—' },
    { title: 'Telefono', dataIndex: 'phone', key: 'phone', render: (v) => v ?? '—' },
    { title: 'Correo', dataIndex: 'email', key: 'email', render: (v) => v ?? '—' },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: CondominiumRow['status']) => (
        <Tag color={CONDOMINIUM_STATUS[value].color} bordered={false}>
          {CONDOMINIUM_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 170,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Seleccionar condominio">
            <Button size="small" onClick={() => setCurrentCondominium(row.id)}>
              Activar
            </Button>
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<Pencil size={14} />} onClick={() => openEdit(row)} />
          </Tooltip>
          {row.status === 'ACTIVE' ? (
            <Tooltip title="Desactivar">
              <Button size="small" icon={<Ban size={14} />} onClick={() => handleDeactivate(row)} />
            </Tooltip>
          ) : null}
          {isSuperAdmin ? (
            <Tooltip title="Eliminar">
              <Button size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(row)} />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Condominios"
        subtitle="Conjuntos residenciales a los que tienes acceso."
        actions={
          isSuperAdmin ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
              Nuevo condominio
            </Button>
          ) : null
        }
      />

      <DataTable<CondominiumRow>
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
          { key: 'status', label: 'Estado', options: toOptions(CONDOMINIUM_STATUS) },
        ]}
        searchPlaceholder="Buscar por nombre, NIT o ciudad"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="condominios"
        exportFetcher={async () => {
          const result = await condominiumService.list({ ...table.params, page: 1, pageSize: 1000 })
          return result.data
        }}
        emptyTitle="Sin condominios"
        emptyDescription="Crea el primer condominio para comenzar."
        scrollX={1100}
      />

      <CondominiumForm
        open={formOpen}
        condominium={editing}
        submitting={create.isPending || update.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </>
  )
}

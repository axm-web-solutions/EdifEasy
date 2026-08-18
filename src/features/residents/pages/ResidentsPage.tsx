import { useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useResidentMutations, useResidents } from '@/hooks/useResidents'
import { useAllApartments } from '@/hooks/useApartments'
import { RESIDENT_RELATIONSHIP, toOptions } from '@/constants/enums'
import { residentService } from '@/services/residentService'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { ResidentRow, TablesInsert } from '@/types/database'
import type { ResidentWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { ResidentForm } from '../components/ResidentForm'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<ResidentWithRelations>[] = [
  { key: 'name', header: 'Nombre', value: (row) => row.full_name },
  { key: 'document', header: 'Documento', value: (row) => row.document_number },
  { key: 'apartment', header: 'Apartamento', value: (row) => row.apartment?.number ?? '' },
  { key: 'relationship', header: 'Relacion', value: (row) => RESIDENT_RELATIONSHIP[row.relationship].label },
  { key: 'phone', header: 'Telefono', value: (row) => row.phone },
  { key: 'email', header: 'Correo', value: (row) => row.email },
  { key: 'active', header: 'Activo', value: (row) => (row.is_active ? 'Si' : 'No') },
]

export function ResidentsPage() {
  const { currentCondominiumId, hasPermission } = useAuth()
  const canManage = hasPermission('manageStructure')

  const table = useTableParams({ pageSize: 10, sortBy: 'full_name', sortDir: 'asc' })
  const query = useResidents(currentCondominiumId, table.params)
  const apartmentsQuery = useAllApartments(currentCondominiumId)
  const { create, update, remove } = useResidentMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ResidentRow | null>(null)

  const handleSubmit = async (values: TablesInsert<'residents'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const columns: ColumnsType<ResidentWithRelations> = [
    {
      title: 'Residente',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: true,
      fixed: 'left',
      width: 230,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.full_name}</p>
          <Text type="secondary" className="text-xs">
            {row.document_number ?? 'Sin documento'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Apartamento',
      key: 'apartment',
      width: 140,
      render: (_, row) =>
        row.apartment ? (
          <Link to={`/apartments/${row.apartment.id}`}>Apto {row.apartment.number}</Link>
        ) : (
          '—'
        ),
    },
    {
      title: 'Relacion',
      dataIndex: 'relationship',
      key: 'relationship',
      width: 140,
      render: (value: ResidentRow['relationship']) => (
        <Tag color={RESIDENT_RELATIONSHIP[value].color} bordered={false}>
          {RESIDENT_RELATIONSHIP[value].label}
        </Tag>
      ),
    },
    { title: 'Telefono', dataIndex: 'phone', key: 'phone', render: (v) => v ?? '—' },
    { title: 'Correo', dataIndex: 'email', key: 'email', render: (v) => v ?? '—' },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'default'} bordered={false}>
          {value ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
    {
      title: 'Registrado',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    ...(canManage
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            fixed: 'right' as const,
            width: 110,
            render: (_: unknown, row: ResidentWithRelations) => (
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
                      const ok = await confirmDelete({ title: `Eliminar a ${row.full_name}?` })
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
        title="Residentes"
        subtitle="Directorio de personas que habitan el condominio."
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
              Nuevo residente
            </Button>
          ) : null
        }
      />

      <DataTable<ResidentWithRelations>
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
            key: 'apartment_id',
            label: 'Apartamento',
            width: 190,
            options: (apartmentsQuery.data ?? []).map((apartment) => ({
              value: apartment.id,
              label: `${apartment.building?.name ?? ''} · ${apartment.number}`,
            })),
          },
          { key: 'relationship', label: 'Relacion', options: toOptions(RESIDENT_RELATIONSHIP) },
        ]}
        searchPlaceholder="Buscar por nombre, documento, correo o telefono"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="residentes"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await residentService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin residentes"
        emptyDescription="Registra residentes desde aqui o desde la ficha de cada apartamento."
        scrollX={1100}
      />

      {currentCondominiumId ? (
        <ResidentForm
          open={formOpen}
          resident={editing}
          condominiumId={currentCondominiumId}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

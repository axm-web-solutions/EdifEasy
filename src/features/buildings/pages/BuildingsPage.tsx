import { useState } from 'react'
import { Button, Card, Col, Row, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { Blocks, DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { EmptyState } from '@/components/ui/states'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useBuildingMutations, useBuildings, useBuildingsWithCounts } from '@/hooks/useBuildings'
import { BUILDING_STATUS, toOptions } from '@/constants/enums'
import { buildingService } from '@/services/buildingService'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { BuildingRow, TablesInsert } from '@/types/database'
import type { ExportColumn } from '@/utils/export'
import { BuildingForm } from '../components/BuildingForm'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<BuildingRow>[] = [
  { key: 'number', header: 'Identificador', value: (row) => row.number },
  { key: 'name', header: 'Nombre', value: (row) => row.name },
  { key: 'floors', header: 'Pisos', value: (row) => row.floors },
  { key: 'status', header: 'Estado', value: (row) => BUILDING_STATUS[row.status].label },
  { key: 'description', header: 'Descripcion', value: (row) => row.description },
  { key: 'created_at', header: 'Creado', value: (row) => formatDate(row.created_at) },
]

export function BuildingsPage() {
  const { currentCondominiumId, hasPermission } = useAuth()
  const canManage = hasPermission('manageStructure')
  const table = useTableParams({ pageSize: 10, sortBy: 'number', sortDir: 'asc' })

  const query = useBuildings(currentCondominiumId, table.params)
  const countsQuery = useBuildingsWithCounts(currentCondominiumId)
  const { create, update, remove } = useBuildingMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BuildingRow | null>(null)

  const handleSubmit = async (values: TablesInsert<'buildings'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const handleDelete = async (row: BuildingRow) => {
    const confirmed = await confirmDelete({
      title: `Eliminar ${row.name}?`,
      content: 'Se eliminaran tambien los apartamentos que pertenecen a este bloque.',
    })
    if (confirmed) await remove.mutateAsync(row.id)
  }

  const columns: ColumnsType<BuildingRow> = [
    {
      title: 'Bloque',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      fixed: 'left',
      width: 220,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.name}</p>
          <Text type="secondary" className="text-xs">
            Identificador: {row.number}
          </Text>
        </div>
      ),
    },
    { title: 'Pisos', dataIndex: 'floors', key: 'floors', sorter: true, width: 90 },
    {
      title: 'Apartamentos',
      key: 'apartments',
      width: 130,
      render: (_, row) => {
        const found = countsQuery.data?.find((item) => item.id === row.id)
        return (
          <Link to={`/apartments?building=${row.id}`} className="flex items-center gap-1">
            <DoorOpen size={14} /> {found?.apartment_count ?? 0}
          </Link>
        )
      },
    },
    { title: 'Descripcion', dataIndex: 'description', key: 'description', render: (v) => v ?? '—' },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: BuildingRow['status']) => (
        <Tag color={BUILDING_STATUS[value].color} bordered={false}>
          {BUILDING_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) =>
        canManage ? (
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
              <Button size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(row)} />
            </Tooltip>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Bloques"
        subtitle="Estructura fisica del condominio: bloques y torres."
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
              Nuevo bloque
            </Button>
          ) : null
        }
      />

      <Row gutter={[16, 16]} className="mb-4">
        {countsQuery.isLoading ? null : countsQuery.data && countsQuery.data.length > 0 ? (
          countsQuery.data.map((building) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={building.id}>
              <Link to={`/apartments?building=${building.id}`}>
                <Card className="surface-card h-full" hoverable styles={{ body: { padding: 16 } }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold text-slate-800">{building.name}</p>
                      <p className="m-0 text-xs text-slate-500">
                        {building.floors} pisos · {building.apartment_count} apartamentos
                      </p>
                    </div>
                    <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                      <Blocks size={18} />
                    </span>
                  </div>
                  <Tag className="mt-3" color={BUILDING_STATUS[building.status].color} bordered={false}>
                    {BUILDING_STATUS[building.status].label}
                  </Tag>
                </Card>
              </Link>
            </Col>
          ))
        ) : (
          <Col xs={24}>
            <Card className="surface-card">
              <EmptyState
                title="Sin bloques registrados"
                description="Crea el primer bloque para poder registrar apartamentos."
              />
            </Card>
          </Col>
        )}
      </Row>

      <DataTable<BuildingRow>
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
        filters={[{ key: 'status', label: 'Estado', options: toOptions(BUILDING_STATUS) }]}
        searchPlaceholder="Buscar bloque por nombre o identificador"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="bloques"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await buildingService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin bloques"
        scrollX={900}
      />

      {currentCondominiumId ? (
        <BuildingForm
          open={formOpen}
          building={editing}
          condominiumId={currentCondominiumId}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

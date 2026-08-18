import { useEffect, useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useApartmentMutations, useApartments } from '@/hooks/useApartments'
import { useAllBuildings } from '@/hooks/useBuildings'
import { APARTMENT_STATUS, toOptions } from '@/constants/enums'
import { apartmentService } from '@/services/apartmentService'
import { getErrorMessage } from '@/lib/errors'
import type { ApartmentRow, TablesInsert } from '@/types/database'
import type { ApartmentWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { ApartmentForm } from '../components/ApartmentForm'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<ApartmentWithRelations>[] = [
  { key: 'number', header: 'Apartamento', value: (row) => row.number },
  { key: 'building', header: 'Bloque', value: (row) => row.building?.name ?? '' },
  { key: 'floor', header: 'Piso', value: (row) => row.floor },
  { key: 'area', header: 'Area (m2)', value: (row) => row.area },
  { key: 'bedrooms', header: 'Habitaciones', value: (row) => row.bedrooms },
  { key: 'bathrooms', header: 'Banos', value: (row) => row.bathrooms },
  { key: 'parking', header: 'Parqueaderos', value: (row) => row.parking_spots },
  { key: 'status', header: 'Estado', value: (row) => APARTMENT_STATUS[row.status].label },
]

export function ApartmentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentCondominiumId, hasPermission } = useAuth()
  const canManage = hasPermission('manageStructure')

  const buildingParam = searchParams.get('building')
  const table = useTableParams({ pageSize: 10, sortBy: 'number', sortDir: 'asc' })
  const buildingsQuery = useAllBuildings(currentCondominiumId)
  const query = useApartments(currentCondominiumId, table.params)
  const { create, update, remove } = useApartmentMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApartmentRow | null>(null)

  // Filtro por bloque proveniente de la URL (?building=...)
  useEffect(() => {
    if (buildingParam && table.params.filters?.building_id !== buildingParam) {
      table.setFilter('building_id', buildingParam)
    }
    // Solo debe reaccionar al parametro de la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingParam])

  const handleSubmit = async (values: TablesInsert<'apartments'>) => {
    if (editing) await update.mutateAsync({ id: editing.id, values })
    else await create.mutateAsync(values)
    setFormOpen(false)
  }

  const handleDelete = async (row: ApartmentWithRelations) => {
    const confirmed = await confirmDelete({
      title: `Eliminar apartamento ${row.number}?`,
      content:
        'Se eliminaran residentes, propietarios, arrendatarios, vehiculos, mascotas y multas asociadas.',
    })
    if (confirmed) await remove.mutateAsync(row.id)
  }

  const columns: ColumnsType<ApartmentWithRelations> = [
    {
      title: 'Apartamento',
      dataIndex: 'number',
      key: 'number',
      sorter: true,
      fixed: 'left',
      width: 180,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">Apto {row.number}</p>
          <Text type="secondary" className="text-xs">
            {row.building?.name ?? 'Sin bloque'} · Piso {row.floor}
          </Text>
        </div>
      ),
    },
    {
      title: 'Bloque',
      key: 'building',
      width: 140,
      render: (_, row) => row.building?.name ?? '—',
    },
    { title: 'Piso', dataIndex: 'floor', key: 'floor', sorter: true, width: 80 },
    {
      title: 'Area',
      dataIndex: 'area',
      key: 'area',
      width: 100,
      render: (value: number | null) => (value ? `${value} m2` : '—'),
    },
    {
      title: 'Distribucion',
      key: 'distribution',
      width: 160,
      render: (_, row) => (
        <Text type="secondary" className="text-xs">
          {row.bedrooms ?? 0} hab · {row.bathrooms ?? 0} banos · {row.parking_spots} parq.
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: ApartmentRow['status']) => (
        <Tag color={APARTMENT_STATUS[value].color} bordered={false}>
          {APARTMENT_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Abrir ficha CRM">
            <Button
              size="small"
              icon={<Eye size={14} />}
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/apartments/${row.id}`)
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
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDelete(row)
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
        title="Apartamentos"
        subtitle="Navega la estructura del condominio y abre la ficha CRM de cada apartamento."
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
              Nuevo apartamento
            </Button>
          ) : null
        }
      />

      <DataTable<ApartmentWithRelations>
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
        onFilter={(key, value) => {
          table.setFilter(key, value)
          if (key === 'building_id') {
            const next = new URLSearchParams(searchParams)
            if (value) next.set('building', String(value))
            else next.delete('building')
            setSearchParams(next, { replace: true })
          }
        }}
        onDateRange={table.setDateRange}
        onReset={() => {
          table.reset()
          setSearchParams({}, { replace: true })
        }}
        hasActiveFilters={table.hasActiveFilters}
        filters={[
          {
            key: 'building_id',
            label: 'Bloque',
            width: 190,
            options: (buildingsQuery.data ?? []).map((building) => ({
              value: building.id,
              label: building.name,
            })),
          },
          { key: 'status', label: 'Estado', options: toOptions(APARTMENT_STATUS) },
        ]}
        searchPlaceholder="Buscar por numero de apartamento"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="apartamentos"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await apartmentService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        onRowClick={(row) => navigate(`/apartments/${row.id}`)}
        emptyTitle="Sin apartamentos"
        emptyDescription="Registra bloques y apartamentos para comenzar."
        scrollX={1000}
      />

      {currentCondominiumId ? (
        <ApartmentForm
          open={formOpen}
          apartment={editing}
          condominiumId={currentCondominiumId}
          defaultBuildingId={buildingParam}
          submitting={create.isPending || update.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
    </>
  )
}

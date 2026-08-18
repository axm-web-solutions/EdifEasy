import { useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Car,
  Dog,
  FileQuestion,
  Gavel,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DetailSkeleton, EmptyState, ErrorState } from '@/components/ui/states'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useAuth } from '@/hooks/useAuth'
import {
  useApartment,
  useApartmentMutations,
  useApartmentOwners,
  useApartmentTenants,
  useApartmentTimeline,
} from '@/hooks/useApartments'
import {
  usePetMutations,
  usePetsByApartment,
  useResidentMutations,
  useResidentsByApartment,
  useVehicleMutations,
  useVehiclesByApartment,
} from '@/hooks/useResidents'
import { useFinesByApartment } from '@/hooks/useFines'
import {
  APARTMENT_STATUS,
  FINE_STATUS,
  INCIDENT_STATUS,
  PET_TYPE,
  REQUEST_STATUS,
  RESIDENT_RELATIONSHIP,
  VEHICLE_TYPE,
} from '@/constants/enums'
import { formatCurrency, formatDate, formatDateTime, initials } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import { ResidentForm } from '@/features/residents/components/ResidentForm'
import { PetForm, VehicleForm } from '@/features/residents/components/VehiclePetForms'
import { ApartmentForm } from '../components/ApartmentForm'
import { OwnerForm, TenantForm } from '../components/OwnerTenantForms'
import type { PetRow, ResidentRow, VehicleRow } from '@/types/database'

const { Text, Paragraph } = Typography

const TIMELINE_META: Record<string, { color: string; label: string }> = {
  request: { color: 'blue', label: 'Solicitud' },
  incident: { color: 'red', label: 'Incidente' },
  fine: { color: 'purple', label: 'Multa' },
  alert: { color: 'orange', label: 'Alerta' },
}

export function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentCondominiumId, hasPermission } = useAuth()
  const canManage = hasPermission('manageStructure')

  const apartmentQuery = useApartment(id ?? null)
  const ownersQuery = useApartmentOwners(id ?? null)
  const tenantsQuery = useApartmentTenants(id ?? null)
  const residentsQuery = useResidentsByApartment(id ?? null)
  const vehiclesQuery = useVehiclesByApartment(id ?? null)
  const petsQuery = usePetsByApartment(id ?? null)
  const finesQuery = useFinesByApartment(id ?? null)
  const timelineQuery = useApartmentTimeline(id ?? null)

  const apartmentMutations = useApartmentMutations()
  const residentMutations = useResidentMutations()
  const vehicleMutations = useVehicleMutations()
  const petMutations = usePetMutations()

  const [editOpen, setEditOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [tenantOpen, setTenantOpen] = useState(false)
  const [residentOpen, setResidentOpen] = useState(false)
  const [editingResident, setEditingResident] = useState<ResidentRow | null>(null)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null)
  const [petOpen, setPetOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<PetRow | null>(null)

  if (apartmentQuery.isLoading) return <DetailSkeleton />
  if (apartmentQuery.isError) {
    return (
      <ErrorState
        description={getErrorMessage(apartmentQuery.error)}
        onRetry={() => void apartmentQuery.refetch()}
      />
    )
  }

  const apartment = apartmentQuery.data
  if (!apartment) {
    return (
      <EmptyState
        title="Apartamento no encontrado"
        description="Puede que haya sido eliminado o que no tengas permisos para verlo."
        action={<Button onClick={() => navigate('/apartments')}>Volver al listado</Button>}
      />
    )
  }

  const timeline = timelineQuery.data ?? []
  const requests = timeline.filter((item) => item.kind === 'request')
  const incidents = timeline.filter((item) => item.kind === 'incident')

  const overviewTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card className="surface-card h-full" title="Informacion general">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="Bloque">{apartment.building?.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Apartamento">{apartment.number}</Descriptions.Item>
            <Descriptions.Item label="Piso">{apartment.floor}</Descriptions.Item>
            <Descriptions.Item label="Area">
              {apartment.area ? `${apartment.area} m2` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Habitaciones">{apartment.bedrooms ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Banos">{apartment.bathrooms ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Parqueaderos">{apartment.parking_spots}</Descriptions.Item>
            <Descriptions.Item label="Coeficiente">
              {apartment.coefficient ? `${apartment.coefficient}%` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Estado">
              <Tag color={APARTMENT_STATUS[apartment.status].color} bordered={false}>
                {APARTMENT_STATUS[apartment.status].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Registrado">{formatDate(apartment.created_at)}</Descriptions.Item>
            <Descriptions.Item label="Descripcion" span={2}>
              {apartment.description ?? '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Row gutter={[16, 16]}>
          <Col xs={12}>
            <Card className="surface-card text-center" styles={{ body: { padding: 16 } }}>
              <Users className="mx-auto text-blue-600" size={20} />
              <p className="stat-value mt-2 mb-0">{residentsQuery.data?.length ?? 0}</p>
              <p className="m-0 text-xs text-slate-500">Residentes</p>
            </Card>
          </Col>
          <Col xs={12}>
            <Card className="surface-card text-center" styles={{ body: { padding: 16 } }}>
              <UserCheck className="mx-auto text-emerald-600" size={20} />
              <p className="stat-value mt-2 mb-0">{ownersQuery.data?.length ?? 0}</p>
              <p className="m-0 text-xs text-slate-500">Propietarios</p>
            </Card>
          </Col>
          <Col xs={12}>
            <Card className="surface-card text-center" styles={{ body: { padding: 16 } }}>
              <Car className="mx-auto text-violet-600" size={20} />
              <p className="stat-value mt-2 mb-0">{vehiclesQuery.data?.length ?? 0}</p>
              <p className="m-0 text-xs text-slate-500">Vehiculos</p>
            </Card>
          </Col>
          <Col xs={12}>
            <Card className="surface-card text-center" styles={{ body: { padding: 16 } }}>
              <Gavel className="mx-auto text-amber-600" size={20} />
              <p className="stat-value mt-2 mb-0">{finesQuery.data?.length ?? 0}</p>
              <p className="m-0 text-xs text-slate-500">Multas</p>
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  )

  const residentsTab = (
    <Card
      className="surface-card"
      title="Residentes del apartamento"
      extra={
        canManage ? (
          <Button
            size="small"
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditingResident(null)
              setResidentOpen(true)
            }}
          >
            Agregar
          </Button>
        ) : null
      }
    >
      <Table
        rowKey="id"
        size="small"
        loading={residentsQuery.isLoading}
        dataSource={residentsQuery.data ?? []}
        scroll={{ x: 700 }}
        pagination={false}
        locale={{ emptyText: <Empty description="Sin residentes registrados" /> }}
        columns={[
          { title: 'Nombre', dataIndex: 'full_name', key: 'name' },
          { title: 'Documento', dataIndex: 'document_number', key: 'document', render: (v) => v ?? '—' },
          {
            title: 'Relacion',
            dataIndex: 'relationship',
            key: 'relationship',
            render: (value: ResidentRow['relationship']) => (
              <Tag color={RESIDENT_RELATIONSHIP[value].color} bordered={false}>
                {RESIDENT_RELATIONSHIP[value].label}
              </Tag>
            ),
          },
          { title: 'Telefono', dataIndex: 'phone', key: 'phone', render: (v) => v ?? '—' },
          {
            title: 'Estado',
            dataIndex: 'is_active',
            key: 'active',
            render: (value: boolean) => (
              <Tag color={value ? 'green' : 'default'} bordered={false}>
                {value ? 'Activo' : 'Inactivo'}
              </Tag>
            ),
          },
          ...(canManage
            ? [
                {
                  title: 'Acciones',
                  key: 'actions',
                  width: 100,
                  render: (_: unknown, row: ResidentRow) => (
                    <Space size={4}>
                      <Button
                        size="small"
                        icon={<Pencil size={13} />}
                        onClick={() => {
                          setEditingResident(row)
                          setResidentOpen(true)
                        }}
                      />
                      <Button
                        size="small"
                        danger
                        icon={<Trash2 size={13} />}
                        onClick={async () => {
                          const ok = await confirmDelete({ title: `Eliminar a ${row.full_name}?` })
                          if (ok) await residentMutations.remove.mutateAsync(row.id)
                        }}
                      />
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Card>
  )

  const ownersTab = (
    <Card
      className="surface-card"
      title="Propietarios"
      extra={
        canManage ? (
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setOwnerOpen(true)}>
            Asignar propietario
          </Button>
        ) : null
      }
    >
      <List
        loading={ownersQuery.isLoading}
        dataSource={ownersQuery.data ?? []}
        locale={{ emptyText: <Empty description="Sin propietarios asignados" /> }}
        renderItem={(owner) => (
          <List.Item
            actions={
              canManage
                ? [
                    <Button
                      key="remove"
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      onClick={async () => {
                        const ok = await confirmDelete({
                          title: `Remover a ${owner.profile?.full_name ?? 'este propietario'}?`,
                        })
                        if (ok) await apartmentMutations.removeOwner.mutateAsync(owner.id)
                      }}
                    />,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              avatar={
                <Avatar src={owner.profile?.avatar_url ?? undefined} style={{ backgroundColor: '#2559eb' }}>
                  {initials(owner.profile?.full_name)}
                </Avatar>
              }
              title={
                <Space wrap>
                  <span className="font-medium">{owner.profile?.full_name ?? 'Usuario'}</span>
                  {owner.is_primary ? <Tag color="blue">Principal</Tag> : null}
                  <Tag color={owner.is_active ? 'green' : 'default'}>
                    {owner.is_active ? 'Activo' : 'Inactivo'}
                  </Tag>
                </Space>
              }
              description={
                <span className="text-xs text-slate-500">
                  {owner.profile?.email} · {owner.ownership_percentage}% · desde{' '}
                  {formatDate(owner.start_date)}
                </span>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  const tenantsTab = (
    <Card
      className="surface-card"
      title="Arrendatarios"
      extra={
        canManage ? (
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setTenantOpen(true)}>
            Asignar arrendatario
          </Button>
        ) : null
      }
    >
      <List
        loading={tenantsQuery.isLoading}
        dataSource={tenantsQuery.data ?? []}
        locale={{ emptyText: <Empty description="Sin arrendatarios asignados" /> }}
        renderItem={(tenant) => (
          <List.Item
            actions={
              canManage
                ? [
                    <Button
                      key="remove"
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      onClick={async () => {
                        const ok = await confirmDelete({
                          title: `Remover a ${tenant.profile?.full_name ?? 'este arrendatario'}?`,
                        })
                        if (ok) await apartmentMutations.removeTenant.mutateAsync(tenant.id)
                      }}
                    />,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              avatar={
                <Avatar src={tenant.profile?.avatar_url ?? undefined} style={{ backgroundColor: '#8b5cf6' }}>
                  {initials(tenant.profile?.full_name)}
                </Avatar>
              }
              title={
                <Space wrap>
                  <span className="font-medium">{tenant.profile?.full_name ?? 'Usuario'}</span>
                  <Tag color={tenant.is_active ? 'green' : 'default'}>
                    {tenant.is_active ? 'Vigente' : 'Finalizado'}
                  </Tag>
                </Space>
              }
              description={
                <span className="text-xs text-slate-500">
                  {tenant.profile?.email} · {formatDate(tenant.lease_start)} —{' '}
                  {tenant.lease_end ? formatDate(tenant.lease_end) : 'indefinido'}
                  {tenant.monthly_rent ? ` · ${formatCurrency(tenant.monthly_rent)}/mes` : ''}
                </span>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  const vehiclesTab = (
    <Card
      className="surface-card"
      title="Vehiculos"
      extra={
        <Button
          size="small"
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => {
            setEditingVehicle(null)
            setVehicleOpen(true)
          }}
        >
          Agregar
        </Button>
      }
    >
      <Table
        rowKey="id"
        size="small"
        loading={vehiclesQuery.isLoading}
        dataSource={vehiclesQuery.data ?? []}
        pagination={false}
        scroll={{ x: 650 }}
        locale={{ emptyText: <Empty description="Sin vehiculos registrados" /> }}
        columns={[
          { title: 'Placa', dataIndex: 'plate', key: 'plate' },
          {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            render: (value: VehicleRow['type']) => (
              <Tag color={VEHICLE_TYPE[value].color} bordered={false}>
                {VEHICLE_TYPE[value].label}
              </Tag>
            ),
          },
          { title: 'Marca', dataIndex: 'brand', key: 'brand', render: (v) => v ?? '—' },
          { title: 'Modelo', dataIndex: 'model', key: 'model', render: (v) => v ?? '—' },
          { title: 'Color', dataIndex: 'color', key: 'color', render: (v) => v ?? '—' },
          { title: 'Parqueadero', dataIndex: 'parking_spot', key: 'spot', render: (v) => v ?? '—' },
          {
            title: 'Acciones',
            key: 'actions',
            width: 100,
            render: (_: unknown, row: VehicleRow) => (
              <Space size={4}>
                <Button
                  size="small"
                  icon={<Pencil size={13} />}
                  onClick={() => {
                    setEditingVehicle(row)
                    setVehicleOpen(true)
                  }}
                />
                <Button
                  size="small"
                  danger
                  icon={<Trash2 size={13} />}
                  onClick={async () => {
                    const ok = await confirmDelete({ title: `Eliminar el vehiculo ${row.plate}?` })
                    if (ok) await vehicleMutations.remove.mutateAsync(row.id)
                  }}
                />
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )

  const petsTab = (
    <Card
      className="surface-card"
      title="Mascotas"
      extra={
        <Button
          size="small"
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => {
            setEditingPet(null)
            setPetOpen(true)
          }}
        >
          Agregar
        </Button>
      }
    >
      <Table
        rowKey="id"
        size="small"
        loading={petsQuery.isLoading}
        dataSource={petsQuery.data ?? []}
        pagination={false}
        scroll={{ x: 600 }}
        locale={{ emptyText: <Empty description="Sin mascotas registradas" /> }}
        columns={[
          { title: 'Nombre', dataIndex: 'name', key: 'name' },
          {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            render: (value: PetRow['type']) => (
              <Tag color={PET_TYPE[value].color} bordered={false}>
                {PET_TYPE[value].label}
              </Tag>
            ),
          },
          { title: 'Raza', dataIndex: 'breed', key: 'breed', render: (v) => v ?? '—' },
          {
            title: 'Peso',
            dataIndex: 'weight',
            key: 'weight',
            render: (value: number | null) => (value ? `${value} kg` : '—'),
          },
          {
            title: 'Vacunas',
            dataIndex: 'vaccinated',
            key: 'vaccinated',
            render: (value: boolean) => (
              <Tag color={value ? 'green' : 'orange'} bordered={false}>
                {value ? 'Al dia' : 'Pendiente'}
              </Tag>
            ),
          },
          {
            title: 'Acciones',
            key: 'actions',
            width: 100,
            render: (_: unknown, row: PetRow) => (
              <Space size={4}>
                <Button
                  size="small"
                  icon={<Pencil size={13} />}
                  onClick={() => {
                    setEditingPet(row)
                    setPetOpen(true)
                  }}
                />
                <Button
                  size="small"
                  danger
                  icon={<Trash2 size={13} />}
                  onClick={async () => {
                    const ok = await confirmDelete({ title: `Eliminar a ${row.name}?` })
                    if (ok) await petMutations.remove.mutateAsync(row.id)
                  }}
                />
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )

  const finesTab = (
    <Card className="surface-card" title="Multas del apartamento">
      <Table
        rowKey="id"
        size="small"
        loading={finesQuery.isLoading}
        dataSource={finesQuery.data ?? []}
        pagination={false}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty description="Sin multas registradas" /> }}
        columns={[
          { title: 'Motivo', dataIndex: 'reason', key: 'reason' },
          {
            title: 'Valor',
            dataIndex: 'amount',
            key: 'amount',
            render: (value: number) => formatCurrency(value),
          },
          {
            title: 'Fecha',
            dataIndex: 'fine_date',
            key: 'date',
            render: (value: string) => formatDate(value),
          },
          {
            title: 'Vence',
            dataIndex: 'due_date',
            key: 'due',
            render: (value: string | null) => (value ? formatDate(value) : '—'),
          },
          {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            render: (value: keyof typeof FINE_STATUS) => (
              <Tag color={FINE_STATUS[value].color} bordered={false}>
                {FINE_STATUS[value].label}
              </Tag>
            ),
          },
        ]}
      />
    </Card>
  )

  const listTab = (
    items: typeof timeline,
    emptyText: string,
    statusMap: Record<string, { label: string; color: string }>,
  ) => (
    <Card className="surface-card">
      <List
        loading={timelineQuery.isLoading}
        dataSource={items}
        locale={{ emptyText: <Empty description={emptyText} /> }}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space wrap>
                  <span className="font-medium">{item.title}</span>
                  <Tag color={statusMap[item.status]?.color ?? 'default'} bordered={false}>
                    {statusMap[item.status]?.label ?? item.status}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <Paragraph ellipsis={{ rows: 2 }} className="!mb-1 text-xs text-slate-500">
                    {item.description}
                  </Paragraph>
                  <Text type="secondary" className="text-[11px]">
                    {formatDateTime(item.created_at)}
                  </Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  const activityTab = (
    <Card className="surface-card" title="Linea de tiempo del apartamento">
      {timeline.length === 0 ? (
        <EmptyState title="Sin actividad" description="Aun no hay eventos asociados a este apartamento." />
      ) : (
        <Timeline
          items={timeline.map((item) => ({
            color: TIMELINE_META[item.kind]?.color ?? 'gray',
            children: (
              <div>
                <Space wrap size={6}>
                  <Tag bordered={false}>{TIMELINE_META[item.kind]?.label ?? item.kind}</Tag>
                  <span className="text-sm font-medium text-slate-800">{item.title}</span>
                </Space>
                <Paragraph ellipsis={{ rows: 2 }} className="!mb-0 mt-1 text-xs text-slate-500">
                  {item.description}
                </Paragraph>
                <Text type="secondary" className="text-[11px]">
                  {formatDateTime(item.created_at)}
                </Text>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        title={`${apartment.building?.name ?? 'Bloque'} · Apto ${apartment.number}`}
        subtitle={`Piso ${apartment.floor} · ${apartment.area ? `${apartment.area} m2 · ` : ''}${
          APARTMENT_STATUS[apartment.status].label
        }`}
        breadcrumbs={[
          { label: 'Apartamentos', to: '/apartments' },
          { label: `Apto ${apartment.number}` },
        ]}
        actions={
          <Space>
            <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/apartments')}>
              Volver
            </Button>
            {canManage ? (
              <Tooltip title="Editar apartamento">
                <Button type="primary" icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>
                  Editar
                </Button>
              </Tooltip>
            ) : null}
          </Space>
        }
      />

      <Tabs
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: 'Resumen', children: overviewTab },
          {
            key: 'residents',
            label: (
              <span className="flex items-center gap-1">
                <Users size={14} /> Residentes
              </span>
            ),
            children: residentsTab,
          },
          {
            key: 'owners',
            label: (
              <span className="flex items-center gap-1">
                <UserCheck size={14} /> Propietarios
              </span>
            ),
            children: ownersTab,
          },
          { key: 'tenants', label: 'Arrendatarios', children: tenantsTab },
          {
            key: 'vehicles',
            label: (
              <span className="flex items-center gap-1">
                <Car size={14} /> Vehiculos
              </span>
            ),
            children: vehiclesTab,
          },
          {
            key: 'pets',
            label: (
              <span className="flex items-center gap-1">
                <Dog size={14} /> Mascotas
              </span>
            ),
            children: petsTab,
          },
          {
            key: 'requests',
            label: (
              <span className="flex items-center gap-1">
                <FileQuestion size={14} /> Solicitudes
              </span>
            ),
            children: listTab(requests, 'Sin solicitudes', REQUEST_STATUS),
          },
          {
            key: 'incidents',
            label: (
              <span className="flex items-center gap-1">
                <ShieldAlert size={14} /> Incidentes
              </span>
            ),
            children: listTab(incidents, 'Sin incidentes', INCIDENT_STATUS),
          },
          {
            key: 'fines',
            label: (
              <span className="flex items-center gap-1">
                <Gavel size={14} /> Multas
              </span>
            ),
            children: finesTab,
          },
          { key: 'activity', label: 'Actividad', children: activityTab },
        ]}
      />

      {currentCondominiumId ? (
        <>
          <ApartmentForm
            open={editOpen}
            apartment={apartment}
            condominiumId={currentCondominiumId}
            submitting={apartmentMutations.update.isPending}
            onClose={() => setEditOpen(false)}
            onSubmit={(values) => {
              void apartmentMutations.update
                .mutateAsync({ id: apartment.id, values })
                .then(() => setEditOpen(false))
            }}
          />

          <OwnerForm
            open={ownerOpen}
            apartmentId={apartment.id}
            condominiumId={currentCondominiumId}
            submitting={apartmentMutations.addOwner.isPending}
            onClose={() => setOwnerOpen(false)}
            onSubmit={(values) => {
              void apartmentMutations.addOwner.mutateAsync(values).then(() => setOwnerOpen(false))
            }}
          />

          <TenantForm
            open={tenantOpen}
            apartmentId={apartment.id}
            condominiumId={currentCondominiumId}
            submitting={apartmentMutations.addTenant.isPending}
            onClose={() => setTenantOpen(false)}
            onSubmit={(values) => {
              void apartmentMutations.addTenant.mutateAsync(values).then(() => setTenantOpen(false))
            }}
          />

          <ResidentForm
            open={residentOpen}
            resident={editingResident}
            condominiumId={currentCondominiumId}
            fixedApartmentId={apartment.id}
            submitting={residentMutations.create.isPending || residentMutations.update.isPending}
            onClose={() => setResidentOpen(false)}
            onSubmit={(values) => {
              const action = editingResident
                ? residentMutations.update.mutateAsync({ id: editingResident.id, values })
                : residentMutations.create.mutateAsync(values)
              void action.then(() => setResidentOpen(false))
            }}
          />

          <VehicleForm
            open={vehicleOpen}
            vehicle={editingVehicle}
            condominiumId={currentCondominiumId}
            fixedApartmentId={apartment.id}
            submitting={vehicleMutations.create.isPending || vehicleMutations.update.isPending}
            onClose={() => setVehicleOpen(false)}
            onSubmit={(values) => {
              const action = editingVehicle
                ? vehicleMutations.update.mutateAsync({ id: editingVehicle.id, values })
                : vehicleMutations.create.mutateAsync(values)
              void action.then(() => setVehicleOpen(false))
            }}
          />

          <PetForm
            open={petOpen}
            pet={editingPet}
            condominiumId={currentCondominiumId}
            fixedApartmentId={apartment.id}
            submitting={petMutations.create.isPending || petMutations.update.isPending}
            onClose={() => setPetOpen(false)}
            onSubmit={(values) => {
              const action = editingPet
                ? petMutations.update.mutateAsync({ id: editingPet.id, values })
                : petMutations.create.mutateAsync(values)
              void action.then(() => setPetOpen(false))
            }}
          />
        </>
      ) : null}
    </>
  )
}

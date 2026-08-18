import { Alert, Card, Col, Descriptions, List, Row, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import {
  Car,
  Dog,
  FileQuestion,
  FolderOpen,
  Gavel,
  Home,
  Megaphone,
  MessageCircle,
  Siren,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, PageSkeleton } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useResidentDashboard } from '@/hooks/useDashboard'
import { useActiveAlerts } from '@/hooks/useAlerts'
import { usePublishedAnnouncements } from '@/hooks/useAnnouncements'
import { APARTMENT_STATUS, ALERT_TYPE, PRIORITY_LEVEL } from '@/constants/enums'
import { formatCompactCurrency, formatDate, formatNumber } from '@/utils/format'
import { roleLabel } from '@/constants/roles'

const { Paragraph, Text } = Typography

export function ResidentDashboard() {
  const { currentCondominiumId, currentMembership, profile, role } = useAuth()

  const statsQuery = useResidentDashboard(currentCondominiumId)
  const alertsQuery = useActiveAlerts(currentCondominiumId, 5)
  const announcementsQuery = usePublishedAnnouncements(currentCondominiumId, 4)

  if (statsQuery.isLoading) return <PageSkeleton />

  const stats = statsQuery.data
  const apartments = stats?.apartments ?? []
  const criticalAlerts = (alertsQuery.data ?? []).filter(
    (alert) => alert.priority === 'CRITICAL' || alert.priority === 'HIGH',
  )

  return (
    <>
      <PageHeader
        title={`Hola, ${profile?.full_name?.split(' ')[0] ?? 'residente'}`}
        subtitle={`${currentMembership?.condominium_name ?? 'Condominio'} · ${roleLabel(role)}`}
      />

      {criticalAlerts.length > 0 ? (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={`Tienes ${criticalAlerts.length} alerta(s) importante(s)`}
          description={
            <ul className="m-0 list-disc pl-5">
              {criticalAlerts.map((alert) => (
                <li key={alert.id} className="text-sm">
                  <strong>{alert.title}</strong> — {alert.description.slice(0, 120)}
                </li>
              ))}
            </ul>
          }
          action={<Link to="/alerts">Ver alertas</Link>}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            className="surface-card h-full"
            title={<span className="text-sm font-semibold">Mi apartamento</span>}
            extra={<Link to="/my-apartment">Ver detalle</Link>}
          >
            {apartments.length === 0 ? (
              <EmptyState
                title="Sin apartamento asignado"
                description="El administrador aun no ha vinculado tu usuario a un apartamento."
              />
            ) : (
              <div className="space-y-4">
                {apartments.map((apartment) => (
                  <Descriptions
                    key={apartment.id}
                    bordered
                    size="small"
                    column={{ xs: 1, sm: 2 }}
                    title={
                      <div className="flex items-center gap-2">
                        <Home size={16} className="text-blue-600" />
                        <span>
                          {apartment.building_name} · Apto {apartment.number}
                        </span>
                        <Tag color={APARTMENT_STATUS[apartment.status as keyof typeof APARTMENT_STATUS]?.color}>
                          {APARTMENT_STATUS[apartment.status as keyof typeof APARTMENT_STATUS]?.label ??
                            apartment.status}
                        </Tag>
                      </div>
                    }
                    items={[
                      { key: 'building', label: 'Bloque', children: apartment.building_name },
                      { key: 'floor', label: 'Piso', children: apartment.floor },
                      { key: 'area', label: 'Area', children: apartment.area ? `${apartment.area} m2` : '—' },
                      { key: 'bedrooms', label: 'Habitaciones', children: apartment.bedrooms ?? '—' },
                      { key: 'bathrooms', label: 'Banos', children: apartment.bathrooms ?? '—' },
                      {
                        key: 'link',
                        label: 'Ficha completa',
                        children: <Link to={`/apartments/${apartment.id}`}>Abrir CRM</Link>,
                      },
                    ]}
                  />
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Row gutter={[16, 16]}>
            <Col xs={12}>
              <StatCard
                title="Alertas"
                value={formatNumber(stats?.active_alerts ?? 0)}
                icon={<Siren size={20} />}
                tone="red"
                to="/alerts"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Comunicados"
                value={formatNumber(stats?.announcements ?? 0)}
                icon={<Megaphone size={20} />}
                tone="blue"
                to="/announcements"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Solicitudes"
                value={formatNumber(stats?.open_requests ?? 0)}
                icon={<FileQuestion size={20} />}
                tone="orange"
                to="/requests"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Mensajes sin leer"
                value={formatNumber(stats?.unread_messages ?? 0)}
                icon={<MessageCircle size={20} />}
                tone="green"
                to="/messages"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Multas pendientes"
                value={formatNumber(stats?.pending_fines ?? 0)}
                icon={<Gavel size={20} />}
                tone="purple"
                to="/fines"
                footer={formatCompactCurrency(stats?.pending_fines_amount ?? 0)}
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Documentos"
                value={formatNumber(stats?.documents ?? 0)}
                icon={<FolderOpen size={20} />}
                tone="slate"
                to="/documents"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Vehiculos"
                value={formatNumber(stats?.vehicles ?? 0)}
                icon={<Car size={20} />}
                tone="blue"
                to="/my-apartment"
              />
            </Col>
            <Col xs={12}>
              <StatCard
                title="Mascotas"
                value={formatNumber(stats?.pets ?? 0)}
                icon={<Dog size={20} />}
                tone="green"
                to="/my-apartment"
              />
            </Col>
          </Row>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={<span className="text-sm font-semibold">Alertas del condominio</span>}
            extra={<Link to="/alerts">Ver todas</Link>}
          >
            {alertsQuery.data && alertsQuery.data.length > 0 ? (
              <List
                dataSource={alertsQuery.data}
                renderItem={(alert) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{alert.title}</span>
                          <Tag color={PRIORITY_LEVEL[alert.priority].color} bordered={false}>
                            {PRIORITY_LEVEL[alert.priority].label}
                          </Tag>
                          <Tag color={ALERT_TYPE[alert.type].color} bordered={false}>
                            {ALERT_TYPE[alert.type].label}
                          </Tag>
                        </div>
                      }
                      description={
                        <span className="text-xs text-slate-500 line-clamp-2">{alert.description}</span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState title="Sin alertas" description="No hay alertas activas en este momento." />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={<span className="text-sm font-semibold">Comunicados recientes</span>}
            extra={<Link to="/announcements">Ver todos</Link>}
          >
            {announcementsQuery.data && announcementsQuery.data.length > 0 ? (
              <List
                dataSource={announcementsQuery.data}
                renderItem={(announcement) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<span className="text-sm font-medium">{announcement.title}</span>}
                      description={
                        <div>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            className="!mb-1 text-xs text-slate-500"
                          >
                            {announcement.content}
                          </Paragraph>
                          <Text type="secondary" className="text-[11px]">
                            {formatDate(announcement.published_at)} ·{' '}
                            {announcement.author?.full_name ?? 'Administracion'}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState
                title="Sin comunicados"
                description="La administracion aun no ha publicado comunicados."
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  )
}

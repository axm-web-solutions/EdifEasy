import { Card, Col, List, Row, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { ClipboardList, DoorOpen, ShieldAlert, Siren, UsersRound, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useAdminDashboard } from '@/hooks/useDashboard'
import { useRecentIncidents } from '@/hooks/useIncidents'
import { useRecentRequests } from '@/hooks/useRequests'
import { useActiveAlerts } from '@/hooks/useAlerts'
import {
  ALERT_TYPE,
  INCIDENT_STATUS,
  PRIORITY_LEVEL,
  REQUEST_STATUS,
  REQUEST_TYPE,
} from '@/constants/enums'
import { formatNumber, formatRelative } from '@/utils/format'
import { roleLabel } from '@/constants/roles'

/**
 * Dashboard operativo compartido por SECURITY y SERVICE_STAFF.
 * Muestra unicamente la informacion necesaria para sus funciones
 * (sin datos financieros, que ademas RLS bloquea a nivel de base de datos).
 */
export function OperationalDashboard() {
  const { currentCondominiumId, currentMembership, role } = useAuth()
  const isSecurity = role === 'SECURITY'

  const statsQuery = useAdminDashboard(currentCondominiumId)
  const incidentsQuery = useRecentIncidents(currentCondominiumId, 6)
  const requestsQuery = useRecentRequests(currentCondominiumId, 6)
  const alertsQuery = useActiveAlerts(currentCondominiumId, 5)

  const stats = statsQuery.data

  return (
    <>
      <PageHeader
        title={`Panel operativo · ${roleLabel(role)}`}
        subtitle={currentMembership?.condominium_name ?? 'Condominio'}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Residentes activos"
            value={formatNumber(stats?.residents ?? 0)}
            icon={<UsersRound size={20} />}
            tone="green"
            loading={statsQuery.isLoading}
            to="/residents"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Apartamentos"
            value={formatNumber(stats?.apartments ?? 0)}
            icon={<DoorOpen size={20} />}
            tone="blue"
            loading={statsQuery.isLoading}
            to="/apartments"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title={isSecurity ? 'Incidentes abiertos' : 'Solicitudes asignadas'}
            value={formatNumber(
              isSecurity ? (stats?.open_incidents ?? 0) : (stats?.pending_requests ?? 0),
            )}
            icon={isSecurity ? <ShieldAlert size={20} /> : <Wrench size={20} />}
            tone="orange"
            loading={statsQuery.isLoading}
            to={isSecurity ? '/incidents' : '/requests'}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Alertas activas"
            value={formatNumber(stats?.active_alerts ?? 0)}
            icon={<Siren size={20} />}
            tone="red"
            loading={statsQuery.isLoading}
            to="/alerts"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert size={16} /> Incidentes recientes
              </span>
            }
            extra={<Link to="/incidents">Ver todos</Link>}
          >
            {incidentsQuery.data && incidentsQuery.data.length > 0 ? (
              <List
                dataSource={incidentsQuery.data}
                renderItem={(incident) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{incident.title}</span>
                          <Tag color={INCIDENT_STATUS[incident.status].color} bordered={false}>
                            {INCIDENT_STATUS[incident.status].label}
                          </Tag>
                          <Tag color={PRIORITY_LEVEL[incident.priority].color} bordered={false}>
                            {PRIORITY_LEVEL[incident.priority].label}
                          </Tag>
                        </div>
                      }
                      description={
                        <span className="text-xs text-slate-500">
                          {incident.location ?? 'Sin ubicacion'} · {formatRelative(incident.occurred_at)}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState title="Sin incidentes" description="No hay incidentes recientes registrados." />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList size={16} /> Solicitudes recientes
              </span>
            }
            extra={<Link to="/requests">Ver todas</Link>}
          >
            {requestsQuery.data && requestsQuery.data.length > 0 ? (
              <List
                dataSource={requestsQuery.data}
                renderItem={(request) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{request.title}</span>
                          <Tag color={REQUEST_STATUS[request.status].color} bordered={false}>
                            {REQUEST_STATUS[request.status].label}
                          </Tag>
                          <Tag color={REQUEST_TYPE[request.type].color} bordered={false}>
                            {REQUEST_TYPE[request.type].label}
                          </Tag>
                        </div>
                      }
                      description={
                        <span className="text-xs text-slate-500">
                          {request.apartment ? `Apto ${request.apartment.number} · ` : ''}
                          {formatRelative(request.created_at)}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState title="Sin solicitudes" description="No hay solicitudes recientes." />
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            className="surface-card"
            title={
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Siren size={16} /> Alertas vigentes
              </span>
            }
            extra={<Link to="/alerts">Ver todas</Link>}
          >
            {alertsQuery.data && alertsQuery.data.length > 0 ? (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
                dataSource={alertsQuery.data}
                renderItem={(alert) => (
                  <List.Item>
                    <Card size="small" className="h-full border-slate-100">
                      <div className="mb-1 flex flex-wrap items-center gap-1">
                        <Tag color={ALERT_TYPE[alert.type].color} bordered={false}>
                          {ALERT_TYPE[alert.type].label}
                        </Tag>
                        <Tag color={PRIORITY_LEVEL[alert.priority].color} bordered={false}>
                          {PRIORITY_LEVEL[alert.priority].label}
                        </Tag>
                      </div>
                      <p className="m-0 text-sm font-medium text-slate-800">{alert.title}</p>
                      <p className="m-0 mt-1 text-xs text-slate-500 line-clamp-3">{alert.description}</p>
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <EmptyState title="Sin alertas activas" />
            )}
          </Card>
        </Col>
      </Row>
    </>
  )
}

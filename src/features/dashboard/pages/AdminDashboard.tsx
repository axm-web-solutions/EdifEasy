import { Card, Col, List, Row, Tag, Timeline, Typography } from 'antd'
import { Link } from 'react-router-dom'
import {
  Building2,
  DoorOpen,
  Gavel,
  Receipt,
  ShieldAlert,
  ShoppingCart,
  Siren,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { AreaChartCard, BarChartCard, PieChartCard } from '@/components/charts/charts'
import { EmptyState } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useAdminDashboard, useRecentActivity } from '@/hooks/useDashboard'
import { useExpensesByCategory, useExpensesMonthly } from '@/hooks/useExpenses'
import {
  useFinesByStatus,
  useIncidentsByType,
  useRequestsByStatus,
} from '@/hooks/useReports'
import { useActiveAlerts } from '@/hooks/useAlerts'
import { FINE_STATUS, INCIDENT_TYPE, PRIORITY_LEVEL, REQUEST_STATUS, ALERT_TYPE } from '@/constants/enums'
import { formatCompactCurrency, formatDateTime, formatNumber } from '@/utils/format'
import type { RequestStatus, IncidentType, FineStatus } from '@/types/database'

const { Text } = Typography

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'creo',
  UPDATE: 'actualizo',
  DELETE: 'elimino',
  LOGIN: 'inicio sesion',
  LOGOUT: 'cerro sesion',
  UPLOAD: 'subio',
  DOWNLOAD: 'descargo',
  MESSAGE_SENT: 'envio un mensaje en',
  ALERT_CREATED: 'publico una alerta en',
  FINE_CREATED: 'registro una multa en',
  EXPENSE_CREATED: 'registro un gasto en',
}

const ENTITY_LABEL: Record<string, string> = {
  alerts: 'alertas',
  announcements: 'comunicados',
  apartments: 'apartamentos',
  buildings: 'bloques',
  condominiums: 'condominios',
  condominium_members: 'usuarios',
  documents: 'documentos',
  expenses: 'gastos',
  fines: 'multas',
  incidents: 'incidentes',
  messages: 'mensajes',
  purchases: 'compras',
  requests: 'solicitudes',
  auth: 'la plataforma',
}

export function AdminDashboard() {
  const { currentCondominiumId, currentMembership } = useAuth()

  const statsQuery = useAdminDashboard(currentCondominiumId)
  const monthlyQuery = useExpensesMonthly(currentCondominiumId, 6)
  const byCategoryQuery = useExpensesByCategory(currentCondominiumId)
  const requestsQuery = useRequestsByStatus(currentCondominiumId)
  const incidentsQuery = useIncidentsByType(currentCondominiumId)
  const finesQuery = useFinesByStatus(currentCondominiumId)
  const activityQuery = useRecentActivity(currentCondominiumId, 10)
  const alertsQuery = useActiveAlerts(currentCondominiumId, 5)

  const stats = statsQuery.data
  const loading = statsQuery.isLoading

  return (
    <>
      <PageHeader
        title={`Dashboard - ${currentMembership?.condominium_name ?? 'Condominio'}`}
        subtitle="Resumen operativo y financiero del condominio en tiempo real."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Apartamentos"
            value={formatNumber(stats?.apartments ?? 0)}
            icon={<DoorOpen size={20} />}
            tone="blue"
            loading={loading}
            to="/apartments"
            footer={`${formatNumber(stats?.occupied_apartments ?? 0)} ocupados · ${formatNumber(stats?.buildings ?? 0)} bloques`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Residentes"
            value={formatNumber(stats?.residents ?? 0)}
            icon={<UsersRound size={20} />}
            tone="green"
            loading={loading}
            to="/residents"
            footer={`${formatNumber(stats?.vehicles ?? 0)} vehiculos · ${formatNumber(stats?.pets ?? 0)} mascotas`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Propietarios"
            value={formatNumber(stats?.owners ?? 0)}
            icon={<UserCheck size={20} />}
            tone="purple"
            loading={loading}
            to="/users"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Arrendatarios"
            value={formatNumber(stats?.tenants ?? 0)}
            icon={<Users size={20} />}
            tone="slate"
            loading={loading}
            to="/users"
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Alertas activas"
            value={formatNumber(stats?.active_alerts ?? 0)}
            icon={<Siren size={20} />}
            tone="red"
            loading={loading}
            to="/alerts"
            footer={`${formatNumber(stats?.critical_alerts ?? 0)} criticas`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Solicitudes pendientes"
            value={formatNumber(stats?.pending_requests ?? 0)}
            icon={<Building2 size={20} />}
            tone="orange"
            loading={loading}
            to="/requests"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Incidentes abiertos"
            value={formatNumber(stats?.open_incidents ?? 0)}
            icon={<ShieldAlert size={20} />}
            tone="red"
            loading={loading}
            to="/incidents"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Multas pendientes"
            value={formatNumber(stats?.pending_fines ?? 0)}
            icon={<Gavel size={20} />}
            tone="purple"
            loading={loading}
            to="/fines"
            footer={`${formatCompactCurrency(stats?.pending_fines_amount ?? 0)} por cobrar`}
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Gastos del mes"
            value={formatCompactCurrency(stats?.month_expenses ?? 0)}
            icon={<Receipt size={20} />}
            tone="orange"
            loading={loading}
            to="/expenses"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            title="Compras del mes"
            value={formatCompactCurrency(stats?.month_purchases ?? 0)}
            icon={<ShoppingCart size={20} />}
            tone="green"
            loading={loading}
            to="/purchases"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <AreaChartCard
            title="Gastos mensuales"
            subtitle="Ultimos 6 meses"
            currency
            loading={monthlyQuery.isLoading}
            data={(monthlyQuery.data ?? []).map((point) => ({
              name: point.period,
              value: point.total,
            }))}
          />
        </Col>
        <Col xs={24} lg={8}>
          <PieChartCard
            title="Gastos por categoria"
            subtitle="Historico acumulado"
            currency
            loading={byCategoryQuery.isLoading}
            data={(byCategoryQuery.data ?? []).map((point) => ({
              name: point.category,
              value: point.total,
              color: point.color,
            }))}
          />
        </Col>

        <Col xs={24} lg={8}>
          <BarChartCard
            title="Solicitudes por estado"
            loading={requestsQuery.isLoading}
            data={(requestsQuery.data ?? []).map((point) => ({
              name: REQUEST_STATUS[point.key as RequestStatus]?.label ?? point.key,
              value: point.value,
              color: REQUEST_STATUS[point.key as RequestStatus]?.hex,
            }))}
          />
        </Col>
        <Col xs={24} lg={8}>
          <BarChartCard
            title="Incidentes por tipo"
            loading={incidentsQuery.isLoading}
            data={(incidentsQuery.data ?? []).map((point) => ({
              name: INCIDENT_TYPE[point.key as IncidentType]?.label ?? point.key,
              value: point.value,
              color: INCIDENT_TYPE[point.key as IncidentType]?.hex,
            }))}
          />
        </Col>
        <Col xs={24} lg={8}>
          <PieChartCard
            title="Multas por estado"
            loading={finesQuery.isLoading}
            data={(finesQuery.data ?? []).map((point) => ({
              name: FINE_STATUS[point.key as FineStatus]?.label ?? point.key,
              value: point.value,
              color: FINE_STATUS[point.key as FineStatus]?.hex,
            }))}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={<span className="text-sm font-semibold">Alertas activas</span>}
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
              <EmptyState title="Sin alertas activas" description="El condominio no tiene alertas vigentes." />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="surface-card h-full"
            title={<span className="text-sm font-semibold">Actividad reciente</span>}
            extra={<Link to="/activity">Ver auditoria</Link>}
          >
            {activityQuery.data && activityQuery.data.length > 0 ? (
              <Timeline
                items={activityQuery.data.map((log) => ({
                  color:
                    log.action === 'DELETE'
                      ? 'red'
                      : log.action === 'CREATE' || log.action.endsWith('_CREATED')
                        ? 'green'
                        : 'blue',
                  children: (
                    <div>
                      <Text className="text-sm">
                        <strong>{log.user?.full_name ?? 'Sistema'}</strong>{' '}
                        {ACTION_LABEL[log.action] ?? log.action.toLowerCase()}{' '}
                        {ENTITY_LABEL[log.entity] ?? log.entity}
                      </Text>
                      <div className="text-xs text-slate-400">{formatDateTime(log.created_at)}</div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <EmptyState
                title="Sin actividad registrada"
                description="Las acciones sobre el condominio apareceran aqui."
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  )
}

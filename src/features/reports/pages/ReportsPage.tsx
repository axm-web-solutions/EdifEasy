import { Col, Row, Select, Space } from 'antd'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { AreaChartCard, BarChartCard, PieChartCard } from '@/components/charts/charts'
import { useAuth } from '@/hooks/useAuth'
import { useAdminDashboard } from '@/hooks/useDashboard'
import { useExpensesByCategory, useExpensesMonthly } from '@/hooks/useExpenses'
import {
  useAlertsByType,
  useFinesAmountByStatus,
  useIncidentsByStatus,
  useIncidentsByType,
  useRequestsByStatus,
  useRequestsByType,
} from '@/hooks/useReports'
import {
  ALERT_TYPE,
  FINE_STATUS,
  INCIDENT_STATUS,
  INCIDENT_TYPE,
  REQUEST_STATUS,
  REQUEST_TYPE,
} from '@/constants/enums'
import { formatCompactCurrency, formatNumber } from '@/utils/format'
import type {
  AlertType,
  FineStatus,
  IncidentStatus,
  IncidentType,
  RequestStatus,
  RequestType,
} from '@/types/database'

export function ReportsPage() {
  const { currentCondominiumId } = useAuth()
  const [months, setMonths] = useState(6)

  const statsQuery = useAdminDashboard(currentCondominiumId)
  const monthlyQuery = useExpensesMonthly(currentCondominiumId, months)
  const byCategoryQuery = useExpensesByCategory(currentCondominiumId)
  const requestsStatusQuery = useRequestsByStatus(currentCondominiumId)
  const requestsTypeQuery = useRequestsByType(currentCondominiumId)
  const incidentsTypeQuery = useIncidentsByType(currentCondominiumId)
  const incidentsStatusQuery = useIncidentsByStatus(currentCondominiumId)
  const finesAmountQuery = useFinesAmountByStatus(currentCondominiumId)
  const alertsTypeQuery = useAlertsByType(currentCondominiumId)

  const stats = statsQuery.data

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Indicadores consolidados del condominio."
        actions={
          <Space>
            <Select
              value={months}
              onChange={setMonths}
              options={[
                { value: 3, label: 'Ultimos 3 meses' },
                { value: 6, label: 'Ultimos 6 meses' },
                { value: 12, label: 'Ultimos 12 meses' },
              ]}
              style={{ width: 180 }}
            />
          </Space>
        }
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={12} lg={6}>
          <StatCard
            title="Apartamentos"
            value={formatNumber(stats?.apartments ?? 0)}
            icon={<span className="text-sm font-semibold">APT</span>}
            tone="blue"
            loading={statsQuery.isLoading}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="Residentes"
            value={formatNumber(stats?.residents ?? 0)}
            icon={<span className="text-sm font-semibold">RES</span>}
            tone="green"
            loading={statsQuery.isLoading}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="Gastos del mes"
            value={formatCompactCurrency(stats?.month_expenses ?? 0)}
            icon={<span className="text-sm font-semibold">$</span>}
            tone="orange"
            loading={statsQuery.isLoading}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="Multas pendientes"
            value={formatCompactCurrency(stats?.pending_fines_amount ?? 0)}
            icon={<span className="text-sm font-semibold">MUL</span>}
            tone="purple"
            loading={statsQuery.isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <AreaChartCard
            title="Evolucion de gastos"
            subtitle={`Ultimos ${months} meses`}
            currency
            loading={monthlyQuery.isLoading}
            data={(monthlyQuery.data ?? []).map((point) => ({ name: point.period, value: point.total }))}
          />
        </Col>
        <Col xs={24} lg={8}>
          <PieChartCard
            title="Gastos por categoria"
            currency
            loading={byCategoryQuery.isLoading}
            data={(byCategoryQuery.data ?? []).map((point) => ({
              name: point.category,
              value: point.total,
              color: point.color,
            }))}
          />
        </Col>

        <Col xs={24} lg={12}>
          <BarChartCard
            title="Solicitudes por estado"
            loading={requestsStatusQuery.isLoading}
            data={(requestsStatusQuery.data ?? []).map((point) => ({
              name: REQUEST_STATUS[point.key as RequestStatus]?.label ?? point.key,
              value: point.value,
              color: REQUEST_STATUS[point.key as RequestStatus]?.hex,
            }))}
          />
        </Col>
        <Col xs={24} lg={12}>
          <BarChartCard
            title="Solicitudes por tipo"
            loading={requestsTypeQuery.isLoading}
            data={(requestsTypeQuery.data ?? []).map((point) => ({
              name: REQUEST_TYPE[point.key as RequestType]?.label ?? point.key,
              value: point.value,
              color: REQUEST_TYPE[point.key as RequestType]?.hex,
            }))}
          />
        </Col>

        <Col xs={24} lg={12}>
          <BarChartCard
            title="Incidentes por tipo"
            loading={incidentsTypeQuery.isLoading}
            data={(incidentsTypeQuery.data ?? []).map((point) => ({
              name: INCIDENT_TYPE[point.key as IncidentType]?.label ?? point.key,
              value: point.value,
              color: INCIDENT_TYPE[point.key as IncidentType]?.hex,
            }))}
          />
        </Col>
        <Col xs={24} lg={12}>
          <PieChartCard
            title="Incidentes por estado"
            loading={incidentsStatusQuery.isLoading}
            data={(incidentsStatusQuery.data ?? []).map((point) => ({
              name: INCIDENT_STATUS[point.key as IncidentStatus]?.label ?? point.key,
              value: point.value,
              color: INCIDENT_STATUS[point.key as IncidentStatus]?.hex,
            }))}
          />
        </Col>

        <Col xs={24} lg={12}>
          <BarChartCard
            title="Multas por estado (valor)"
            currency
            loading={finesAmountQuery.isLoading}
            data={(finesAmountQuery.data ?? []).map((point) => ({
              name: FINE_STATUS[point.key as FineStatus]?.label ?? point.key,
              value: point.value,
              color: FINE_STATUS[point.key as FineStatus]?.hex,
            }))}
          />
        </Col>
        <Col xs={24} lg={12}>
          <BarChartCard
            title="Alertas por tipo"
            loading={alertsTypeQuery.isLoading}
            data={(alertsTypeQuery.data ?? []).map((point) => ({
              name: ALERT_TYPE[point.key as AlertType]?.label ?? point.key,
              value: point.value,
              color: ALERT_TYPE[point.key as AlertType]?.hex,
            }))}
          />
        </Col>
      </Row>
    </>
  )
}

import { Alert, Button, Card, Col, Row, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { BadgeCheck, CalendarClock, CreditCard, DoorOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ErrorState, PageSkeleton } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useCheckout, usePayments, useSubscriptionQuote } from '@/hooks/usePayments'
import { PAYMENT_STATUS, PLAN_PERIOD } from '@/constants/enums'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { PlanPeriod } from '@/types/database'
import type { PaymentWithRelations } from '@/types/models'

const { Text } = Typography

/**
 * Plan del sistema: el administrador paga EdiFeasy por todo el conjunto con un
 * unico pago mensual, semestral o anual. El precio depende del numero de
 * apartamentos y lo calcula la base de datos (`subscription_quote`).
 */
export function PlansPage() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const quoteQuery = useSubscriptionQuote(currentCondominiumId)
  const paymentsQuery = usePayments(currentCondominiumId, 'SUBSCRIPTION')
  const { paySubscription } = useCheckout()

  if (quoteQuery.isLoading) return <PageSkeleton />
  if (quoteQuery.isError || !quoteQuery.data) {
    return (
      <ErrorState
        title="No se pudo calcular el plan"
        description={quoteQuery.error ? getErrorMessage(quoteQuery.error) : undefined}
        onRetry={() => void quoteQuery.refetch()}
      />
    )
  }

  const quote = quoteQuery.data
  const current = quote.current
  const today = dayjs().startOf('day')
  const active = current ? !dayjs(current.ends_at).isBefore(today) : false
  const daysLeft = current && active ? dayjs(current.ends_at).diff(today, 'day') : 0

  const pay = (period: PlanPeriod) => {
    if (!currentCondominiumId) return
    paySubscription.mutate({ condominiumId: currentCondominiumId, period })
  }

  const columns: ColumnsType<PaymentWithRelations> = [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Plan',
      dataIndex: 'plan_period',
      key: 'plan_period',
      width: 120,
      render: (value: PlanPeriod | null) => (value ? PLAN_PERIOD[value].label : '—'),
    },
    {
      title: 'Apartamentos',
      dataIndex: 'apartments_count',
      key: 'apartments_count',
      width: 120,
      align: 'right',
      render: (value: number | null) => formatNumber(value ?? 0),
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right',
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: PaymentWithRelations['status']) => (
        <Tag color={PAYMENT_STATUS[value].color} bordered={false}>
          {PAYMENT_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Pagado por',
      key: 'payer',
      width: 180,
      render: (_, row) => row.payer?.full_name ?? '—',
    },
    {
      title: 'Referencia',
      dataIndex: 'reference',
      key: 'reference',
      width: 220,
      render: (value: string) => (
        <Text copyable className="text-xs">
          {value}
        </Text>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle={`Suscripcion de ${currentMembership?.condominium_name ?? 'tu conjunto'} a EdiFeasy: un solo pago por todo el conjunto.`}
        dataTour="page-header"
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} md={8}>
          <StatCard
            title="Estado del plan"
            value={active ? 'Activo' : current ? 'Vencido' : 'Sin plan'}
            icon={<BadgeCheck size={20} />}
            tone={active ? 'green' : 'red'}
            footer={
              current
                ? active
                  ? `${PLAN_PERIOD[current.plan_period].label} · vence el ${formatDate(current.ends_at)} (${daysLeft} dias)`
                  : `Vencio el ${formatDate(current.ends_at)}`
                : 'Elige un plan para activar el sistema'
            }
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="Apartamentos del conjunto"
            value={formatNumber(quote.apartments_count)}
            icon={<DoorOpen size={20} />}
            tone="blue"
            footer="Base para calcular el valor del plan"
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="Precio por apartamento"
            value={`${formatCurrency(quote.unit_price)} / mes`}
            icon={<CalendarClock size={20} />}
            tone="purple"
            footer={
              quote.apartments_count < 80
                ? 'Tarifa para conjuntos de menos de 80 apartamentos'
                : 'Tarifa para conjuntos de 80 apartamentos o mas'
            }
          />
        </Col>
      </Row>

      {quote.apartments_count === 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="El conjunto no tiene apartamentos registrados"
          description="Registra los apartamentos en Estructura para poder calcular y pagar el plan."
        />
      ) : null}

      {active ? (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message={`Si pagas ahora, el nuevo periodo empieza cuando termine el actual (${formatDate(current?.ends_at)}).`}
        />
      ) : null}

      <Row gutter={[16, 16]} className="mb-4">
        {quote.plans.map((plan) => (
          <Col xs={24} md={8} key={plan.period}>
            <Card
              className="surface-card h-full"
              data-tour={plan.period === 'MONTHLY' ? 'plan-card' : undefined}
            >
              <div className="flex h-full flex-col">
                <p className="m-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {PLAN_PERIOD[plan.period].label}
                </p>
                <p className="m-0 mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                  {formatCurrency(plan.amount)}
                </p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  {PLAN_PERIOD[plan.period].description}
                </p>
                <ul className="mb-4 mt-4 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  <li>
                    {formatNumber(quote.apartments_count)} apartamentos ×{' '}
                    {formatCurrency(quote.unit_price)}
                  </li>
                  <li>
                    {plan.months} {plan.months === 1 ? 'mes' : 'meses'} de servicio
                  </li>
                  <li>Todos los modulos y usuarios del conjunto</li>
                </ul>
                <Button
                  type="primary"
                  block
                  icon={<CreditCard size={16} />}
                  disabled={plan.amount <= 0 || paySubscription.isPending}
                  loading={
                    paySubscription.isPending && paySubscription.variables?.period === plan.period
                  }
                  onClick={() => pay(plan.period)}
                >
                  Pagar {PLAN_PERIOD[plan.period].label.toLowerCase()}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        className="surface-card"
        title={<span className="text-sm font-semibold">Historial de pagos del plan</span>}
      >
        <Table<PaymentWithRelations>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={paymentsQuery.data ?? []}
          loading={paymentsQuery.isLoading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 1070 }}
          locale={{ emptyText: 'Aun no hay pagos del plan' }}
        />
        <p className="m-0 mt-3 text-xs text-slate-400">
          Los pagos se procesan con Wompi (PSE, tarjeta, Nequi o Boton Bancolombia).
        </p>
      </Card>
    </>
  )
}

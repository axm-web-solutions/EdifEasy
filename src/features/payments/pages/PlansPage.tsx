import { Alert, Button, Card, Col, Row, Tag } from 'antd'
import { BadgeCheck, CalendarClock, CreditCard, DoorOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { AmountList, AmountListItem } from '@/components/ui/AmountListItem'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states'
import { usePlansViewModel } from '../viewmodels/usePlansViewModel'

/** Vista de Planes: solo dibuja lo que entrega `usePlansViewModel`. */
export function PlansPage() {
  const vm = usePlansViewModel()

  if (vm.loading) return <PageSkeleton />
  if (vm.error)
    return (
      <ErrorState title="No se pudo calcular el plan" description={vm.error} onRetry={vm.retry} />
    )

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle={`Suscripcion de ${vm.condominiumName} a EdiFeasy: un solo pago por todo el conjunto.`}
        dataTour="page-header"
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} lg={8}>
          <StatCard
            title="Estado del plan"
            value={vm.status.label}
            icon={<BadgeCheck size={20} />}
            tone={vm.status.state === 'active' ? 'green' : 'red'}
            footer={vm.status.footer}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Apartamentos del conjunto"
            value={vm.pricing.apartments}
            icon={<DoorOpen size={20} />}
            tone="blue"
            footer="Base para calcular el valor del plan"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Precio por apartamento"
            value={vm.pricing.unitPrice}
            icon={<CalendarClock size={20} />}
            tone="purple"
            footer={vm.pricing.tariff}
          />
        </Col>
      </Row>

      {vm.pricing.noApartments ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="El conjunto no tiene apartamentos registrados"
          description="Registra los apartamentos en Estructura para poder calcular y pagar el plan."
        />
      ) : null}

      {vm.status.renewNotice ? (
        <Alert type="info" showIcon className="mb-4" message={vm.status.renewNotice} />
      ) : null}

      <Row gutter={[16, 16]} className="mb-4">
        {vm.plans.map((plan, index) => (
          <Col xs={24} lg={8} key={plan.period}>
            <Card className="surface-card h-full" data-tour={index === 0 ? 'plan-card' : undefined}>
              <div className="flex h-full flex-col">
                <p className="m-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {plan.label}
                </p>
                <p className="m-0 mt-2 text-2xl font-semibold tabular-nums text-slate-900 xl:text-3xl">
                  {plan.amount}
                </p>
                <p className="m-0 mt-1 text-sm text-slate-500">{plan.description}</p>
                <ul className="mb-4 mt-4 flex-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  <li>{plan.breakdown}</li>
                  <li>{plan.duration}</li>
                  <li>Todos los modulos y usuarios del conjunto</li>
                </ul>
                <Button
                  type="primary"
                  block
                  icon={<CreditCard size={16} />}
                  disabled={!plan.payable || vm.paying}
                  loading={plan.paying}
                  onClick={() => vm.pay(plan.period)}
                >
                  Pagar {plan.label.toLowerCase()}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <SectionCard title="Historial de pagos del plan">
        {vm.history.items.length === 0 ? (
          <EmptyState title="Aun no hay pagos del plan" />
        ) : (
          <AmountList>
            {vm.history.items.map((item) => (
              <AmountListItem
                key={item.id}
                title={item.title}
                description={item.description}
                status={
                  <Tag color={item.status.color} bordered={false}>
                    {item.status.label}
                  </Tag>
                }
                amount={item.amount}
              />
            ))}
          </AmountList>
        )}
        <p className="m-0 mt-3 text-xs text-slate-500">
          Los pagos se procesan con Wompi (PSE, tarjeta, Nequi o Boton Bancolombia).
        </p>
      </SectionCard>
    </>
  )
}

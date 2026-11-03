import { Button, Card, Col, Row, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { Building, CircleDashed, ExternalLink, KeyRound, Receipt, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { useAgencyDashboardViewModel } from '../viewmodels/useAgencyDashboardViewModel'

export function AgencyDashboard() {
  const vm = useAgencyDashboardViewModel()

  return (
    <div>
      <PageHeader
        title={vm.name}
        subtitle="Tus propiedades, contratos y pagos de un vistazo."
        dataTour="page-header"
        actions={
          vm.storeUrl ? (
            <Button
              icon={<ExternalLink size={16} />}
              href={vm.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver mi tienda
            </Button>
          ) : null
        }
      />

      {vm.setup.length ? (
        <Card className="surface-card !mb-4" title="Deja tu inmobiliaria lista">
          <ul className="m-0 list-none space-y-2 p-0">
            {vm.setup.map((step) => (
              <li key={step.key}>
                <Link to={step.to} className="flex items-center gap-2 text-sm text-slate-700">
                  <CircleDashed size={16} className="text-brand-text" /> {step.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Propiedades"
              value={String(vm.stats.total)}
              icon={<Building size={20} />}
              tone="blue"
              to="/agency/properties"
              footer={`${vm.stats.available} disponibles · ${vm.stats.published} en la tienda`}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Ocupacion"
              value={`${vm.stats.occupancy}%`}
              icon={<KeyRound size={20} />}
              tone="green"
              to="/agency/leases"
              footer={`${vm.stats.rented} arrendadas`}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Por cobrar"
              value={vm.charges.pendingTotal}
              icon={<Receipt size={20} />}
              tone="orange"
              to="/agency/charges"
              footer={`${vm.charges.overdueCount} vencidos · ${vm.charges.overdueTotal}`}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              title="Interesados nuevos"
              value={String(vm.newLeads)}
              icon={<UserPlus size={20} />}
              tone="purple"
              to="/agency/leads"
            />
          </Col>
        </Row>
      )}
    </div>
  )
}

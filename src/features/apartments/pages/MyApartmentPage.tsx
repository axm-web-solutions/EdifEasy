import { Button, Card, Col, Descriptions, Row, Tag } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, PageSkeleton } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useResidentDashboard } from '@/hooks/useDashboard'
import { APARTMENT_STATUS } from '@/constants/enums'
import type { ApartmentStatus } from '@/types/database'

/**
 * "Mi apartamento" para propietarios y arrendatarios.
 * Con un solo apartamento redirige directo a su ficha CRM; con varios
 * muestra el selector.
 */
export function MyApartmentPage() {
  const navigate = useNavigate()
  const { currentCondominiumId } = useAuth()
  const statsQuery = useResidentDashboard(currentCondominiumId)

  if (statsQuery.isLoading) return <PageSkeleton />

  const apartments = statsQuery.data?.apartments ?? []

  if (apartments.length === 0) {
    return (
      <>
        <PageHeader title="Mi apartamento" />
        <Card className="surface-card">
          <EmptyState
            title="Aun no tienes un apartamento asignado"
            description="El administrador del condominio debe vincular tu usuario como propietario, arrendatario o residente."
            action={
              <Button type="primary" onClick={() => navigate('/messages')}>
                Escribir a la administracion
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  if (apartments.length === 1) {
    return <Navigate to={`/apartments/${apartments[0].id}`} replace />
  }

  return (
    <>
      <PageHeader
        title="Mis apartamentos"
        subtitle="Selecciona el apartamento que deseas consultar."
      />

      <Row gutter={[16, 16]}>
        {apartments.map((apartment) => (
          <Col xs={24} md={12} xl={8} key={apartment.id}>
            <Card
              className="surface-card h-full"
              hoverable
              onClick={() => navigate(`/apartments/${apartment.id}`)}
              title={
                <div className="flex items-center gap-2">
                  <Home size={16} className="text-blue-600" />
                  <span>
                    {apartment.building_name} · Apto {apartment.number}
                  </span>
                </div>
              }
              extra={
                <Tag
                  color={APARTMENT_STATUS[apartment.status as ApartmentStatus]?.color}
                  bordered={false}
                >
                  {APARTMENT_STATUS[apartment.status as ApartmentStatus]?.label ?? apartment.status}
                </Tag>
              }
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Piso">{apartment.floor}</Descriptions.Item>
                <Descriptions.Item label="Area">
                  {apartment.area ? `${apartment.area} m2` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Habitaciones">{apartment.bedrooms ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Banos">{apartment.bathrooms ?? '—'}</Descriptions.Item>
              </Descriptions>

              <Button type="primary" block className="mt-2">
                Abrir ficha completa
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  )
}

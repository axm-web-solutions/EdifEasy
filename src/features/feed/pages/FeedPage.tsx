import { Button, Col, Row, Skeleton } from 'antd'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ContactFormDrawer } from '@/features/marketplace/components/ContactFormDrawer'
import { useContactFormViewModel } from '@/features/marketplace/viewmodels/useContactFormViewModel'
import { FeedComposer } from '../components/FeedComposer'
import { FeedPostCard } from '../components/FeedPostCard'
import { EmergencyCard } from '../components/EmergencyCard'
import { CriticalAlerts, QuickAccessCard } from '../components/ResidentSummary'
import { useFeedViewModel } from '../viewmodels/useFeedViewModel'
import { useEmergencyViewModel } from '../viewmodels/useEmergencyViewModel'
import { useResidentSummaryViewModel } from '../viewmodels/useResidentSummaryViewModel'

/**
 * Inicio tipo feed: publicaciones de la administracion, numeros de emergencia
 * y (para residentes) sus accesos rapidos. Es el home de propietarios y
 * arrendatarios y la pagina /feed del resto de roles.
 */
export function FeedPage() {
  const feed = useFeedViewModel()
  const emergency = useEmergencyViewModel()
  const summary = useResidentSummaryViewModel()
  const contactForm = useContactFormViewModel()

  return (
    <>
      <PageHeader title={feed.greeting} subtitle={feed.subtitle} dataTour="page-header" />

      {summary.visible ? <CriticalAlerts vm={summary} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15} xl={16}>
          <div className="space-y-4" data-tour="feed-posts">
            {feed.composer ? <FeedComposer composer={feed.composer} /> : null}

            {feed.status === 'loading' ? (
              <Skeleton active avatar paragraph={{ rows: 4 }} />
            ) : feed.status === 'error' ? (
              <ErrorState description="No se pudo cargar el feed." onRetry={feed.retry} />
            ) : feed.status === 'disabled' ? (
              <EmptyState
                title="Publicaciones no disponibles"
                description="Las publicaciones estan desactivadas para tu perfil en este conjunto."
              />
            ) : feed.status === 'empty' ? (
              <EmptyState
                title="Aun no hay publicaciones"
                description={
                  feed.composer
                    ? 'Publica el primer mensaje para la comunidad.'
                    : 'Aqui veras los anuncios de la administracion.'
                }
              />
            ) : (
              feed.posts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  onTogglePin={feed.togglePin}
                  onRemove={feed.remove}
                />
              ))
            )}

            {feed.hasMore ? (
              <div className="flex justify-center">
                <Button onClick={feed.loadMore} loading={feed.loadingMore}>
                  Cargar mas publicaciones
                </Button>
              </div>
            ) : null}
          </div>
        </Col>

        <Col xs={24} lg={9} xl={8}>
          <div className="space-y-4 lg:sticky lg:top-4">
            <EmergencyCard
              vm={emergency}
              onAdd={() => contactForm.openNew('EMERGENCY')}
              onEdit={contactForm.openEdit}
            />
            {summary.visible ? <QuickAccessCard vm={summary} /> : null}
          </div>
        </Col>
      </Row>

      {contactForm.canManage ? <ContactFormDrawer form={contactForm} /> : null}
    </>
  )
}

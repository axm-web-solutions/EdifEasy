import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageSkeleton } from '@/components/ui/states'

// Cada variante en su propio chunk: un residente no descarga las graficas
// (recharts) ni el mapa (leaflet) del panel de administracion.
const FeedPage = lazy(() =>
  import('@/features/feed/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
)
const AdminDashboard = lazy(() =>
  import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)
const OperationalDashboard = lazy(() =>
  import('./OperationalDashboard').then((m) => ({ default: m.OperationalDashboard })),
)

/**
 * El dashboard cambia por completo segun el rol del usuario en el condominio
 * activo. Propietarios y arrendatarios tienen un inicio tipo feed. Cada
 * variante consulta solo lo que su rol puede leer (RLS refuerza esa separacion).
 */
export function DashboardPage() {
  const { role, loadingContext } = useAuth()

  if (loadingContext) return <PageSkeleton />

  let content
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
    case 'SPOKESPERSON':
      content = <AdminDashboard />
      break
    case 'SECURITY':
    case 'SERVICE_STAFF':
      content = <OperationalDashboard />
      break
    // El contador trabaja solo en Finanzas; los residentes tienen el feed.
    case 'ACCOUNTANT':
      return <Navigate to="/finances" replace />
    case 'OWNER':
    case 'TENANT':
      return <Navigate to="/feed" replace />
    default:
      content = <FeedPage />
  }

  return <Suspense fallback={<PageSkeleton />}>{content}</Suspense>
}

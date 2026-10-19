import { useAuth } from '@/hooks/useAuth'
import { PageSkeleton } from '@/components/ui/states'
import { FeedPage } from '@/features/feed/pages/FeedPage'
import { AdminDashboard } from './AdminDashboard'
import { OperationalDashboard } from './OperationalDashboard'

/**
 * El dashboard cambia por completo segun el rol del usuario en el condominio
 * activo. Propietarios y arrendatarios tienen un inicio tipo feed. Cada
 * variante consulta solo lo que su rol puede leer (RLS refuerza esa separacion).
 */
export function DashboardPage() {
  const { role, loadingContext } = useAuth()

  if (loadingContext) return <PageSkeleton />

  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
    case 'SPOKESPERSON':
      return <AdminDashboard />
    case 'SECURITY':
    case 'SERVICE_STAFF':
      return <OperationalDashboard />
    default:
      return <FeedPage />
  }
}

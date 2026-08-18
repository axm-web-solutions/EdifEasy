import { useAuth } from '@/hooks/useAuth'
import { PageSkeleton } from '@/components/ui/states'
import { AdminDashboard } from './AdminDashboard'
import { ResidentDashboard } from './ResidentDashboard'
import { OperationalDashboard } from './OperationalDashboard'

/**
 * El dashboard cambia por completo segun el rol del usuario en el condominio
 * activo. Cada variante consulta solo lo que su rol puede leer (RLS refuerza
 * esa separacion en la base de datos).
 */
export function DashboardPage() {
  const { role, loadingContext } = useAuth()

  if (loadingContext) return <PageSkeleton />

  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
    case 'SPOKESPERSON':
      return <AdminDashboard />
    case 'OWNER':
    case 'TENANT':
      return <ResidentDashboard />
    case 'SECURITY':
    case 'SERVICE_STAFF':
      return <OperationalDashboard />
    default:
      return <ResidentDashboard />
  }
}

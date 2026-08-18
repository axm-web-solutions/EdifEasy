import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '@/hooks/useAuth'
import { AccessDenied } from '@/components/ui/states'
import type { RoleCode } from '@/types/database'
import type { PermissionKey } from '@/constants/roles'

function FullPageLoader({ tip = 'Cargando...' }: { tip?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <Spin size="large" tip={tip}>
        <div className="h-24 w-24" />
      </Spin>
    </div>
  )
}

/** Rutas que exigen sesion activa. */
export function ProtectedRoute() {
  const { session, initializing, loadingContext, memberships, isSuperAdmin } = useAuth()
  const location = useLocation()

  if (initializing) return <FullPageLoader tip="Verificando sesion..." />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (loadingContext) return <FullPageLoader tip="Cargando tu informacion..." />

  if (memberships.length === 0 && !isSuperAdmin) {
    return <Navigate to="/sin-condominio" replace />
  }

  return <Outlet />
}

/** Rutas publicas (login, registro): redirigen si ya hay sesion. */
export function PublicOnlyRoute() {
  const { session, initializing } = useAuth()

  if (initializing) return <FullPageLoader />
  if (session) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

/**
 * Guarda por rol/permiso. La seguridad real la aplica RLS en PostgreSQL;
 * esto evita mostrar pantallas que el backend rechazaria.
 */
export function RoleGuard({
  roles,
  permission,
  children,
}: {
  roles?: RoleCode[]
  permission?: PermissionKey
  children: ReactNode
}) {
  const { hasRole, hasPermission } = useAuth()

  if (roles && roles.length > 0 && !hasRole(roles)) return <AccessDenied />
  if (permission && !hasPermission(permission)) return <AccessDenied />

  return <>{children}</>
}

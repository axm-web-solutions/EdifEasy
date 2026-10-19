import type { ReactNode } from 'react'
import { LegalConsentGate } from '@/features/legal/components/LegalConsentGate'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '@/hooks/useAuth'
import { AccessDenied } from '@/components/ui/states'
import type { RoleCode } from '@/types/database'
import type { PermissionKey } from '@/constants/roles'
import type { ModuleKey } from '@/constants/modules'
import { useModuleAccess } from '@/hooks/useModules'
import { useMyAcceptances } from '@/hooks/useLegal'

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
  // Las aceptaciones legales se piden en paralelo con el contexto: un solo cargador.
  const acceptances = useMyAcceptances(session?.user.id ?? null)

  // Mismo texto en todas las fases de carga: se ve como un solo cargador continuo.
  if (initializing) return <FullPageLoader tip="Cargando tu informacion..." />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (loadingContext || acceptances.isLoading)
    return <FullPageLoader tip="Cargando tu informacion..." />

  if (memberships.length === 0 && !isSuperAdmin) {
    return (
      <LegalConsentGate>
        <Navigate to="/sin-condominio" replace />
      </LegalConsentGate>
    )
  }

  return (
    <LegalConsentGate>
      <Outlet />
    </LegalConsentGate>
  )
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
  module,
  children,
}: {
  roles?: RoleCode[]
  permission?: PermissionKey
  /** Modulo configurable por el SUPER_ADMIN; si esta desactivado para el rol no se muestra. */
  module?: ModuleKey
  children: ReactNode
}) {
  const { hasRole, hasPermission } = useAuth()
  const { isModuleEnabled } = useModuleAccess()

  if (roles && roles.length > 0 && !hasRole(roles)) return <AccessDenied />
  if (permission && !hasPermission(permission)) return <AccessDenied />
  if (module && !isModuleEnabled(module)) {
    return (
      <AccessDenied description="Este modulo no esta habilitado para tu rol en este conjunto." />
    )
  }

  return <>{children}</>
}

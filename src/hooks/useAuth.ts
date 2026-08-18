import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/providers/AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return context
}

/**
 * Perfil del usuario autenticado.
 *
 * @public Forma parte de la API de hooks requerida por la especificacion.
 * Es un envoltorio delgado sobre `useAuth`; se mantiene aunque las paginas
 * actuales usen `useAuth` directamente.
 */
export function useCurrentUser() {
  const { user, profile, loadingContext } = useAuth()
  return { user, profile, loading: loadingContext }
}

/**
 * Condominio activo y utilidades para cambiarlo.
 *
 * @public Parte de la API de hooks requerida por la especificacion.
 */
export function useCurrentCondominium() {
  const { currentCondominiumId, currentMembership, memberships, setCurrentCondominium } = useAuth()
  return {
    condominiumId: currentCondominiumId,
    membership: currentMembership,
    memberships,
    setCurrentCondominium,
    condominiumName: currentMembership?.condominium_name ?? null,
  }
}

/**
 * Rol activo del usuario en el condominio seleccionado.
 *
 * @public Parte de la API de hooks requerida por la especificacion.
 */
export function useUserRole() {
  const { role, isSuperAdmin, hasRole, hasPermission } = useAuth()
  return { role, isSuperAdmin, hasRole, hasPermission }
}

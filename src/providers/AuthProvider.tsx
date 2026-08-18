import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { authService, type SignInInput, type SignUpInput } from '@/services/authService'
import { condominiumService } from '@/services/condominiumService'
import { invitationService } from '@/services/invitationService'
import { PERMISSIONS, type PermissionKey } from '@/constants/roles'
import type { RoleCode } from '@/types/database'
import type { Membership } from '@/types/models'
import { AuthContext, type AuthContextValue } from './AuthContext'

const CONDOMINIUM_STORAGE_KEY = 'edifeasy.currentCondominium'

function readStoredCondominium(): string | null {
  try {
    return window.localStorage.getItem(CONDOMINIUM_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeCondominium(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CONDOMINIUM_STORAGE_KEY, id)
    else window.localStorage.removeItem(CONDOMINIUM_STORAGE_KEY)
  } catch {
    // localStorage puede estar bloqueado (modo privado); no es critico.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [selectedCondominium, setSelectedCondominium] = useState<string | null>(readStoredCondominium)

  // --- Sesion -------------------------------------------------------------
  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session)
      })
      .catch((error: unknown) => {
        logger.error('No se pudo recuperar la sesion', error)
      })
      .finally(() => {
        if (mounted) setInitializing(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_OUT') {
        storeCondominium(null)
        setSelectedCondominium(null)
        queryClient.clear()
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [queryClient])

  // --- Contexto del usuario (perfil + membresias + roles) -----------------
  const userId = session?.user?.id ?? null

  const contextQuery = useQuery({
    queryKey: ['user-context', userId],
    queryFn: () => authService.getUserContext(),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const isSuperAdmin = contextQuery.data?.is_super_admin ?? false

  /**
   * Un usuario invitado por un administrador obtiene su membresia al entrar.
   * Se intenta una sola vez por sesion y solo si todavia no tiene ninguna:
   * asi la invitacion se convierte en acceso sin pasar por aprobacion.
   */
  const claimedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || contextQuery.isLoading || !contextQuery.data) return
    if (claimedRef.current === userId) return
    if ((contextQuery.data.memberships ?? []).length > 0) return

    claimedRef.current = userId
    invitationService
      .claimMine()
      .then((claimed) => {
        if (claimed > 0) {
          logger.info('Invitaciones aplicadas al iniciar sesion', { claimed })
          void queryClient.invalidateQueries({ queryKey: ['user-context'] })
        }
      })
      .catch((error: unknown) => {
        // No es critico: el usuario puede seguir con el flujo de inscripcion.
        logger.warn('No se pudieron aplicar las invitaciones pendientes', {
          message: (error as Error).message,
        })
      })
  }, [userId, contextQuery.isLoading, contextQuery.data, queryClient])

  /**
   * Un SUPER_ADMIN no necesita filas en `condominium_members`: RLS le da acceso
   * a todos los condominios. Construimos membresias virtuales para que el
   * selector de condominio y el menu funcionen igual que para el resto.
   */
  const superAdminCondominiums = useQuery({
    queryKey: ['super-admin-condominiums', userId],
    queryFn: () => condominiumService.listAll(),
    enabled: Boolean(userId) && isSuperAdmin,
    staleTime: 60_000,
  })

  const memberships = useMemo<Membership[]>(() => {
    const own = contextQuery.data?.memberships ?? []
    if (!isSuperAdmin) return own

    const virtual: Membership[] = (superAdminCondominiums.data ?? []).map((condominium) => ({
      id: `super-${condominium.id}`,
      condominium_id: condominium.id,
      condominium_name: condominium.name,
      condominium_status: condominium.status,
      role_id: 'super-admin',
      role_code: 'SUPER_ADMIN' as RoleCode,
      role_name: 'Super Administrador',
      role_level: 100,
      status: 'ACTIVE',
      position: null,
    }))

    const ownIds = new Set(own.map((membership) => membership.condominium_id))
    return [...own, ...virtual.filter((membership) => !ownIds.has(membership.condominium_id))]
  }, [contextQuery.data?.memberships, isSuperAdmin, superAdminCondominiums.data])

  const currentCondominiumId = useMemo(() => {
    if (memberships.length === 0) return null
    const stored = selectedCondominium
    if (stored && memberships.some((membership) => membership.condominium_id === stored)) {
      return stored
    }
    return memberships[0].condominium_id
  }, [memberships, selectedCondominium])

  const currentMembership = useMemo(
    () => memberships.find((membership) => membership.condominium_id === currentCondominiumId) ?? null,
    [memberships, currentCondominiumId],
  )

  const role = currentMembership?.role_code ?? (isSuperAdmin ? 'SUPER_ADMIN' : null)

  // --- Acciones -----------------------------------------------------------
  const setCurrentCondominium = useCallback(
    (condominiumId: string) => {
      storeCondominium(condominiumId)
      setSelectedCondominium(condominiumId)
      void queryClient.invalidateQueries()
    },
    [queryClient],
  )

  const signIn = useCallback(async (input: SignInInput) => {
    const nextSession = await authService.signIn(input)
    setSession(nextSession)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authService.signUp(input)
    return { needsConfirmation: result.needsConfirmation }
  }, [])

  const signOut = useCallback(async () => {
    await authService.signOut()
    setSession(null)
    storeCondominium(null)
    setSelectedCondominium(null)
    queryClient.clear()
  }, [queryClient])

  const refreshContext = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-context'] })
  }, [queryClient])

  const hasRole = useCallback(
    (roles: RoleCode[]) => {
      if (isSuperAdmin) return true
      return Boolean(role && roles.includes(role))
    },
    [isSuperAdmin, role],
  )

  const hasPermission = useCallback(
    (permission: PermissionKey) => {
      if (isSuperAdmin) return true
      if (!role) return false
      return (PERMISSIONS[permission] as RoleCode[]).includes(role)
    },
    [isSuperAdmin, role],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: contextQuery.data?.profile ?? null,
      isSuperAdmin,
      memberships,
      apartmentIds: contextQuery.data?.apartment_ids ?? [],
      currentCondominiumId,
      currentMembership,
      role,
      initializing,
      loadingContext: contextQuery.isLoading || superAdminCondominiums.isLoading,
      setCurrentCondominium,
      signIn,
      signUp,
      signOut,
      refreshContext,
      hasRole,
      hasPermission,
    }),
    [
      session,
      contextQuery.data,
      contextQuery.isLoading,
      superAdminCondominiums.isLoading,
      isSuperAdmin,
      memberships,
      currentCondominiumId,
      currentMembership,
      role,
      initializing,
      setCurrentCondominium,
      signIn,
      signUp,
      signOut,
      refreshContext,
      hasRole,
      hasPermission,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

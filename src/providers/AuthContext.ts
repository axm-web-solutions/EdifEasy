import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { ProfileRow, RoleCode } from '@/types/database'
import type { Membership } from '@/types/models'
import type { PermissionKey } from '@/constants/roles'
import type { SignInInput, SignUpInput } from '@/services/authService'

export interface AuthContextValue {
  /** Sesion de Supabase Auth (null si no hay usuario). */
  session: Session | null
  user: User | null
  profile: ProfileRow | null

  isSuperAdmin: boolean
  memberships: Membership[]
  apartmentIds: string[]

  currentCondominiumId: string | null
  currentMembership: Membership | null
  role: RoleCode | null

  /** true mientras se resuelve la sesion inicial (evita parpadeos de rutas). */
  initializing: boolean
  /** true mientras se carga el contexto (perfil, membresias, roles). */
  loadingContext: boolean

  setCurrentCondominium: (condominiumId: string) => void
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshContext: () => Promise<void>

  hasRole: (roles: RoleCode[]) => boolean
  hasPermission: (permission: PermissionKey) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

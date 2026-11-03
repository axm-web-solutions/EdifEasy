import { useAuth } from '@/hooks/useAuth'
import type { WorkspaceKind } from '@/types/database'

/**
 * Tipo del espacio activo: conjunto (CONDOMINIUM) o inmobiliaria (AGENCY).
 * Sesiones anteriores a la migracion no traen el tipo: se asume conjunto.
 */
export function useWorkspace(): { kind: WorkspaceKind; isAgency: boolean } {
  const { currentMembership } = useAuth()
  const kind: WorkspaceKind = currentMembership?.condominium_kind ?? 'CONDOMINIUM'
  return { kind, isAgency: kind === 'AGENCY' }
}

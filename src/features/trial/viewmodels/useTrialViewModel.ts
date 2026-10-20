import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isAllowedWhenExpired, trialBannerText, trialState } from '../trial.logic'

/**
 * Prueba gratis dentro de la app: aviso de dias restantes para la
 * administracion y pantalla de bloqueo cuando vence sin un plan.
 */
export function useTrialViewModel() {
  const { currentMembership, role, isSuperAdmin } = useAuth()
  const { pathname } = useLocation()
  const state = trialState(currentMembership ?? null)
  const isAdmin = role === 'ADMINISTRATOR'

  return {
    banner:
      state.kind === 'active' && isAdmin
        ? {
            text: trialBannerText(state.daysLeft),
            detail: `Hasta el ${state.endsLabel}. Elige un plan para no perder el acceso.`,
            urgent: state.urgent,
          }
        : null,
    // El super admin ve todo (la base tampoco lo bloquea).
    blocked: state.kind === 'expired' && !isSuperAdmin && !isAllowedWhenExpired(pathname),
    canPay: isAdmin,
    condominiumName: currentMembership?.condominium_name ?? 'este conjunto',
  }
}

export type TrialViewModel = ReturnType<typeof useTrialViewModel>

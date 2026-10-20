import type { Membership } from '@/types/models'

const DAY = 86_400_000

export type TrialState =
  | { kind: 'none' }
  | { kind: 'active'; daysLeft: number; endsLabel: string; urgent: boolean }
  | { kind: 'expired' }

/** Estado de la prueba gratis del conjunto activo. */
export function trialState(
  membership: Pick<Membership, 'trial_ends_at' | 'has_access'> | null,
  now = Date.now(),
): TrialState {
  if (!membership) return { kind: 'none' }
  if (membership.has_access === false) return { kind: 'expired' }
  if (!membership.trial_ends_at) return { kind: 'none' }
  const ends = Date.parse(membership.trial_ends_at)
  // has_access ya contempla un plan pagado: si el conjunto tiene plan vigente
  // el contexto lo dice, y con prueba vencida + plan no hay nada que avisar.
  if (ends <= now) return { kind: 'none' }
  const daysLeft = Math.max(1, Math.ceil((ends - now) / DAY))
  return {
    kind: 'active',
    daysLeft,
    endsLabel: new Date(ends).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }),
    urgent: daysLeft <= 2,
  }
}

export function trialBannerText(daysLeft: number): string {
  return daysLeft === 1
    ? 'Tu prueba gratis termina hoy'
    : `Te quedan ${daysLeft} dias de prueba gratis`
}

/** Rutas que siguen abiertas con la prueba vencida (para poder pagar). */
const EXPIRED_ALLOWED = ['/plans', '/payments/result', '/legal']

export function isAllowedWhenExpired(pathname: string): boolean {
  return EXPIRED_ALLOWED.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/** La cuenta se registro para la prueba gratis desde la landing. */
export function hasTrialSignup(metadata: Record<string, unknown> | null | undefined): boolean {
  const trial = metadata?.trial
  return typeof trial === 'object' && trial !== null && !Array.isArray(trial)
}

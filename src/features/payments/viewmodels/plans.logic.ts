import dayjs, { type Dayjs } from 'dayjs'
import type { SubscriptionRow } from '@/types/database'

/**
 * Umbral de la tarifa por tamano del conjunto. El precio real lo calcula la
 * base (`subscription_quote`); esto solo explica la tarifa en pantalla.
 */
export const LARGE_CONDOMINIUM_FROM = 80

export type PlanState = 'active' | 'expired' | 'none'

/** Estado del plan y dias que le quedan (hoy cuenta como vigente). */
export function planStatus(
  current: Pick<SubscriptionRow, 'ends_at'> | null,
  today: Dayjs = dayjs(),
) {
  if (!current) return { state: 'none' as PlanState, daysLeft: 0 }
  const end = dayjs(current.ends_at)
  const day = today.startOf('day')
  if (end.isBefore(day)) return { state: 'expired' as PlanState, daysLeft: 0 }
  return { state: 'active' as PlanState, daysLeft: end.diff(day, 'day') }
}

export function tariffDescription(apartments: number): string {
  return apartments < LARGE_CONDOMINIUM_FROM
    ? `Tarifa para conjuntos de menos de ${LARGE_CONDOMINIUM_FROM} apartamentos`
    : `Tarifa para conjuntos de ${LARGE_CONDOMINIUM_FROM} apartamentos o mas`
}

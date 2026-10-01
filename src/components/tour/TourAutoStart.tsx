import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTour } from '@/providers/TourProvider'
import { getTourForRoute } from '@/config/tours'

const POLL_INTERVAL_MS = 200
const MAX_WAIT_MS = 8000

/**
 * Inicia automaticamente el tour de la seccion actual cuando el usuario
 * llega por primera vez (los tours con `once` solo se muestran una vez y
 * quedan registrados en localStorage).
 *
 * Espera a que el primer elemento del tour exista en el DOM antes de
 * arrancar, para no mostrar el popover sobre un skeleton de carga.
 */
export function TourAutoStart() {
  const location = useLocation()
  const { role } = useAuth()
  const { startTour, isActive, isTourCompleted } = useTour()
  const startedPathRef = useRef<string | null>(null)

  useEffect(() => {
    const pathname = location.pathname
    const tour = getTourForRoute(pathname, role)
    if (!tour) return
    if (tour.once && isTourCompleted(tour.id)) return
    // Un tour ya iniciado en esta ruta no se relanza.
    if (startedPathRef.current === pathname) return

    const selector = tour.steps.find((step) => step.element)?.element
    if (typeof selector !== 'string') {
      startedPathRef.current = pathname
      startTour(tour)
      return
    }

    let tries = 0
    let cancelled = false

    const timer = window.setInterval(() => {
      if (cancelled) return
      tries += 1

      const target = document.querySelector(selector)
      const ready = Boolean(target)
      const expired = tries * POLL_INTERVAL_MS >= MAX_WAIT_MS

      if (ready || expired) {
        window.clearInterval(timer)
        if (!cancelled && ready && startedPathRef.current !== pathname) {
          startedPathRef.current = pathname
          startTour(tour)
        }
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [location.pathname, role, startTour, isTourCompleted, isActive])

  return null
}

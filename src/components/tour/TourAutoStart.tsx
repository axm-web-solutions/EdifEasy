import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTour } from '@/providers/TourProvider'
import { getRouteForTour, getTourById, getTourForRoute } from '@/config/tours'
import type { TourConfig } from '@/hooks/useDriver'

const POLL_INTERVAL_MS = 200
const MAX_WAIT_MS = 8000

/**
 * Espera a que el primer elemento del tour exista en el DOM (para no mostrar
 * el popover sobre un skeleton de carga). Devuelve la funcion de cancelacion.
 */
function whenTourReady(tour: TourConfig, onReady: () => void, onExpired: () => void): () => void {
  const selector = tour.steps.find((step) => step.element)?.element
  if (typeof selector !== 'string') {
    onReady()
    return () => undefined
  }

  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    if (document.querySelector(selector)) {
      window.clearInterval(timer)
      onReady()
    } else if (tries * POLL_INTERVAL_MS >= MAX_WAIT_MS) {
      window.clearInterval(timer)
      onExpired()
    }
  }, POLL_INTERVAL_MS)

  return () => window.clearInterval(timer)
}

/**
 * Arranca los tours guiados:
 *
 * 1. Tour pedido desde el boton de ayuda (`requestTour`): cuando el usuario
 *    llega a la pagina del tour, lo inicia aunque ya lo haya visto.
 * 2. Primera visita: inicia el tour de la seccion actual una sola vez (los
 *    tours con `once` quedan registrados en localStorage).
 */
export function TourAutoStart() {
  const location = useLocation()
  const { role } = useAuth()
  const { startTour, startTourForced, isActive, isTourCompleted, pendingTourId, clearPendingTour } = useTour()
  const startedPathRef = useRef<string | null>(null)

  // 1. Tour pedido explicitamente.
  useEffect(() => {
    if (!pendingTourId) return
    const tour = getTourById(pendingTourId)
    const route = getRouteForTour(pendingTourId)
    if (!tour || !route) {
      clearPendingTour()
      return
    }
    // Aun navegando hacia la pagina del tour.
    if (location.pathname !== route) return

    return whenTourReady(
      tour,
      () => {
        startedPathRef.current = location.pathname
        clearPendingTour()
        startTourForced(tour)
      },
      clearPendingTour,
    )
  }, [pendingTourId, location.pathname, startTourForced, clearPendingTour])

  // 2. Primera visita a la seccion.
  useEffect(() => {
    if (pendingTourId) return
    const pathname = location.pathname
    const tour = getTourForRoute(pathname, role)
    if (!tour) return
    if (tour.once && isTourCompleted(tour.id)) return
    // Un tour ya iniciado en esta ruta no se relanza.
    if (startedPathRef.current === pathname) return

    return whenTourReady(
      tour,
      () => {
        if (startedPathRef.current === pathname) return
        startedPathRef.current = pathname
        startTour(tour)
      },
      () => undefined,
    )
  }, [location.pathname, role, startTour, isTourCompleted, isActive, pendingTourId])

  return null
}

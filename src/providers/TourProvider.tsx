import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useDriver } from '@/hooks/useDriver'
import type { TourConfig } from '@/hooks/useDriver'

interface TourContextValue {
  isActive: boolean
  currentStepIndex: number
  activeTourId: string | null
  startTour: (tour: TourConfig) => boolean
  startTourForced: (tour: TourConfig) => boolean
  stopTour: () => void
  resetAllTours: () => void
  isTourCompleted: (tourId: string) => boolean
  /**
   * Tour pedido desde otra pagina: `TourAutoStart` lo inicia en cuanto el
   * usuario llega a la ruta del tour y la pagina termina de cargar.
   */
  pendingTourId: string | null
  requestTour: (tourId: string) => void
  clearPendingTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const driver = useDriver()
  const [pendingTourId, setPendingTourId] = useState<string | null>(null)

  const requestTour = useCallback((tourId: string) => setPendingTourId(tourId), [])
  const clearPendingTour = useCallback(() => setPendingTourId(null), [])

  return (
    <TourContext.Provider
      value={{
        isActive: driver.isActive,
        currentStepIndex: driver.currentStepIndex,
        activeTourId: driver.activeTourId,
        startTour: driver.startTour,
        startTourForced: driver.startTourForced,
        stopTour: driver.stopTour,
        resetAllTours: driver.resetAllTours,
        isTourCompleted: driver.isTourCompleted,
        pendingTourId,
        requestTour,
        clearPendingTour,
      }}
    >
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour debe usarse dentro de un TourProvider')
  }
  return context
}

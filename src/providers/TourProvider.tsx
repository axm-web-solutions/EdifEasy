import { createContext, useContext, type ReactNode } from 'react'
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
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const driver = useDriver()

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

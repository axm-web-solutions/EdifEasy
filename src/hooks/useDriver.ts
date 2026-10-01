import { useCallback, useEffect, useRef, useState } from 'react'
import { driver, type DriveStep, type Config } from 'driver.js'
import 'driver.js/dist/driver.css'

const STORAGE_KEY = 'edifeasy-tours-completed'

function getCompletedTours(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function markTourCompleted(tourId: string) {
  const completed = getCompletedTours()
  if (!completed.includes(tourId)) {
    completed.push(tourId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  }
}

export interface TourStep extends DriveStep {
  /** ID unico del paso para tracking */
  id?: string
}

export interface TourConfig {
  /** ID unico del tour */
  id: string
  /** Pasos del tour */
  steps: TourStep[]
  /** Si se debe mostrar solo una vez */
  once?: boolean
  /** Configuracion adicional de driver.js */
  config?: Partial<Config>
}

const defaultConfig: Partial<Config> = {
  showProgress: true,
  showButtons: ['next', 'previous', 'close'],
  nextBtnText: 'Siguiente',
  prevBtnText: 'Anterior',
  doneBtnText: 'Finalizar',
  popoverClass: 'edifeasy-driver-popover',
  overlayColor: 'rgba(15, 23, 42, 0.6)',
  smoothScroll: true,
  allowClose: true,
  stagePadding: 8,
  stageRadius: 8,
}

export function useDriver() {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [activeTourId, setActiveTourId] = useState<string | null>(null)

  const runTour = useCallback((tourConfig: TourConfig) => {
    // Filtra pasos con elementos que no existan en el DOM (por permisos,
    // estados de carga o variantes de la pagina), para no romper el tour.
    const steps = tourConfig.steps.filter((step) => {
      if (typeof step.element !== 'string') return Boolean(step.element)
      return Boolean(document.querySelector(step.element))
    })
    if (steps.length === 0) return false

    // Destruye una instancia previa si existe.
    driverRef.current?.destroy()

    const d = driver({
      ...defaultConfig,
      ...tourConfig.config,
      steps,
      onDestroyed: () => {
        markTourCompleted(tourConfig.id)
        driverRef.current = null
        setIsActive(false)
        setCurrentStepIndex(0)
        setActiveTourId(null)
      },
      onHighlighted: (_element, _step, opts) => {
        if (typeof opts.index === 'number') setCurrentStepIndex(opts.index)
      },
    })

    driverRef.current = d
    setIsActive(true)
    setCurrentStepIndex(0)
    setActiveTourId(tourConfig.id)
    d.drive()
    return true
  }, [])

  /** Inicia el tour solo si aun no se ha completado (cuando once es true). */
  const startTour = useCallback(
    (tourConfig: TourConfig) => {
      const completed = getCompletedTours()
      if (tourConfig.once && completed.includes(tourConfig.id)) {
        return false
      }
      return runTour(tourConfig)
    },
    [runTour],
  )

  /** Inicia el tour sin importar si ya se completo antes. */
  const startTourForced = useCallback(
    (tourConfig: TourConfig) => {
      return runTour(tourConfig)
    },
    [runTour],
  )

  const stopTour = useCallback(() => {
    driverRef.current?.destroy()
  }, [])

  const resetAllTours = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const isTourCompleted = useCallback((tourId: string) => {
    return getCompletedTours().includes(tourId)
  }, [])

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  return {
    isActive,
    currentStepIndex,
    activeTourId,
    startTour,
    startTourForced,
    stopTour,
    resetAllTours,
    isTourCompleted,
  }
}

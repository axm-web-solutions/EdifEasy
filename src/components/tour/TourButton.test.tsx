import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '@/test/test-utils'
import { TourProvider } from '@/providers/TourProvider'
import { TOURS, getRouteForTour, getTourIdForRoute } from '@/config/tours'
import { TourButton } from './TourButton'
import { TourAutoStart } from './TourAutoStart'

const startTourForced = vi.fn((tour: { id: string }) => Boolean(tour))
const startTour = vi.fn(() => false)

vi.mock('@/hooks/useDriver', () => ({
  useDriver: () => ({
    isActive: false,
    currentStepIndex: 0,
    activeTourId: null,
    startTour,
    startTourForced,
    stopTour: vi.fn(),
    resetAllTours: vi.fn(),
    isTourCompleted: () => true,
  }),
}))

function Page({ name }: { name: string }) {
  return (
    <div data-tour="page-header">
      <h1>{name}</h1>
    </div>
  )
}

function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

function Harness() {
  return (
    <TourProvider>
      <TourButton />
      <TourAutoStart />
      <CurrentPath />
      <Routes>
        <Route path="/dashboard" element={<Page name="Dashboard" />} />
        <Route path="/fines" element={<Page name="Multas" />} />
        <Route path="/admin-fees" element={<Page name="Cuotas" />} />
      </Routes>
    </TourProvider>
  )
}

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: /abrir menú de tours/i }))
}

describe('TourButton', () => {
  beforeEach(() => {
    startTourForced.mockClear()
    startTour.mockClear()
  })

  it('lleva a la pagina del tour elegido y lo inicia alli', async () => {
    renderWithProviders(<Harness />, { route: '/dashboard', authValue: { role: 'ADMINISTRATOR' } })

    await openMenu()
    await userEvent.click(await screen.findByText('Multas', { selector: 'span' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/fines')
    await waitFor(() => expect(startTourForced).toHaveBeenCalledTimes(1))
    expect(startTourForced.mock.calls[0][0].id).toBe('fines')
  })

  it('inicia de una vez el tour de la pagina actual', async () => {
    renderWithProviders(<Harness />, { route: '/fines', authValue: { role: 'ADMINISTRATOR' } })

    await openMenu()
    await userEvent.click(await screen.findByText('Tour de esta página'))

    expect(screen.getByTestId('path')).toHaveTextContent('/fines')
    expect(startTourForced).toHaveBeenCalledTimes(1)
    expect(startTourForced.mock.calls[0][0].id).toBe('fines')
  })

  it('solo lista las secciones a las que el rol tiene acceso', async () => {
    renderWithProviders(<Harness />, { route: '/dashboard', authValue: { role: 'OWNER' } })

    await openMenu()

    expect(await screen.findByText('Cuotas de administración')).toBeInTheDocument()
    expect(screen.queryByText('Planes')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
    expect(screen.queryByText('Auditoría')).not.toBeInTheDocument()
  })
})

describe('rutas de los tours', () => {
  it('cada tour tiene una pagina a la cual navegar', () => {
    for (const tour of TOURS) {
      expect(getRouteForTour(tour.id), tour.id).toMatch(/^\//)
    }
  })

  it('la ruta de un tour vuelve a resolver el mismo tour', () => {
    for (const tour of TOURS.filter((t) => !t.id.startsWith('dashboard-'))) {
      expect(getTourIdForRoute(getRouteForTour(tour.id) as string)).toBe(tour.id)
    }
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { registrationService, type RegistrationRequestReview } from '@/services/registrationService'
import { ApprovalsPage } from './pages/ApprovalsPage'

const PENDING: RegistrationRequestReview = {
  id: 'req-1',
  status: 'PENDING',
  requested_role: 'OWNER',
  applicant_note: 'Compre el apartamento el mes pasado',
  review_notes: null,
  created_at: '2026-08-17T10:00:00.000Z',
  reviewed_at: null,
  vehicles: [{ plate: 'ABC123' }],
  profile_id: 'user-9',
  full_name: 'Andrea Suarez',
  email: 'andrea@example.com',
  phone: '+57 300 111 2222',
  document_number: '52011223',
  building_id: 'b-1',
  building_number: '1',
  apartment_id: 'a-1',
  apartment_number: '101',
  reviewer_name: null,
}

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lista las solicitudes pendientes con los datos del solicitante', async () => {
    vi.spyOn(registrationService, 'forReview').mockResolvedValue([PENDING])

    renderWithProviders(<ApprovalsPage />)

    expect(await screen.findByText('Andrea Suarez')).toBeInTheDocument()
    expect(screen.getByText(/andrea@example.com/)).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText(/Compre el apartamento/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument()
  })

  it('muestra un vacio explicativo cuando no hay pendientes', async () => {
    vi.spyOn(registrationService, 'forReview').mockResolvedValue([])

    renderWithProviders(<ApprovalsPage />)

    expect(await screen.findByText(/no hay solicitudes pendientes/i)).toBeInTheDocument()
  })

  it('exige un motivo para poder rechazar', async () => {
    vi.spyOn(registrationService, 'forReview').mockResolvedValue([PENDING])
    const reject = vi.spyOn(registrationService, 'reject').mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(<ApprovalsPage />)

    await user.click(await screen.findByRole('button', { name: /rechazar/i }))

    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /rechazar/i })
    expect(confirm).toBeDisabled()

    await user.type(
      within(dialog).getByRole('textbox'),
      'El apartamento ya tiene propietario registrado',
    )
    expect(confirm).toBeEnabled()

    await user.click(confirm)

    await waitFor(() => {
      expect(reject).toHaveBeenCalledWith(
        'req-1',
        'El apartamento ya tiene propietario registrado',
      )
    })
  })

  it('no ofrece acciones sobre solicitudes ya revisadas', async () => {
    vi.spyOn(registrationService, 'forReview').mockResolvedValue([
      {
        ...PENDING,
        status: 'APPROVED',
        reviewed_at: '2026-08-17T12:00:00.000Z',
        reviewer_name: 'Carlos Mejia',
      },
    ])

    renderWithProviders(<ApprovalsPage />)

    expect(await screen.findByText('Andrea Suarez')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^aprobar$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Carlos Mejia/)).toBeInTheDocument()
  })
})

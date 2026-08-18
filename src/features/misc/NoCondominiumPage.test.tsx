import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { toAppError } from '@/lib/errors'
import { renderWithProviders } from '@/test/test-utils'
import {
  registrationService,
  type MyRegistrationRequest,
  type RegistrationRequestInput,
} from '@/services/registrationService'
import { NoCondominiumPage } from './pages/MiscPages'

/** La ruta vive fuera de ProtectedRoute y valida la sesion ella misma. */
const SESSION = { access_token: 'token-de-prueba' } as Session

const PENDING_CHOICE: RegistrationRequestInput = {
  condominiumId: '00000000-0000-0000-0000-0000000000c1',
  buildingId: '00000000-0000-0000-0000-0000000000b1',
  apartmentId: '00000000-0000-0000-0000-0000000000a1',
  userType: 'OWNER',
  vehicles: [{ plate: 'ABC123', type: 'CAR' }],
  note: 'Compre el apartamento en julio',
}

const SUBMITTED_REQUEST: MyRegistrationRequest = {
  id: 'req-1',
  status: 'PENDING',
  requested_role: 'OWNER',
  condominium_name: 'Conjunto Altos del Parque',
  building_number: 'A',
  apartment_number: 'A101',
  review_notes: null,
  created_at: '2026-08-18T10:00:00.000Z',
  reviewed_at: null,
}

const FORM_SUBMIT = 'Enviar solicitud de inscripcion'

describe('NoCondominiumPage', () => {
  beforeEach(() => {
    registrationService.clearPending()
    // El formulario, si aparece, no debe salir a la red.
    vi.spyOn(registrationService, 'catalog').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    registrationService.clearPending()
  })

  it('envia sola la eleccion guardada en el registro, sin volver a pedirla', async () => {
    registrationService.savePending(PENDING_CHOICE)

    const myRequest = vi
      .spyOn(registrationService, 'myRequest')
      .mockResolvedValueOnce(null)
      .mockResolvedValue(SUBMITTED_REQUEST)
    const send = vi
      .spyOn(registrationService, 'request')
      .mockResolvedValue({ ok: true, request_id: 'req-1' })

    renderWithProviders(<NoCondominiumPage />, { authValue: { session: SESSION } })

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send).toHaveBeenCalledWith(PENDING_CHOICE)

    // Pasa directo a la pantalla de espera: el formulario no reaparece.
    expect(await screen.findByText('Tu solicitud esta en revision')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: FORM_SUBMIT })).not.toBeInTheDocument()

    expect(myRequest).toHaveBeenCalled()
    // Enviada la solicitud, el respaldo local deja de hacer falta.
    expect(registrationService.loadPending()).toBeNull()
  })

  it('muestra el formulario cuando no hay ninguna eleccion guardada', async () => {
    vi.spyOn(registrationService, 'myRequest').mockResolvedValue(null)
    const send = vi.spyOn(registrationService, 'request')

    renderWithProviders(<NoCondominiumPage />, { authValue: { session: SESSION } })

    expect(await screen.findByRole('button', { name: FORM_SUBMIT })).toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
  })

  it('si el envio automatico falla, explica el motivo y deja completar a mano', async () => {
    registrationService.savePending(PENDING_CHOICE)

    vi.spyOn(registrationService, 'myRequest').mockResolvedValue(null)
    // Forma real del rechazo: la funcion SQL lanza P0001 con el motivo.
    vi.spyOn(registrationService, 'request').mockRejectedValue(
      toAppError({
        code: 'P0001',
        message: 'Ese apartamento ya tiene un propietario registrado.',
        details: null,
        hint: null,
      }),
    )

    renderWithProviders(<NoCondominiumPage />, { authValue: { session: SESSION } })

    expect(
      await screen.findByText('No pudimos enviar tu solicitud automaticamente'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ese apartamento ya tiene un propietario registrado.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: FORM_SUBMIT })).toBeInTheDocument()
  })
})

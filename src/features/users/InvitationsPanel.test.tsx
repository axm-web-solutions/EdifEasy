import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { invitationService, type Invitation } from '@/services/invitationService'
import { apartmentService } from '@/services/apartmentService'
import { invitationSchema } from '@/schemas/people'
import { InvitationsPanel } from './components/InvitationsPanel'

const CONDOMINIUM_ID = '00000000-0000-0000-0000-0000000000c1'

const PENDING: Invitation = {
  id: 'inv-1',
  email: 'nuevo.admin@conjunto.com',
  status: 'PENDING',
  position: 'Administrador General',
  role_code: 'ADMINISTRATOR',
  role_name: 'Administrador',
  apartment_id: null,
  apartment_number: null,
  building_number: null,
  invited_by_name: 'Sofia Nunez',
  accepted_by_name: null,
  accepted_at: null,
  expires_at: '2026-09-16T00:00:00.000Z',
  created_at: '2026-08-17T10:00:00.000Z',
  user_exists: false,
}

describe('invitationSchema', () => {
  const base = { email: 'persona@conjunto.com', role_code: 'OWNER' as const, position: '', apartment_id: '' }

  it('acepta una invitacion valida', () => {
    expect(invitationSchema.safeParse(base).success).toBe(true)
  })

  it('rechaza correos invalidos', () => {
    const result = invitationSchema.safeParse({ ...base, email: 'no-es-correo' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Correo invalido')
    }
  })

  it('exige el correo', () => {
    expect(invitationSchema.safeParse({ ...base, email: '' }).success).toBe(false)
  })

  it('permite cualquier rol del condominio, incluido ADMINISTRATOR', () => {
    for (const role of [
      'ADMINISTRATOR',
      'SPOKESPERSON',
      'OWNER',
      'TENANT',
      'SECURITY',
      'SERVICE_STAFF',
    ]) {
      expect(invitationSchema.safeParse({ ...base, role_code: role }).success).toBe(true)
    }
  })

  it('nunca permite invitar como SUPER_ADMIN', () => {
    // SUPER_ADMIN es un rol global; la funcion SQL tambien lo rechaza.
    expect(invitationSchema.safeParse({ ...base, role_code: 'SUPER_ADMIN' }).success).toBe(false)
  })

  it('el apartamento, si viene, debe ser un UUID existente', () => {
    expect(invitationSchema.safeParse({ ...base, apartment_id: '101' }).success).toBe(false)
    expect(
      invitationSchema.safeParse({
        ...base,
        apartment_id: '00000000-0000-0000-0000-000000000009',
      }).success,
    ).toBe(true)
  })
})

describe('InvitationsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apartmentService, 'listAll').mockResolvedValue([])
  })

  it('lista las invitaciones con su rol y estado', async () => {
    vi.spyOn(invitationService, 'list').mockResolvedValue([PENDING])

    renderWithProviders(<InvitationsPanel condominiumId={CONDOMINIUM_ID} />)

    expect(await screen.findByText('nuevo.admin@conjunto.com')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    // Avisa que la persona todavia no tiene cuenta creada.
    expect(screen.getByText('Debe registrarse')).toBeInTheDocument()
  })

  it('muestra un vacio explicativo cuando no hay invitaciones', async () => {
    vi.spyOn(invitationService, 'list').mockResolvedValue([])

    renderWithProviders(<InvitationsPanel condominiumId={CONDOMINIUM_ID} />)

    expect(await screen.findByText(/sin invitaciones pendientes/i)).toBeInTheDocument()
  })

  it('crea la invitacion con el condominio activo y el rol elegido', async () => {
    vi.spyOn(invitationService, 'list').mockResolvedValue([])
    const create = vi.spyOn(invitationService, 'create').mockResolvedValue({
      ok: true,
      invitation_id: 'inv-2',
      email: 'vocero@conjunto.com',
      user_exists: false,
    })
    const user = userEvent.setup()

    renderWithProviders(<InvitationsPanel condominiumId={CONDOMINIUM_ID} />)

    await user.click(await screen.findByRole('button', { name: /invitar usuario/i }))

    const drawer = await screen.findByRole('dialog')
    await user.type(within(drawer).getByLabelText(/correo electronico/i), 'vocero@conjunto.com')
    await user.click(within(drawer).getByRole('button', { name: /crear invitacion/i }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          condominiumId: CONDOMINIUM_ID,
          email: 'vocero@conjunto.com',
          roleCode: 'OWNER',
        }),
      )
    })
  })

  it('no llama al servidor si el correo es invalido', async () => {
    vi.spyOn(invitationService, 'list').mockResolvedValue([])
    const create = vi.spyOn(invitationService, 'create')
    const user = userEvent.setup()

    renderWithProviders(<InvitationsPanel condominiumId={CONDOMINIUM_ID} />)

    await user.click(await screen.findByRole('button', { name: /invitar usuario/i }))

    const drawer = await screen.findByRole('dialog')
    await user.type(within(drawer).getByLabelText(/correo electronico/i), 'no-es-correo')
    await user.click(within(drawer).getByRole('button', { name: /crear invitacion/i }))

    expect(await screen.findByText(/correo invalido/i)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('no ofrece revocar invitaciones ya aceptadas', async () => {
    vi.spyOn(invitationService, 'list').mockResolvedValue([
      {
        ...PENDING,
        status: 'ACCEPTED',
        accepted_at: '2026-08-17T12:00:00.000Z',
        accepted_by_name: 'Carlos Mejia',
        user_exists: true,
      },
    ])

    renderWithProviders(<InvitationsPanel condominiumId={CONDOMINIUM_ID} />)

    expect(await screen.findByText('Aceptada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revocar/i })).not.toBeInTheDocument()
  })
})

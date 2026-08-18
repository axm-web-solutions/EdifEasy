import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('muestra el formulario de acceso', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contrasena/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument()
  })

  it('valida el formato del correo antes de llamar a Supabase', async () => {
    const signIn = vi.fn()
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />, { authValue: { signIn } })

    await user.type(screen.getByLabelText(/correo electronico/i), 'no-es-correo')
    await user.type(screen.getByLabelText(/contrasena/i), 'Secreta123')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText(/correo electronico invalido/i)).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('envia las credenciales cuando el formulario es valido', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />, { authValue: { signIn } })

    await user.type(screen.getByLabelText(/correo electronico/i), 'admin@edifeasy.com')
    await user.type(screen.getByLabelText(/contrasena/i), 'Secreta123')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        email: 'admin@edifeasy.com',
        password: 'Secreta123',
      })
    })
  })

  it('muestra un mensaje amigable si Supabase rechaza las credenciales', async () => {
    const signIn = vi.fn().mockRejectedValue({
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    })
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />, { authValue: { signIn } })

    await user.type(screen.getByLabelText(/correo electronico/i), 'admin@edifeasy.com')
    await user.type(screen.getByLabelText(/contrasena/i), 'incorrecta')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))

    expect(await screen.findByText(/correo o contrasena incorrectos/i)).toBeInTheDocument()
  })
})

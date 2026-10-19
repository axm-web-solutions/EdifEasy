import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { RoleGuard } from './guards'
import { moduleService } from '@/services/moduleService'

const Secret = () => <div>Contenido financiero</div>

describe('RoleGuard', () => {
  it('permite el acceso cuando el rol coincide', () => {
    renderWithProviders(
      <RoleGuard roles={['ADMINISTRATOR']}>
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'ADMINISTRATOR' } },
    )

    expect(screen.getByText('Contenido financiero')).toBeInTheDocument()
  })

  it('bloquea el acceso cuando el rol no coincide', () => {
    renderWithProviders(
      <RoleGuard roles={['ADMINISTRATOR']}>
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'TENANT' } },
    )

    expect(screen.queryByText('Contenido financiero')).not.toBeInTheDocument()
    expect(screen.getByText(/acceso restringido/i)).toBeInTheDocument()
  })

  it('bloquea al arrendatario en secciones financieras', () => {
    renderWithProviders(
      <RoleGuard permission="viewFinance">
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'TENANT' } },
    )

    expect(screen.queryByText('Contenido financiero')).not.toBeInTheDocument()
  })

  it('permite al propietario consultar informacion financiera', () => {
    renderWithProviders(
      <RoleGuard permission="viewFinance">
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'OWNER' } },
    )

    expect(screen.getByText('Contenido financiero')).toBeInTheDocument()
  })

  it('el super admin accede a todo', () => {
    renderWithProviders(
      <RoleGuard permission="viewAudit">
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'SUPER_ADMIN' } },
    )

    expect(screen.getByText('Contenido financiero')).toBeInTheDocument()
  })

  it('celaduria no accede a la seccion de gastos', () => {
    renderWithProviders(
      <RoleGuard permission="viewFinance">
        <Secret />
      </RoleGuard>,
      { authValue: { role: 'SECURITY' } },
    )

    expect(screen.queryByText('Contenido financiero')).not.toBeInTheDocument()
  })
})

describe('RoleGuard con modulos', () => {
  it('bloquea un modulo desactivado para el rol en el conjunto', async () => {
    vi.spyOn(moduleService, 'myDisabled').mockResolvedValue(['fines'])
    renderWithProviders(
      <RoleGuard module="fines">
        <div>Pantalla de multas</div>
      </RoleGuard>,
      { authValue: { role: 'OWNER' } },
    )
    expect(await screen.findByText(/no esta habilitado para tu rol/i)).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de multas')).not.toBeInTheDocument()
  })

  it('muestra el modulo cuando esta habilitado', async () => {
    vi.spyOn(moduleService, 'myDisabled').mockResolvedValue([])
    renderWithProviders(
      <RoleGuard module="fines">
        <div>Pantalla de multas</div>
      </RoleGuard>,
      { authValue: { role: 'OWNER' } },
    )
    expect(await screen.findByText('Pantalla de multas')).toBeInTheDocument()
  })
})

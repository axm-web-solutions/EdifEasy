import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { RoleGuard } from './guards'

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

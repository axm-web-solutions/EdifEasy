import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/providers/AuthContext'
import { NotifyBridge } from '@/lib/notify'
import type { Membership } from '@/types/models'
import type { ProfileRow, RoleCode } from '@/types/database'

const mockProfile: ProfileRow = {
  id: 'user-1',
  email: 'admin@edifeasy.com',
  full_name: 'Carlos Mejia',
  document_type: 'CC',
  document_number: '1000000002',
  phone: '+57 300 000 0002',
  avatar_url: null,
  status: 'ACTIVE',
  metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function mockMembership(role: RoleCode): Membership {
  return {
    id: 'member-1',
    condominium_id: 'condo-1',
    condominium_name: 'Conjunto Altos del Parque',
    condominium_status: 'ACTIVE',
    role_id: `role-${role}`,
    role_code: role,
    role_name: role,
    role_level: 50,
    status: 'ACTIVE',
    position: null,
  }
}

const PERMISSION_BY_ROLE: Record<RoleCode, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMINISTRATOR: [
    'manageCondominium',
    'manageStructure',
    'manageMembers',
    'manageAlerts',
    'manageAnnouncements',
    'manageRequests',
    'manageIncidents',
    'viewFinance',
    'manageFinance',
    'manageFines',
    'manageDocuments',
    'viewResidents',
    'viewReports',
    'viewAudit',
  ],
  SPOKESPERSON: [
    'manageAlerts',
    'manageAnnouncements',
    'viewFinance',
    'manageDocuments',
    'viewResidents',
    'viewReports',
  ],
  OWNER: ['viewFinance'],
  TENANT: [],
  SECURITY: ['manageAlerts', 'manageIncidents', 'viewResidents'],
  SERVICE_STAFF: ['manageRequests'],
}

function buildAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const role: RoleCode = overrides.role ?? 'ADMINISTRATOR'
  const permissions = PERMISSION_BY_ROLE[role]

  return {
    session: null,
    user: { id: 'user-1', email: mockProfile.email } as AuthContextValue['user'],
    profile: mockProfile,
    isSuperAdmin: role === 'SUPER_ADMIN',
    memberships: [mockMembership(role)],
    apartmentIds: [],
    currentCondominiumId: 'condo-1',
    currentMembership: mockMembership(role),
    role,
    initializing: false,
    loadingContext: false,
    setCurrentCondominium: () => undefined,
    signIn: async () => undefined,
    signUp: async () => ({ needsConfirmation: false }),
    signOut: async () => undefined,
    refreshContext: async () => undefined,
    hasRole: (roles) => role === 'SUPER_ADMIN' || roles.includes(role),
    hasPermission: (permission) =>
      permissions.includes('*') || permissions.includes(permission as string),
    ...overrides,
  }
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface ProvidersProps {
  children: ReactNode
  authValue?: Partial<AuthContextValue>
  route?: string
  queryClient?: QueryClient
}

function TestProviders({ children, authValue, route = '/', queryClient }: ProvidersProps) {
  const client = queryClient ?? createTestQueryClient()

  return (
    <ConfigProvider locale={esES} theme={{ token: { motion: false } }}>
      <AntApp>
        <NotifyBridge />
        <QueryClientProvider client={client}>
          <AuthContext.Provider value={buildAuthValue(authValue)}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & {
    authValue?: Partial<AuthContextValue>
    route?: string
    queryClient?: QueryClient
  } = {},
) {
  const { authValue, route, queryClient, ...renderOptions } = options

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders authValue={authValue} route={route} queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  })
}

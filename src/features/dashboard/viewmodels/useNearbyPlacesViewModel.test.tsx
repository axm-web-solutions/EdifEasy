import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from '@/providers/AuthContext'
import type { CondominiumRow } from '@/types/database'
import { useNearbyPlacesViewModel } from './useNearbyPlacesViewModel'

const condominium: CondominiumRow = {
  id: 'condo-1',
  name: 'Horeb',
  nit: null,
  address: 'Horeb',
  city: 'Armenia',
  country: 'Colombia',
  phone: null,
  email: null,
  logo_url: null,
  description: null,
  status: 'ACTIVE',
  settings: {},
  latitude: null,
  longitude: null,
  location_label: null,
  location_approximate: false,
  location_source: null,
  places_updated_at: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

let current: CondominiumRow = condominium
const geocode = vi.fn()
const nearby = vi.fn()
const saveLocation = vi.fn()
const saveCoordinates = vi.fn()

vi.mock('@/services/condominiumService', () => ({
  condominiumService: { getById: vi.fn(async () => current) },
}))

vi.mock('@/services/placesService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/placesService')>()
  return {
    ...original,
    placesService: {
      listCached: vi.fn(async () => []),
      geocode: (...args: unknown[]) => geocode(...args),
      nearby: (...args: unknown[]) => nearby(...args),
      saveLocation: (...args: unknown[]) => saveLocation(...args),
      saveCoordinates: (...args: unknown[]) => saveCoordinates(...args),
    },
  }
})

function wrapper(canManage: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = {
    hasPermission: () => canManage,
  } as unknown as AuthContextValue
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
}

describe('useNearbyPlacesViewModel', () => {
  beforeEach(() => {
    current = condominium
    geocode
      .mockReset()
      .mockResolvedValue({ lat: 4.55, lon: -75.65, label: 'Horeb', approximate: false })
    nearby.mockReset().mockResolvedValue([])
    saveLocation.mockReset().mockResolvedValue(0)
    saveCoordinates.mockReset().mockResolvedValue(undefined)
  })

  it('un residente nunca consulta OpenStreetMap: ve "ubicacion pendiente"', async () => {
    const { result } = renderHook(() => useNearbyPlacesViewModel('condo-1'), {
      wrapper: wrapper(false),
    })

    await waitFor(() => expect(result.current.status).toBe('pending-location'))
    expect(geocode).not.toHaveBeenCalled()
    expect(nearby).not.toHaveBeenCalled()
  })

  it('el administrador ubica el conjunto una vez y guarda en la base', async () => {
    renderHook(() => useNearbyPlacesViewModel('condo-1'), { wrapper: wrapper(true) })

    await waitFor(() => expect(saveLocation).toHaveBeenCalledTimes(1))
    expect(geocode).toHaveBeenCalledTimes(1)
    // Las coordenadas se guardan antes de consultar los lugares (el mapa aparece ya).
    expect(saveCoordinates.mock.invocationCallOrder[0]).toBeLessThan(
      nearby.mock.invocationCallOrder[0],
    )
    expect(nearby).toHaveBeenCalledWith(expect.objectContaining({ lat: 4.55, lon: -75.65 }), 2000)
    expect(saveLocation.mock.calls[0][1]).toMatchObject({ source: 'Horeb, Armenia, Colombia' })
  })

  it('con ubicacion y lugares recientes no consulta nada', async () => {
    current = {
      ...condominium,
      latitude: 4.55,
      longitude: -75.65,
      location_source: 'Horeb, Armenia, Colombia',
      places_updated_at: new Date().toISOString(),
    }
    const { result } = renderHook(() => useNearbyPlacesViewModel('condo-1'), {
      wrapper: wrapper(true),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(geocode).not.toHaveBeenCalled()
    expect(nearby).not.toHaveBeenCalled()
  })

  it('si cambio la direccion, el administrador vuelve a ubicar el conjunto', async () => {
    current = {
      ...condominium,
      latitude: 4.55,
      longitude: -75.65,
      location_source: 'Calle 93, Bogota, Colombia',
      places_updated_at: new Date().toISOString(),
    }
    renderHook(() => useNearbyPlacesViewModel('condo-1'), { wrapper: wrapper(true) })

    await waitFor(() => expect(geocode).toHaveBeenCalledTimes(1))
  })
})

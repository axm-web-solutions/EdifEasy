import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import type { FineWithRelations } from '@/types/models'
import { useFinesViewModel } from './useFinesViewModel'

const payFine = { mutate: vi.fn(), isPending: false, variables: undefined as string | undefined }

vi.mock('@/hooks/useFines', () => ({
  useFines: () => ({
    data: { data: [], total: 0 },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  // Totales de toda la consulta, no de la pagina visible.
  useFinesSummary: () => ({
    isLoading: false,
    data: { pending_amount: 900000, pending_count: 5, paid_amount: 300000, paid_count: 2 },
  }),
  useFineMutations: () => ({
    create: { isPending: false, mutateAsync: vi.fn() },
    update: { isPending: false, mutateAsync: vi.fn() },
    remove: { mutateAsync: vi.fn() },
  }),
}))
vi.mock('@/hooks/usePayments', () => ({ useCheckout: () => ({ payFine }) }))
vi.mock('@/hooks/useApartments', () => ({
  useAllApartments: () => ({
    isLoading: false,
    data: [{ id: 'a1', number: '101', building: { id: 'b1', name: 'Torre 1' } }],
  }),
}))
vi.mock('@/hooks/useResidents', () => ({
  useResidentsByApartment: () => ({ isLoading: false, data: [] }),
}))

const pendingFine = { id: 'f1', status: 'PENDING', amount: 180000 } as FineWithRelations

describe('useFinesViewModel', () => {
  beforeEach(() => payFine.mutate.mockClear())

  it('el propietario puede pagar y no administrar', () => {
    const { result } = renderHook(() => useFinesViewModel(), {
      wrapper: createWrapper({ role: 'OWNER' }),
    })
    expect(result.current.permissions).toEqual({ canManage: false, canPay: true })
    expect(result.current.row.isPayable(pendingFine)).toBe(true)

    result.current.actions.pay(pendingFine)
    expect(payFine.mutate).toHaveBeenCalledWith('f1')
  })

  it('el administrador administra y no ve el boton de pagar', () => {
    const { result } = renderHook(() => useFinesViewModel(), {
      wrapper: createWrapper({ role: 'ADMINISTRATOR' }),
    })
    expect(result.current.permissions).toEqual({ canManage: true, canPay: false })
  })

  it('los totales vienen del resumen de la base, no de la pagina visible', () => {
    const { result } = renderHook(() => useFinesViewModel(), {
      wrapper: createWrapper({ role: 'ADMINISTRATOR' }),
    })
    expect(result.current.stats).toMatchObject({
      pendingAmount: 900000,
      pendingCount: 5,
      paidAmount: 300000,
    })
  })

  it('usa la etiqueta unica de apartamento en filtros y formulario', () => {
    const { result } = renderHook(() => useFinesViewModel(), {
      wrapper: createWrapper({ role: 'ADMINISTRATOR' }),
    })
    expect(result.current.form.apartmentOptions).toEqual([
      { value: 'a1', label: 'Torre 1 · Apto 101' },
    ])
  })
})

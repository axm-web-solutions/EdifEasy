import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agencyService, type StoreSettings } from '@/services/agencyService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { AgencyLeadRow, TablesInsert } from '@/types/database'

const on = (id: string | null, enabled = true) => Boolean(id) && enabled

export function useAgencyProperties(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.properties(agencyId ?? ''),
    queryFn: () => agencyService.properties(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useAgencyLeases(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.leases(agencyId ?? ''),
    queryFn: () => agencyService.leases(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useLeaseCharges(agencyId: string | null, from: string) {
  return useQuery({
    queryKey: queryKeys.agency.charges(agencyId ?? '', from),
    queryFn: () => agencyService.charges(agencyId as string, from),
    enabled: on(agencyId),
  })
}

export function useAgencyLeads(agencyId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agency.leads(agencyId ?? ''),
    queryFn: () => agencyService.leads(agencyId as string),
    enabled: on(agencyId, enabled),
  })
}

export function useStoreSettings(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.store(agencyId ?? ''),
    queryFn: () => agencyService.storeSettings(agencyId as string),
    enabled: on(agencyId),
  })
}

export function usePaymentAccount(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.paymentAccount(agencyId ?? ''),
    queryFn: () => agencyService.paymentAccount(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useStorefront(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.storefront(slug ?? ''),
    queryFn: () => agencyService.storefront(slug as string),
    enabled: Boolean(slug),
    staleTime: 60_000,
  })
}

/** Cobros e interesados nuevos aparecen sin recargar. */
export function useAgencyRealtime(agencyId: string | null): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!agencyId) return
    return agencyService.subscribe(agencyId, () => {
      void queryClient.invalidateQueries({ queryKey: ['agency', 'charges'] })
      void queryClient.invalidateQueries({ queryKey: ['agency', 'leads'] })
    })
  }, [agencyId, queryClient])
}

export function useAgencyMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['agency'] })
  const done = (message: string) => () => {
    notify.success(message)
    invalidate()
  }
  return {
    saveProperty: useMutation({
      mutationFn: (input: { id: string | null; values: TablesInsert<'agency_properties'> }) =>
        agencyService.saveProperty(input.id, input.values),
      onSuccess: done('Propiedad guardada'),
    }),
    setPublished: useMutation({
      mutationFn: (input: { id: string; isPublished: boolean }) =>
        agencyService.setPublished(input.id, input.isPublished),
      onSuccess: (_data, input) => {
        notify.success(input.isPublished ? 'Publicada en la tienda' : 'Retirada de la tienda')
        invalidate()
      },
    }),
    removeProperty: useMutation({
      mutationFn: (id: string) => agencyService.removeProperty(id),
      onSuccess: done('Propiedad eliminada'),
    }),
    saveLease: useMutation({
      mutationFn: (input: { id: string | null; values: TablesInsert<'property_leases'> }) =>
        agencyService.saveLease(input.id, input.values),
      onSuccess: done('Contrato guardado'),
    }),
    endLease: useMutation({
      mutationFn: (input: { id: string; endDate: string }) =>
        agencyService.endLease(input.id, input.endDate),
      onSuccess: done('Contrato terminado: la propiedad quedo disponible'),
    }),
    generateCharges: useMutation({
      mutationFn: (input: { agencyId: string; period: string }) =>
        agencyService.generateCharges(input.agencyId, input.period),
      onSuccess: (count) => {
        notify.success(
          count > 0
            ? `${count} cobros generados y avisados`
            : 'Los cobros de ese mes ya estaban generados',
        )
        invalidate()
      },
    }),
    registerPayment: useMutation({
      mutationFn: (input: { chargeIds: string[]; method: 'CASH' | 'TRANSFER' }) =>
        agencyService.registerPayment(input.chargeIds, input.method),
      onSuccess: done('Pago registrado'),
    }),
    voidCharge: useMutation({
      mutationFn: (id: string) => agencyService.voidCharge(id),
      onSuccess: done('Cobro anulado'),
    }),
    payCharges: useMutation({
      mutationFn: (chargeIds: string[]) => agencyService.payCharges(chargeIds),
      onSuccess: (data) => {
        window.location.assign(data.checkout_url)
      },
    }),
    setLeadStatus: useMutation({
      mutationFn: (input: { id: string; status: AgencyLeadRow['status'] }) =>
        agencyService.setLeadStatus(input.id, input.status),
      onSuccess: invalidate,
    }),
    saveStore: useMutation({
      mutationFn: (input: { agencyId: string; values: StoreSettings }) =>
        agencyService.saveStoreSettings(input.agencyId, input.values),
      onSuccess: done('Tienda actualizada'),
    }),
    connectAccount: useMutation({
      mutationFn: agencyService.connectPaymentAccount,
      onSuccess: (data) => {
        notify.success(
          `Cuenta conectada: ${data.merchant} (${data.environment === 'SANDBOX' ? 'pruebas' : 'produccion'})`,
        )
        invalidate()
      },
    }),
    disconnectAccount: useMutation({
      mutationFn: (agencyId: string) => agencyService.disconnectPaymentAccount(agencyId),
      onSuccess: done('Cuenta de pagos desconectada'),
    }),
  }
}

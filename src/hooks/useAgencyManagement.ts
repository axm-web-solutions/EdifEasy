import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agencyManagementService,
  type SignerInput,
} from '@/services/agencyManagementService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import { formatCurrency } from '@/utils/format'
import type { TablesInsert } from '@/types/database'

const on = (id: string | null | undefined, enabled = true) => Boolean(id) && enabled

export function useAgreements(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.agreements(agencyId ?? ''),
    queryFn: () => agencyManagementService.agreements(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useGuarantors(leaseId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.guarantors(leaseId ?? ''),
    queryFn: () => agencyManagementService.guarantors(leaseId as string),
    enabled: on(leaseId),
  })
}

export function useRentAdjustments(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.adjustments(agencyId ?? ''),
    queryFn: () => agencyManagementService.adjustments(agencyId as string),
    enabled: on(agencyId),
  })
}

export function usePropertyExpenses(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.expenses(agencyId ?? ''),
    queryFn: () => agencyManagementService.expenses(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useSettlements(agencyId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.settlements(agencyId ?? ''),
    queryFn: () => agencyManagementService.settlements(agencyId as string),
    enabled: on(agencyId),
  })
}

export function useSettlementLines(settlementId: string | null) {
  return useQuery({
    queryKey: queryKeys.agency.settlementLines(settlementId ?? ''),
    queryFn: () => agencyManagementService.settlementLines(settlementId as string),
    enabled: on(settlementId),
  })
}

export function useLeaseSigners(leaseIds: string[]) {
  const key = [...leaseIds].sort().join(',')
  return useQuery({
    queryKey: queryKeys.agency.signers(key),
    queryFn: () => agencyManagementService.signers(leaseIds),
    enabled: leaseIds.length > 0,
  })
}

export function useMyPendingSigners(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.agency.mySigners(userId ?? ''),
    queryFn: () => agencyManagementService.mySigners(userId as string),
    enabled: on(userId),
  })
}

export function useSigningView(token: string) {
  return useQuery({
    queryKey: queryKeys.agency.signing(token),
    queryFn: () => agencyManagementService.contractForSigning(token),
    enabled: token.length >= 32,
    retry: false,
  })
}

/** Liquidaciones y firmas nuevas aparecen sin recargar. */
export function useAgencyManagementRealtime(agencyId: string | null): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!agencyId) return
    return agencyManagementService.subscribe(agencyId, () => {
      void queryClient.invalidateQueries({ queryKey: ['agency', 'settlements'] })
      void queryClient.invalidateQueries({ queryKey: ['agency', 'signers'] })
      void queryClient.invalidateQueries({ queryKey: ['agency', 'leases'] })
    })
  }, [agencyId, queryClient])
}

export function useAgencyManagementMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['agency'] })
  const done = (message: string) => () => {
    notify.success(message)
    invalidate()
  }
  return {
    saveAgreement: useMutation({
      mutationFn: (input: { id: string | null; values: TablesInsert<'management_agreements'> }) =>
        agencyManagementService.saveAgreement(input.id, input.values),
      onSuccess: done('Mandato guardado'),
    }),
    endAgreement: useMutation({
      mutationFn: (input: { id: string; endDate: string }) =>
        agencyManagementService.endAgreement(input.id, input.endDate),
      onSuccess: done('Mandato terminado'),
    }),
    addGuarantor: useMutation({
      mutationFn: (values: TablesInsert<'lease_guarantors'>) =>
        agencyManagementService.addGuarantor(values),
      onSuccess: done('Codeudor agregado'),
    }),
    removeGuarantor: useMutation({
      mutationFn: (id: string) => agencyManagementService.removeGuarantor(id),
      onSuccess: done('Codeudor eliminado'),
    }),
    applyRentIncrease: useMutation({
      mutationFn: agencyManagementService.applyRentIncrease,
      onSuccess: (data) => {
        notify.success(
          `Canon ajustado a ${formatCurrency(Number(data.new_rent))} (${data.pct} %). Se le aviso al arrendatario.`,
        )
        invalidate()
      },
    }),
    registerNotice: useMutation({
      mutationFn: (input: {
        leaseId: string
        noticeGivenAt: string
        noticeBy: 'ARRENDADOR' | 'ARRENDATARIO'
      }) => agencyManagementService.registerNotice(input.leaseId, input.noticeGivenAt, input.noticeBy),
      onSuccess: done('Preaviso registrado'),
    }),
    clearNotice: useMutation({
      mutationFn: (leaseId: string) => agencyManagementService.clearNotice(leaseId),
      onSuccess: done('Preaviso retirado'),
    }),
    createCharge: useMutation({
      mutationFn: agencyManagementService.createCharge,
      onSuccess: done('Cobro creado y avisado'),
    }),
    addExpense: useMutation({
      mutationFn: async (input: { values: TablesInsert<'property_expenses'>; approve: boolean }) => {
        const id = await agencyManagementService.addExpense(input.values)
        if (input.approve) await agencyManagementService.approveExpense(id)
      },
      onSuccess: done('Gasto registrado'),
    }),
    removeExpense: useMutation({
      mutationFn: (id: string) => agencyManagementService.removeExpense(id),
      onSuccess: done('Gasto eliminado'),
    }),
    approveExpense: useMutation({
      mutationFn: (id: string) => agencyManagementService.approveExpense(id),
      onSuccess: done('Gasto aprobado: se descontara en la proxima liquidacion'),
    }),
    generateSettlements: useMutation({
      mutationFn: (input: { agencyId: string; period: string }) =>
        agencyManagementService.generateSettlements(input.agencyId, input.period),
      onSuccess: (count) => {
        notify.success(
          count > 0
            ? `${count} liquidaciones listas para revisar`
            : 'No hay pagos nuevos para liquidar en ese mes',
        )
        invalidate()
      },
    }),
    regenerateSettlement: useMutation({
      mutationFn: (input: { agreementId: string; period: string }) =>
        agencyManagementService.regenerateSettlement(input.agreementId, input.period),
      onSuccess: done('Liquidacion recalculada'),
    }),
    setSettlementStatus: useMutation({
      mutationFn: (input: {
        id: string
        status: 'APPROVED' | 'PAID' | 'VOID'
        reference?: string | null
      }) => agencyManagementService.setSettlementStatus(input.id, input.status, input.reference),
      onSuccess: (_data, input) => {
        notify.success(
          input.status === 'APPROVED'
            ? 'Liquidacion aprobada: el propietario ya la puede ver'
            : input.status === 'PAID'
              ? 'Giro registrado y avisado al propietario'
              : 'Liquidacion anulada',
        )
        invalidate()
      },
    }),
    sendForSignature: useMutation({
      mutationFn: (input: { leaseId: string; text: string; signers: SignerInput[] }) =>
        agencyManagementService.sendForSignature(input.leaseId, input.text, input.signers),
      onSuccess: done('Contrato enviado a firma'),
    }),
    cancelSignature: useMutation({
      mutationFn: (leaseId: string) => agencyManagementService.cancelSignature(leaseId),
      onSuccess: done('Firma cancelada: puedes corregir el contrato'),
    }),
    signingLink: useMutation({
      mutationFn: (signerId: string) => agencyManagementService.signingLink(signerId),
    }),
  }
}

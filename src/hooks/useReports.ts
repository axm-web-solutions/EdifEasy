import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/reportService'
import { queryKeys } from '@/lib/queryKeys'

export function useRequestsByStatus(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.requestsByStatus(condominiumId ?? ''),
    queryFn: () => reportService.requestsByStatus(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useRequestsByType(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.requestsByType(condominiumId ?? ''),
    queryFn: () => reportService.requestsByType(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useIncidentsByType(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.incidentsByType(condominiumId ?? ''),
    queryFn: () => reportService.incidentsByType(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useIncidentsByStatus(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.incidentsByStatus(condominiumId ?? ''),
    queryFn: () => reportService.incidentsByStatus(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useFinesByStatus(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.finesByStatus(condominiumId ?? ''),
    queryFn: () => reportService.finesByStatus(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useFinesAmountByStatus(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.finesAmount(condominiumId ?? ''),
    queryFn: () => reportService.finesAmountByStatus(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useAlertsByType(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.alertsByType(condominiumId ?? ''),
    queryFn: () => reportService.alertsByType(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

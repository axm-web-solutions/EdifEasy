import { useQuery } from '@tanstack/react-query'
import { condominiumService } from '@/services/condominiumService'
import { reportService, searchService } from '@/services/reportService'
import { queryKeys } from '@/lib/queryKeys'
import type { ListParams } from '@/types/models'

export function useAdminDashboard(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.condominiums.adminStats(condominiumId ?? ''),
    queryFn: () => condominiumService.adminStats(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useResidentDashboard(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.condominiums.residentStats(condominiumId ?? ''),
    queryFn: () => condominiumService.residentStats(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useRecentActivity(condominiumId: string | null, limit = 12) {
  return useQuery({
    queryKey: queryKeys.reports.activity(condominiumId ?? ''),
    queryFn: () => reportService.recentActivity(condominiumId as string, limit),
    enabled: Boolean(condominiumId),
  })
}

export function useAuditLogs(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.reports.audit(condominiumId ?? '', params),
    queryFn: () => reportService.auditLogs(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useGlobalSearch(condominiumId: string | null, term: string) {
  return useQuery({
    queryKey: queryKeys.search(condominiumId ?? '', term),
    queryFn: () => searchService.globalSearch(condominiumId as string, term),
    enabled: Boolean(condominiumId) && term.trim().length >= 2,
    staleTime: 15_000,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { staffService } from '@/services/staffService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'

export function useStaffRoster(condominiumId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.staff.roster(condominiumId ?? ''),
    queryFn: () => staffService.roster(condominiumId as string),
    enabled: Boolean(condominiumId) && enabled,
    refetchInterval: 60_000,
  })
}

export function useStaffShifts(condominiumId: string | null, from: string) {
  return useQuery({
    queryKey: queryKeys.staff.shifts(condominiumId ?? '', from),
    queryFn: () => staffService.shifts(condominiumId as string, from),
    enabled: Boolean(condominiumId),
    refetchInterval: 60_000,
  })
}

export function useStaffMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['staff'] })
  return {
    checkIn: useMutation({
      mutationFn: staffService.checkIn,
      onSuccess: () => {
        notify.success('Ingreso registrado')
        invalidate()
      },
    }),
    checkOut: useMutation({
      mutationFn: ({ shiftId, notes }: { shiftId: string; notes?: string | null }) =>
        staffService.checkOut(shiftId, notes ?? null),
      onSuccess: () => {
        notify.success('Salida registrada')
        invalidate()
      },
    }),
  }
}

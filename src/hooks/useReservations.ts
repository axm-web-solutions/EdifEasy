import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reservationService } from '@/services/reservationService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'

export function useCommonAreas(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.reservations.areas(condominiumId ?? ''),
    queryFn: () => reservationService.listAreas(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 5 * 60_000,
  })
}

/** Reservas vigentes y futuras (desde `from`). */
export function useReservationList(condominiumId: string | null, from: string) {
  return useQuery({
    queryKey: queryKeys.reservations.list(condominiumId ?? ''),
    queryFn: () => reservationService.list(condominiumId as string, from),
    enabled: Boolean(condominiumId),
  })
}

/** Horarios ocupados de una zona en un dia (rango ISO). */
export function useBusySlots(
  areaId: string | null,
  day: string | null,
  range: { from: string; to: string } | null,
) {
  return useQuery({
    queryKey: queryKeys.reservations.busy(areaId ?? '', day ?? ''),
    queryFn: () => reservationService.busySlots(areaId as string, range!.from, range!.to),
    enabled: Boolean(areaId && day && range),
    meta: { silent: true },
  })
}

export function useReservationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['reservations'] })
  const done = (message: string) => () => {
    notify.success(message)
    invalidate()
  }

  return {
    create: useMutation({
      mutationFn: (values: TablesInsert<'reservations'>) => reservationService.create(values),
      onSuccess: done('Reserva creada'),
    }),
    review: useMutation({
      mutationFn: (input: { id: string; approve: boolean; notes: string | null }) =>
        reservationService.review(input.id, input.approve, input.notes),
      onSuccess: (status) => {
        notify.success(status === 'REJECTED' ? 'Reserva rechazada' : 'Reserva aprobada')
        invalidate()
      },
    }),
    registerPayment: useMutation({
      mutationFn: (id: string) => reservationService.registerPayment(id),
      onSuccess: done('Pago registrado'),
    }),
    cancel: useMutation({
      mutationFn: (input: { id: string; reason: string | null }) =>
        reservationService.cancel(input.id, input.reason),
      onSuccess: done('Reserva cancelada'),
    }),
  }
}

export function useCommonAreaMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['reservations'] })

  return {
    create: useMutation({
      mutationFn: (values: TablesInsert<'common_areas'>) => reservationService.createArea(values),
      onSuccess: () => {
        notify.success('Zona comun creada')
        invalidate()
      },
    }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'common_areas'> }) =>
        reservationService.updateArea(id, values),
      onSuccess: () => {
        notify.success('Zona comun actualizada')
        invalidate()
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => reservationService.removeArea(id),
      onSuccess: () => {
        notify.success('Zona comun eliminada')
        invalidate()
      },
    }),
  }
}

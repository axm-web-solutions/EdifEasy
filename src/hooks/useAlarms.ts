import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alarmService, type AlarmDeviceInput } from '@/services/alarmService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'

export function useAlarmDevices(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.alarms.devices(condominiumId ?? ''),
    queryFn: () => alarmService.devices(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useAlarmEvents(condominiumId: string | null, from: string) {
  return useQuery({
    queryKey: queryKeys.alarms.events(condominiumId ?? '', from),
    queryFn: () => alarmService.events(condominiumId as string, from),
    enabled: Boolean(condominiumId),
  })
}

/** Eventos en vivo: refresca la lista y el estado de las alarmas. */
export function useAlarmsRealtime(condominiumId: string | null): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!condominiumId) return
    return alarmService.subscribe(condominiumId, () => {
      void queryClient.invalidateQueries({ queryKey: ['alarms'] })
    })
  }, [condominiumId, queryClient])
}

export function useAlarmMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['alarms'] })
  return {
    create: useMutation({
      mutationFn: (input: {
        condominiumId: string
        apartmentId: string | null
        values: AlarmDeviceInput
      }) => alarmService.create(input.condominiumId, input.apartmentId, input.values),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: {
        deviceId: string
        values: AlarmDeviceInput & { is_active: boolean }
      }) => alarmService.update(input.deviceId, input.values),
      onSuccess: () => {
        notify.success('Alarma actualizada')
        invalidate()
      },
    }),
    rotate: useMutation({
      mutationFn: (deviceId: string) => alarmService.rotateToken(deviceId),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (deviceId: string) => alarmService.remove(deviceId),
      onSuccess: () => {
        notify.success('Alarma desconectada')
        invalidate()
      },
    }),
    test: useMutation({
      mutationFn: (deviceId: string) => alarmService.test(deviceId),
      onSuccess: () => {
        notify.success('Evento de prueba registrado')
        invalidate()
      },
    }),
    acknowledge: useMutation({
      mutationFn: (input: { eventId: string; note: string | null }) =>
        alarmService.acknowledge(input.eventId, input.note),
      onSuccess: () => {
        notify.success('Evento atendido')
        invalidate()
        void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      },
    }),
  }
}

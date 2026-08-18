import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alertService } from '@/services/alertService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import { PRIORITY_LEVEL } from '@/constants/enums'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useAlerts(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.alerts.list(condominiumId ?? '', params),
    queryFn: () => alertService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useActiveAlerts(condominiumId: string | null, limit = 10) {
  return useQuery({
    queryKey: queryKeys.alerts.active(condominiumId ?? ''),
    queryFn: () => alertService.listActive(condominiumId as string, limit),
    enabled: Boolean(condominiumId),
  })
}


/**
 * Suscripcion en tiempo real a las alertas del condominio.
 * Refresca la cache y muestra una notificacion inmediata en alertas CRITICAL.
 */
export function useAlertsRealtime(condominiumId: string | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!condominiumId) return

    return alertService.subscribe(condominiumId, (alert, isNew) => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['condominiums', 'admin-stats'] })

      if (isNew && alert.status === 'ACTIVE') {
        notify.alert({
          title: `${PRIORITY_LEVEL[alert.priority].label}: ${alert.title}`,
          description: alert.description,
          type: alert.priority === 'CRITICAL' || alert.priority === 'HIGH' ? 'error' : 'warning',
        })
      }
    })
  }, [condominiumId, queryClient])
}

export function useAlertMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'alerts'>) => alertService.create(values),
    onSuccess: () => {
      notify.success('Alerta publicada')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'alerts'> }) =>
      alertService.update(id, values),
    onSuccess: () => {
      notify.success('Alerta actualizada')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => alertService.remove(id),
    onSuccess: () => {
      notify.success('Alerta eliminada')
      invalidate()
    },
  })

  return { create, update, remove }
}

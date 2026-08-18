import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@/services/notificationService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import { useAuth } from './useAuth'

export function useNotifications(limit = 30) {
  const { user, currentCondominiumId } = useAuth()

  return useQuery({
    queryKey: queryKeys.notifications.list(user?.id ?? '', currentCondominiumId),
    queryFn: () => notificationService.list(user?.id as string, currentCondominiumId, limit),
    enabled: Boolean(user?.id),
    refetchInterval: 120_000,
  })
}

export function useUnreadNotificationsCount() {
  const { user, currentCondominiumId } = useAuth()

  return useQuery({
    queryKey: queryKeys.notifications.unread(user?.id ?? '', currentCondominiumId),
    queryFn: () => notificationService.unreadCount(user?.id as string, currentCondominiumId),
    enabled: Boolean(user?.id),
    refetchInterval: 120_000,
  })
}

/** Realtime: nuevas notificaciones del usuario autenticado. */
export function useNotificationsRealtime(): void {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    return notificationService.subscribe(user.id, (notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })

      if (notification.priority === 'CRITICAL') {
        notify.alert({
          title: notification.title,
          description: notification.body ?? undefined,
          type: 'error',
        })
      }
    })
  }, [queryClient, user?.id])
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const { currentCondominiumId } = useAuth()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: invalidate,
    meta: { silent: true },
  })

  const markAllAsRead = useMutation({
    mutationFn: () => notificationService.markAllAsRead(currentCondominiumId),
    onSuccess: (count) => {
      notify.success(
        count > 0 ? `${count} notificaciones marcadas como leidas` : 'No habia notificaciones sin leer',
      )
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => notificationService.remove(id),
    onSuccess: invalidate,
    meta: { silent: true },
  })

  return { markAsRead, markAllAsRead, remove }
}

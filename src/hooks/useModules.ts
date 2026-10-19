import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moduleService } from '@/services/moduleService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import { useAuth } from './useAuth'
import type { ModuleKey } from '@/constants/modules'

/**
 * Modulos habilitados para el usuario en el conjunto activo. Mientras carga (o
 * si la base aun no tiene la funcion) se asume todo habilitado: la seguridad
 * real la aplica RLS y esto solo oculta menu y rutas.
 */
export function useModuleAccess() {
  const { currentCondominiumId, isSuperAdmin } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.modules.mine(currentCondominiumId ?? ''),
    queryFn: () => moduleService.myDisabled(currentCondominiumId as string),
    enabled: Boolean(currentCondominiumId) && !isSuperAdmin,
    staleTime: 60_000,
    meta: { silent: true },
  })

  const disabled = useMemo(() => new Set(query.data ?? []), [query.data])
  const isModuleEnabled = useCallback((module: ModuleKey) => !disabled.has(module), [disabled])

  return { isModuleEnabled, loading: query.isLoading }
}

/** Matriz de modulos de un conjunto (`null` = plantilla). Solo SUPER_ADMIN. */
export function useRoleModulesMatrix(condominiumId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.modules.matrix(condominiumId ?? 'default'),
    queryFn: () => moduleService.matrix(condominiumId),
    enabled,
  })
}

export function useRoleModuleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['modules'] })

  const set = useMutation({
    mutationFn: moduleService.set,
    onSuccess: invalidate,
  })

  const reset = useMutation({
    mutationFn: (condominiumId: string) => moduleService.reset(condominiumId),
    onSuccess: () => {
      notify.success('El conjunto vuelve a usar la plantilla por defecto')
      invalidate()
    },
  })

  return { set, reset }
}

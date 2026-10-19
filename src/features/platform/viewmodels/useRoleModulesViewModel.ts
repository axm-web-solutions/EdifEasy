import { useMemo, useState } from 'react'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useAuth } from '@/hooks/useAuth'
import { usePlatformOverview } from '@/hooks/usePlatform'
import { useRoleModuleMutations, useRoleModulesMatrix } from '@/hooks/useModules'
import { CONFIGURABLE_ROLES, MODULES, type ModuleKey } from '@/constants/modules'
import { roleLabel } from '@/constants/roles'
import { getErrorMessage } from '@/lib/errors'
import type { RoleCode } from '@/types/database'
import { DEFAULT_SCOPE, cellKey, indexCells, sourceHint, summarizeCells } from './roleModules.logic'

/**
 * ViewModel de "Modulos por rol" (solo SUPER_ADMIN): decide que modulos ve cada
 * rol en la plantilla por defecto o en un conjunto concreto.
 */
export function useRoleModulesViewModel() {
  const { isSuperAdmin } = useAuth()
  const [scope, setScope] = useState<string>(DEFAULT_SCOPE)
  const condominiumId = scope === DEFAULT_SCOPE ? null : scope
  const scopeIsDefault = condominiumId === null

  const overview = usePlatformOverview(isSuperAdmin)
  const matrixQuery = useRoleModulesMatrix(condominiumId, isSuperAdmin)
  const { set, reset } = useRoleModuleMutations()

  const cells = useMemo(() => matrixQuery.data?.cells ?? [], [matrixQuery.data])
  const index = useMemo(() => indexCells(cells), [cells])
  const summary = summarizeCells(cells)
  const scopeName =
    overview.data?.condominiums.find((condominium) => condominium.id === condominiumId)?.name ??
    'la plantilla por defecto'

  const pendingKey =
    set.isPending && set.variables ? cellKey(set.variables.role, set.variables.module) : null

  return {
    allowed: isSuperAdmin,
    scope: {
      value: scope,
      set: setScope,
      isDefault: scopeIsDefault,
      options: [
        {
          value: DEFAULT_SCOPE,
          label: 'Plantilla por defecto (conjuntos sin configuracion propia)',
        },
        ...(overview.data?.condominiums ?? []).map((condominium) => ({
          value: condominium.id,
          label: condominium.city ? `${condominium.name} · ${condominium.city}` : condominium.name,
        })),
      ],
      loading: overview.isLoading,
    },
    matrix: {
      loading: matrixQuery.isLoading,
      error: matrixQuery.isError ? getErrorMessage(matrixQuery.error) : null,
      retry: () => void matrixQuery.refetch(),
      modules: MODULES,
      roles: CONFIGURABLE_ROLES.map((role) => ({ role, label: roleLabel(role) })),
      cell: (role: RoleCode, module: ModuleKey) => {
        const cell = index.get(cellKey(role, module))
        return {
          enabled: cell?.enabled ?? true,
          customized:
            cell?.source === 'condominium' || (scopeIsDefault && cell?.source === 'default'),
          hint: sourceHint(cell, scopeIsDefault),
          saving: pendingKey === cellKey(role, module),
        }
      },
    },
    summary: {
      disabled: summary.disabled,
      customized: summary.customized,
      text: scopeIsDefault
        ? `${summary.disabled} modulo(s) desactivado(s) en la plantilla.`
        : `${summary.disabled} modulo(s) desactivado(s) · ${summary.customized} ajuste(s) propios de ${scopeName}.`,
    },
    toggle: (role: RoleCode, module: ModuleKey, enabled: boolean) =>
      set.mutate({ condominiumId, role, module, enabled }),
    canReset: !scopeIsDefault && summary.customized > 0,
    resetting: reset.isPending,
    reset: async () => {
      if (!condominiumId) return
      const ok = await confirmDelete({
        title: `Restablecer los modulos de ${scopeName}?`,
        content:
          'Se borran los ajustes propios del conjunto y vuelve a usar la plantilla por defecto.',
        okText: 'Restablecer',
      })
      if (ok) await reset.mutateAsync(condominiumId)
    },
  }
}

export type RoleModulesViewModel = ReturnType<typeof useRoleModulesViewModel>

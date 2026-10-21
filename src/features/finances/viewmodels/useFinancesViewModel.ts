import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  useAccountingMovements,
  useAccountingRealtime,
  useAccountingStatements,
} from '@/hooks/useAccounting'
import { toMovementViews, toStatementView } from './finances.logic'

export type FinancesTab = 'reportes' | 'cuenta' | 'fiscal' | 'carga'

/**
 * Finanzas del conjunto, organizada por lo que cada quien necesita:
 *   - Propietario: Reportes publicados y Mi estado de cuenta.
 *   - Vocero: ademas, los estados de cuenta de todas las unidades y las
 *     obligaciones fiscales (solo consulta).
 *   - Contador y administracion: configuran y publican los reportes, llevan
 *     las obligaciones fiscales y cargan la contabilidad.
 */
export function useFinancesViewModel() {
  const { currentCondominiumId, hasRole, hasPermission } = useAuth()
  const canManage = hasPermission('manageAccounting')
  const seesAllUnits = hasRole(['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT', 'SUPER_ADMIN'])
  const seesFiscal = seesAllUnits

  const tabs: { key: FinancesTab; label: string }[] = [
    { key: 'reportes', label: 'Reportes' },
    { key: 'cuenta', label: seesAllUnits ? 'Estados de cuenta' : 'Mi estado de cuenta' },
    ...(seesFiscal ? [{ key: 'fiscal' as const, label: 'Obligaciones fiscales' }] : []),
    ...(canManage ? [{ key: 'carga' as const, label: 'Carga contable' }] : []),
  ]

  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as FinancesTab | null
  const tab: FinancesTab = tabs.some((item) => item.key === requested)
    ? (requested as FinancesTab)
    : 'reportes'

  useAccountingRealtime(currentCondominiumId)
  const statementsQuery = useAccountingStatements(currentCondominiumId)

  const statements = useMemo(
    () =>
      (statementsQuery.data ?? [])
        .map(toStatementView)
        .sort((a, b) => a.unit.localeCompare(b.unit, 'es', { numeric: true })),
    [statementsQuery.data],
  )
  const [unitId, setUnitId] = useState<string | null>(null)
  useEffect(() => {
    if (!unitId && statements.length > 0) setUnitId(statements[0].apartmentId)
  }, [statements, unitId])
  const selected = statements.find((item) => item.apartmentId === unitId) ?? null
  const movementsQuery = useAccountingMovements(selected?.apartmentId ?? null)

  return {
    tab,
    setTab: (key: string) => setParams(key === 'reportes' ? {} : { tab: key }, { replace: true }),
    tabs,
    canManage,
    seesFiscal,

    // estado de cuenta
    accountLoading: statementsQuery.isLoading,
    accountError: statementsQuery.isError,
    retryAccount: () => void statementsQuery.refetch(),
    emptyHint: canManage
      ? 'Carga los estados de cuenta en "Carga contable" o conecta Siigo o Alegra.'
      : 'La administracion aun no ha cargado esta informacion.',
    seesAllUnits,
    unitOptions: statements.map((item) => ({ value: item.apartmentId, label: item.unit })),
    unitId: selected?.apartmentId ?? null,
    setUnitId,
    statement: selected,
    movements: toMovementViews(movementsQuery.data ?? []),
    movementsLoading: movementsQuery.isLoading && Boolean(selected),
  }
}

export type FinancesViewModel = ReturnType<typeof useFinancesViewModel>

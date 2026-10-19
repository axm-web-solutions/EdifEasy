import type { ModuleKey } from '@/constants/modules'
import type { RoleCode } from '@/types/database'
import type { RoleModuleCell } from '@/types/models'

export const DEFAULT_SCOPE = 'default'

/** Indice rol+modulo -> celda, para leer la matriz en O(1) desde la vista. */
export function indexCells(cells: RoleModuleCell[]): Map<string, RoleModuleCell> {
  return new Map(cells.map((cell) => [cellKey(cell.role, cell.module), cell]))
}

export function cellKey(role: RoleCode, module: ModuleKey): string {
  return `${role}:${module}`
}

/** Cuantas celdas difieren de "habilitado" y cuantas estan configuradas en el propio conjunto. */
export function summarizeCells(cells: RoleModuleCell[]) {
  return {
    disabled: cells.filter((cell) => !cell.enabled).length,
    customized: cells.filter((cell) => cell.source === 'condominium').length,
  }
}

/** Texto de ayuda segun el origen del valor de una celda. */
export function sourceHint(cell: RoleModuleCell | undefined, scopeIsDefault: boolean): string {
  if (!cell || cell.source === 'system') return 'Sin configurar: habilitado'
  if (cell.source === 'default')
    return scopeIsDefault ? 'Configurado en la plantilla' : 'Heredado de la plantilla'
  return 'Configurado en este conjunto'
}

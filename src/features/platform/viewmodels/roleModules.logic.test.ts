import { describe, expect, it } from 'vitest'
import { isNavItemVisible, visibleNavPaths } from '@/constants/navigation'
import type { RoleModuleCell } from '@/types/models'
import { cellKey, indexCells, sourceHint, summarizeCells } from './roleModules.logic'

const cells: RoleModuleCell[] = [
  { role: 'OWNER', module: 'fines', enabled: false, source: 'condominium' },
  { role: 'OWNER', module: 'visitors', enabled: true, source: 'default' },
  { role: 'TENANT', module: 'fines', enabled: true, source: 'system' },
]

describe('roleModules.logic', () => {
  it('indexa y resume la matriz', () => {
    expect(indexCells(cells).get(cellKey('OWNER', 'fines'))?.enabled).toBe(false)
    expect(summarizeCells(cells)).toEqual({ disabled: 1, customized: 1 })
  })

  it('explica de donde viene cada valor', () => {
    expect(sourceHint(cells[0], false)).toBe('Configurado en este conjunto')
    expect(sourceHint(cells[1], false)).toBe('Heredado de la plantilla')
    expect(sourceHint(cells[1], true)).toBe('Configurado en la plantilla')
    expect(sourceHint(undefined, false)).toBe('Sin configurar: habilitado')
  })
})

describe('menu con modulos deshabilitados', () => {
  const allow = () => true
  const finesOff = (module: string) => module !== 'fines'

  it('oculta el item del modulo desactivado', () => {
    const item = { key: 'fines', label: 'Multas', path: '/fines', module: 'fines' as const }
    expect(isNavItemVisible(item, allow, allow)).toBe(true)
    expect(isNavItemVisible(item, allow, allow, finesOff)).toBe(false)
  })

  it('la ruta desaparece de las secciones visibles (tours incluidos)', () => {
    expect(visibleNavPaths(allow, allow).has('/fines')).toBe(true)
    expect(visibleNavPaths(allow, allow, finesOff).has('/fines')).toBe(false)
    expect(visibleNavPaths(allow, allow, finesOff).has('/visitors')).toBe(true)
  })
})

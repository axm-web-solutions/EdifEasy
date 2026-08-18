import { describe, expect, it, vi } from 'vitest'
import { applyListParams, buildSearchExpression, runList } from './query'
import type { ListParams } from '@/types/models'

/** Doble de prueba que registra las llamadas encadenadas al builder. */
function createBuilderSpy() {
  const calls: { method: string; args: unknown[] }[] = []

  const builder: Record<string, unknown> = {}
  const methods = ['eq', 'neq', 'in', 'is', 'gte', 'lte', 'or', 'order', 'range']

  for (const method of methods) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  return { builder, calls }
}

const baseParams: ListParams = { page: 1, pageSize: 10 }

describe('buildSearchExpression', () => {
  it('genera una expresion ILIKE por cada columna', () => {
    expect(buildSearchExpression('luna', ['name', 'breed'])).toBe(
      'name.ilike.%luna%,breed.ilike.%luna%',
    )
  })

  it('escapa caracteres que romperian el filtro de PostgREST', () => {
    const expression = buildSearchExpression('a,b(c)%', ['name'])
    expect(expression).not.toContain(',b')
    expect(expression).not.toContain('(')
    expect(expression).not.toContain('%c')
  })

  it('devuelve null cuando no hay termino o columnas', () => {
    expect(buildSearchExpression('', ['name'])).toBeNull()
    expect(buildSearchExpression('hola', [])).toBeNull()
    expect(buildSearchExpression(undefined, ['name'])).toBeNull()
  })
})

describe('applyListParams', () => {
  it('aplica paginacion con el rango correcto', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(builder, { page: 3, pageSize: 20 })

    const range = calls.find((call) => call.method === 'range')
    expect(range?.args).toEqual([40, 59])
  })

  it('ordena por la columna indicada y direccion', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(builder, { ...baseParams, sortBy: 'amount', sortDir: 'asc' })

    const order = calls.find((call) => call.method === 'order')
    expect(order?.args[0]).toBe('amount')
    expect(order?.args[1]).toMatchObject({ ascending: true })
  })

  it('usa el orden por defecto cuando la UI no especifica ninguno', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(builder, baseParams, { defaultSort: { column: 'number', ascending: true } })

    const order = calls.find((call) => call.method === 'order')
    expect(order?.args[0]).toBe('number')
    expect(order?.args[1]).toMatchObject({ ascending: true })
  })

  it('convierte filtros simples en eq y arrays en in', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(builder, {
      ...baseParams,
      filters: { status: 'ACTIVE', type: ['WATER', 'GAS'], ignored: '', nulo: null },
    })

    expect(calls).toContainEqual({ method: 'eq', args: ['status', 'ACTIVE'] })
    expect(calls).toContainEqual({ method: 'in', args: ['type', ['WATER', 'GAS']] })
    expect(calls.some((call) => call.args[0] === 'ignored')).toBe(false)
    expect(calls.some((call) => call.args[0] === 'nulo')).toBe(false)
  })

  it('aplica rangos de fecha sobre la columna configurada', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(
      builder,
      { ...baseParams, dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      { dateColumn: 'expense_date' },
    )

    expect(calls).toContainEqual({ method: 'gte', args: ['expense_date', '2026-01-01'] })
    expect(calls).toContainEqual({ method: 'lte', args: ['expense_date', '2026-01-31'] })
  })

  it('limita el tamano de pagina al maximo permitido', () => {
    const { builder, calls } = createBuilderSpy()
    applyListParams(builder, { page: 1, pageSize: 5000 })

    const range = calls.find((call) => call.method === 'range')
    expect(range?.args).toEqual([0, 199])
  })
})

describe('runList', () => {
  it('devuelve datos, total y paginacion', async () => {
    const builder = {
      order: () => builder,
      range: () => builder,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [{ id: '1' }], error: null, count: 42 })),
    }

    const result = await runList<{ id: string }>(builder, { page: 2, pageSize: 10 })

    expect(result.data).toEqual([{ id: '1' }])
    expect(result.total).toBe(42)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(10)
  })

  it('lanza un AppError traducido cuando PostgREST devuelve error', async () => {
    const builder = {
      order: () => builder,
      range: () => builder,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            data: null,
            count: null,
            error: { code: '42501', message: 'permission denied', details: '', hint: '' },
          }),
        ),
    }

    await expect(runList(builder, { page: 1, pageSize: 10 })).rejects.toThrowError(
      'No tienes permisos para realizar esta accion.',
    )
  })
})

describe('integracion con vitest', () => {
  it('los spies se limpian entre pruebas', () => {
    const spy = vi.fn()
    spy()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

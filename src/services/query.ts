import type { PostgrestError } from '@supabase/supabase-js'
import { toAppError } from '@/lib/errors'
import type { ListParams, ListResult } from '@/types/models'

/**
 * Utilidades compartidas por todos los servicios: paginacion, busqueda,
 * ordenamiento, filtros y rangos de fecha del lado del servidor.
 *
 * Nota de tipado: el cliente tipado de Supabase exige literales de columna en
 * `eq/in/gte/...`, pero aqui las columnas son dinamicas (vienen de la UI). Se
 * define una fachada minima (`FilterableBuilder`) con la firma real en runtime
 * y se hace una unica conversion explicita. No se usa `any` en ningun punto.
 */
interface FilterableBuilder {
  eq(column: string, value: string | number | boolean): FilterableBuilder
  neq(column: string, value: string | number | boolean): FilterableBuilder
  in(column: string, values: readonly (string | number)[]): FilterableBuilder
  is(column: string, value: null): FilterableBuilder
  gte(column: string, value: string | number): FilterableBuilder
  lte(column: string, value: string | number): FilterableBuilder
  or(filters: string): FilterableBuilder
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): FilterableBuilder
  range(from: number, to: number): FilterableBuilder
}

interface ExecutableBuilder<T> {
  then<TResult1 = { data: T[] | null; error: PostgrestError | null; count: number | null }>(
    onfulfilled?:
      | ((value: { data: T[] | null; error: PostgrestError | null; count: number | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1>
}

export interface ListOptions {
  /** Columnas incluidas en la busqueda de texto (ILIKE). */
  searchColumns?: string[]
  /** Orden por defecto cuando la UI no especifica uno. */
  defaultSort?: { column: string; ascending: boolean }
  /** Columna usada para los filtros por rango de fechas. */
  dateColumn?: string
  /** Tope de paginacion. */
  maxPageSize?: number
}

const DEFAULT_PAGE_SIZE = 10

function escapeSearchTerm(term: string): string {
  // PostgREST usa `,` y `)` como separadores dentro de `or(...)`.
  return term.replace(/[,()%]/g, ' ').trim()
}

export function buildSearchExpression(
  search: string | undefined,
  columns: string[] | undefined,
): string | null {
  if (!search || !columns || columns.length === 0) return null
  const term = escapeSearchTerm(search)
  if (!term) return null
  return columns.map((column) => `${column}.ilike.%${term}%`).join(',')
}

export function applyListParams<T>(builder: T, params: ListParams, options: ListOptions = {}): T {
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(Math.max(1, params.pageSize || DEFAULT_PAGE_SIZE), options.maxPageSize ?? 200)

  let query = builder as unknown as FilterableBuilder

  const searchExpression = buildSearchExpression(params.search, options.searchColumns)
  if (searchExpression) {
    query = query.or(searchExpression)
  }

  for (const [column, value] of Object.entries(params.filters ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) query = query.in(column, value)
      continue
    }
    if (value === '__NULL__') {
      query = query.is(column, null)
      continue
    }
    query = query.eq(column, value)
  }

  const dateColumn = params.dateField ?? options.dateColumn
  if (dateColumn && params.dateFrom) query = query.gte(dateColumn, params.dateFrom)
  if (dateColumn && params.dateTo) query = query.lte(dateColumn, params.dateTo)

  const sortColumn = params.sortBy ?? options.defaultSort?.column ?? 'created_at'
  const ascending = params.sortDir
    ? params.sortDir === 'asc'
    : (options.defaultSort?.ascending ?? false)

  query = query.order(sortColumn, { ascending, nullsFirst: false })
  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  return query as unknown as T
}

/** Ejecuta un builder ya construido y devuelve un `ListResult` paginado. */
export async function runList<T>(
  builder: unknown,
  params: ListParams,
  options: ListOptions = {},
): Promise<ListResult<T>> {
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(Math.max(1, params.pageSize || DEFAULT_PAGE_SIZE), options.maxPageSize ?? 200)

  const query = applyListParams(builder, params, options)
  const { data, error, count } = await (query as unknown as ExecutableBuilder<T>)

  if (error) throw toAppError(error)

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  }
}




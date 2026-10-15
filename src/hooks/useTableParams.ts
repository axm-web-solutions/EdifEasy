import { useCallback, useState } from 'react'
import type { FilterValue, ListParams, SortDirection } from '@/types/models'

export interface UseTableParamsResult {
  params: ListParams
  setPage: (page: number, pageSize?: number) => void
  setSearch: (search: string) => void
  setSort: (sortBy: string | undefined, sortDir: SortDirection | undefined) => void
  setFilter: (key: string, value: FilterValue) => void
  setFilters: (filters: Record<string, FilterValue>) => void
  setDateRange: (from: string | null, to: string | null) => void
  reset: () => void
  hasActiveFilters: boolean
}

export function useTableParams(initial: Partial<ListParams> = {}): UseTableParamsResult {
  // `initialParams` se calcula UNA vez (inicializador perezoso de useState). Antes
  // se reconstruia en cada render y `reset` lo capturaba del primer render con un
  // `eslint-disable`: funcionaba solo mientras `initial` fuese un literal estable.
  const [initialParams] = useState<ListParams>(() => ({
    page: 1,
    pageSize: 10,
    search: '',
    filters: {},
    dateFrom: null,
    dateTo: null,
    ...initial,
  }))

  const [params, setParams] = useState<ListParams>(initialParams)

  const setPage = useCallback((page: number, pageSize?: number) => {
    setParams((previous) => ({ ...previous, page, pageSize: pageSize ?? previous.pageSize }))
  }, [])

  const setSearch = useCallback((search: string) => {
    setParams((previous) => ({ ...previous, search, page: 1 }))
  }, [])

  const setSort = useCallback((sortBy: string | undefined, sortDir: SortDirection | undefined) => {
    setParams((previous) => ({ ...previous, sortBy, sortDir }))
  }, [])

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setParams((previous) => ({
      ...previous,
      page: 1,
      filters: { ...previous.filters, [key]: value },
    }))
  }, [])

  const setFilters = useCallback((filters: Record<string, FilterValue>) => {
    setParams((previous) => ({ ...previous, page: 1, filters }))
  }, [])

  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setParams((previous) => ({ ...previous, page: 1, dateFrom: from, dateTo: to }))
  }, [])

  const reset = useCallback(() => setParams(initialParams), [initialParams])

  const hasActiveFilters =
    Boolean(params.search) ||
    Boolean(params.dateFrom) ||
    Boolean(params.dateTo) ||
    Object.values(params.filters ?? {}).some(
      (value) => value !== undefined && value !== null && value !== '',
    )

  return { params, setPage, setSearch, setSort, setFilter, setFilters, setDateRange, reset, hasActiveFilters }
}

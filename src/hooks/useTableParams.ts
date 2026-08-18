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
  const initialParams: ListParams = {
    page: 1,
    pageSize: 10,
    search: '',
    filters: {},
    dateFrom: null,
    dateTo: null,
    ...initial,
  }

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

  const reset = useCallback(() => {
    setParams(initialParams)
    // `initialParams` se reconstruye en cada render pero su contenido es estable
    // porque `initial` proviene de constantes de la pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasActiveFilters =
    Boolean(params.search) ||
    Boolean(params.dateFrom) ||
    Boolean(params.dateTo) ||
    Object.values(params.filters ?? {}).some(
      (value) => value !== undefined && value !== null && value !== '',
    )

  return { params, setPage, setSearch, setSort, setFilter, setFilters, setDateRange, reset, hasActiveFilters }
}

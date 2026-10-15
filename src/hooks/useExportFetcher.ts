import { useCallback } from 'react'
import type { ListParams, ListResult } from '@/types/models'

/** Filas que se exportan como maximo (la exportacion ignora la paginacion). */
export const EXPORT_LIMIT = 1000

/**
 * Funcion de exportacion para `DataTable`: vuelve a pedir el listado con los
 * mismos filtros de la tabla pero sin paginar.
 */
export function useExportFetcher<T>(
  list: (condominiumId: string, params: ListParams) => Promise<ListResult<T>>,
  condominiumId: string | null,
  params: ListParams,
) {
  return useCallback(async () => {
    if (!condominiumId) return []
    const result = await list(condominiumId, { ...params, page: 1, pageSize: EXPORT_LIMIT })
    return result.data
  }, [list, condominiumId, params])
}

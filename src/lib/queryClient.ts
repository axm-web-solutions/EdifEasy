import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query'
import { toAppError } from './errors'
import { logger } from './logger'
import { notify } from './notify'

/**
 * Cliente de TanStack Query con manejo global de errores:
 * cualquier query o mutacion fallida registra el error y muestra un mensaje
 * amigable, sin exponer detalles internos de PostgreSQL.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const appError = toAppError(error)
        if (['RLS_DENIED', '42501', 'PGRST116', 'P0002'].includes(appError.code)) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const appError = toAppError(error)
      logger.error('Query fallida', error, { queryKey: query.queryKey })
      if (query.meta?.silent !== true) {
        notify.error(appError.message)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const appError = toAppError(error)
      logger.error('Mutacion fallida', error, { mutationKey: mutation.options.mutationKey })
      if (mutation.meta?.silent !== true) {
        notify.error(appError.message)
      }
    },
  }),
})

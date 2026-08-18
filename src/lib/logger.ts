import { env, isProduction } from './env'
import { toAppError } from './errors'

/**
 * Logger central. Preparado para Sentry:
 * si defines `VITE_SENTRY_DSN` e instalas `@sentry/react`, basta con
 * implementar `installSentryTransport` para enviar los eventos.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEvent {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: unknown
  timestamp: string
}

type Transport = (event: LogEvent) => void

const transports: Transport[] = []

/** Registra un transporte externo (Sentry, Datadog, etc.). */
function addTransport(transport: Transport): () => void {
  transports.push(transport)
  return () => {
    const index = transports.indexOf(transport)
    if (index >= 0) transports.splice(index, 1)
  }
}

function emit(event: LogEvent): void {
  for (const transport of transports) {
    try {
      transport(event)
    } catch {
      // Un transporte roto nunca debe tumbar la aplicacion.
    }
  }

  if (isProduction && event.level === 'debug') return

  const payload = event.context ? [event.message, event.context] : [event.message]
  if (event.level === 'error') {
    console.error('[edifeasy]', ...payload, event.error ?? '')
  } else if (event.level === 'warn') {
    console.warn('[edifeasy]', ...payload)
  } else if (!isProduction) {
    console.warn('[edifeasy]', ...payload)
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    emit({ level: 'debug', message, context, timestamp: new Date().toISOString() })
  },
  info(message: string, context?: Record<string, unknown>): void {
    emit({ level: 'info', message, context, timestamp: new Date().toISOString() })
  },
  warn(message: string, context?: Record<string, unknown>): void {
    emit({ level: 'warn', message, context, timestamp: new Date().toISOString() })
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const appError = error ? toAppError(error) : undefined
    emit({
      level: 'error',
      message,
      error,
      context: {
        ...context,
        code: appError?.code,
        technical: appError?.technical,
      },
      timestamp: new Date().toISOString(),
    })
  },
}

/**
 * Punto de integracion con Sentry.
 *
 * @public Extension documentada: no se invoca en el codigo porque Sentry es
 * opcional. Se activa desde `main.tsx` cuando exista `VITE_SENTRY_DSN`.
 *
 * Para activarlo:
 *   npm i @sentry/react
 *   // en main.tsx
 *   import * as Sentry from '@sentry/react'
 *   Sentry.init({ dsn: env.VITE_SENTRY_DSN })
 *   installSentryTransport((event) => Sentry.captureMessage(event.message))
 */
export function installSentryTransport(capture: (event: LogEvent) => void): () => void {
  if (!env.VITE_SENTRY_DSN) {
    logger.info('Sentry no configurado: VITE_SENTRY_DSN vacio')
    return () => undefined
  }
  return addTransport(capture)
}

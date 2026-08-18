import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Sistema central de errores.
 *
 * Traduce errores tecnicos (PostgreSQL, PostgREST, Auth, Storage) a mensajes
 * en espanol comprensibles para el usuario final. Los detalles tecnicos se
 * conservan en `technical` para el logger, nunca se muestran en pantalla.
 */
export class AppError extends Error {
  readonly code: string
  readonly technical?: string
  readonly status?: number

  constructor(message: string, options: { code?: string; technical?: string; status?: number } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = options.code ?? 'UNKNOWN'
    this.technical = options.technical
    this.status = options.status
  }
}

const POSTGRES_MESSAGES: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos. Verifica los valores unicos.',
  '23503': 'No se puede completar la operacion porque el registro esta relacionado con otros datos.',
  '23502': 'Falta completar un campo obligatorio.',
  '23514': 'Alguno de los valores enviados no cumple las reglas de validacion.',
  '22P02': 'Alguno de los valores enviados tiene un formato invalido.',
  '22023': 'Alguno de los valores enviados no es valido.',
  '42501': 'No tienes permisos para realizar esta accion.',
  '42P01': 'La tabla solicitada no existe. Ejecuta supabase/schema.sql en tu proyecto.',
  '42883': 'La funcion solicitada no existe. Ejecuta supabase/schema.sql en tu proyecto.',
  // PostgREST no encuentra la funcion/tabla en su cache de esquema: casi siempre
  // significa que falta correr el SQL del proyecto, no un fallo de red.
  PGRST202:
    'Falta una funcion en la base de datos. Ejecuta supabase/schema.sql y los parches de supabase/patches/ en el SQL Editor.',
  PGRST205:
    'Falta una tabla en la base de datos. Ejecuta supabase/schema.sql en el SQL Editor.',
  PGRST106:
    'El esquema de la aplicacion no esta expuesto en la API. Agregalo en Settings > API > Exposed schemas.',
  P0001: 'La operacion fue rechazada por una regla del sistema.',
  P0002: 'No se encontro el registro solicitado.',
  PGRST116: 'No se encontro el registro solicitado.',
  PGRST301: 'Tu sesion expiro. Inicia sesion nuevamente.',
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contrasena incorrectos.',
  invalid_login_credentials: 'Correo o contrasena incorrectos.',
  email_not_confirmed: 'Debes confirmar tu correo electronico antes de iniciar sesion.',
  user_already_exists: 'Ya existe una cuenta registrada con ese correo.',
  weak_password: 'La contrasena es demasiado debil. Usa al menos 8 caracteres.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  same_password: 'La nueva contrasena debe ser diferente a la actual.',
  session_not_found: 'Tu sesion expiro. Inicia sesion nuevamente.',
}

/**
 * Los errores de PostgREST traen siempre `details` y `hint`. Los de Supabase
 * Auth traen `code`/`status` pero no esos campos: distinguirlos es necesario
 * para no traducir un error de login como si fuera de base de datos.
 */
function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'details' in value &&
    'hint' in value
  )
}

/** Convierte cualquier error en un `AppError` con mensaje amigable. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (isPostgrestError(error)) {
    const code = error.code ?? 'UNKNOWN'
    const known = POSTGRES_MESSAGES[code]

    /*
     * P0001 y P0002 son los codigos con los que las funciones de este proyecto
     * rechazan una operacion, y su mensaje esta escrito para el usuario final:
     * "Ese apartamento ya tiene un propietario registrado. Contacta a la
     * administracion." Cambiarlo por un texto generico le quita exactamente la
     * informacion que necesita para saber que hacer, asi que se muestra tal cual.
     * Si viniera sin mensaje, se cae al texto del mapa.
     */
    if ((code === 'P0001' || code === 'P0002') && error.message.trim().length > 0) {
      return new AppError(error.message.trim(), { code, technical: error.details ?? undefined })
    }

    if (known) {
      return new AppError(known, { code, technical: `${error.message} ${error.details ?? ''}`.trim() })
    }

    // Violacion de RLS: PostgREST devuelve 42501 o un mensaje explicito.
    if (/row-level security|violates row-level/i.test(error.message)) {
      return new AppError('No tienes permisos para realizar esta accion.', {
        code: 'RLS_DENIED',
        technical: error.message,
      })
    }

    return new AppError('No fue posible completar la operacion. Intenta nuevamente.', {
      code,
      technical: `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.trim(),
    })
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: string; code?: string; status?: number; name?: string }

    if (candidate.code && AUTH_MESSAGES[candidate.code]) {
      return new AppError(AUTH_MESSAGES[candidate.code], {
        code: candidate.code,
        technical: candidate.message,
        status: candidate.status,
      })
    }

    if (candidate.message) {
      const normalized = candidate.message.toLowerCase()
      const matched = Object.keys(AUTH_MESSAGES).find((key) =>
        normalized.includes(key.replace(/_/g, ' ')),
      )
      if (matched) {
        return new AppError(AUTH_MESSAGES[matched], {
          code: matched,
          technical: candidate.message,
          status: candidate.status,
        })
      }

      if (candidate.name === 'AuthRetryableFetchError' || normalized.includes('failed to fetch')) {
        return new AppError(
          'No se pudo conectar con el servidor. Revisa tu conexion o la configuracion de Supabase.',
          { code: 'NETWORK', technical: candidate.message },
        )
      }

      if (normalized.includes('bucket not found')) {
        return new AppError(
          'El bucket de almacenamiento no existe. Crealo en Supabase Storage.',
          { code: 'BUCKET_NOT_FOUND', technical: candidate.message },
        )
      }

      if (normalized.includes('object not found') || normalized.includes('not_found')) {
        return new AppError('El archivo solicitado no existe en el almacenamiento.', {
          code: 'OBJECT_NOT_FOUND',
          technical: candidate.message,
        })
      }

      return new AppError('Ocurrio un error inesperado. Intenta nuevamente.', {
        code: candidate.code ?? 'UNKNOWN',
        technical: candidate.message,
        status: candidate.status,
      })
    }
  }

  if (typeof error === 'string') {
    return new AppError(error, { code: 'UNKNOWN' })
  }

  return new AppError('Ocurrio un error inesperado. Intenta nuevamente.', { code: 'UNKNOWN' })
}

/** Mensaje listo para mostrar en la UI. */
export function getErrorMessage(error: unknown): string {
  return toAppError(error).message
}

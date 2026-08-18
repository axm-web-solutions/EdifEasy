import { describe, expect, it } from 'vitest'
import { AppError, getErrorMessage, toAppError } from './errors'

describe('toAppError', () => {
  it('traduce violaciones de unicidad de PostgreSQL', () => {
    const error = toAppError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "buildings_condominium_id_number_key"',
      details: '',
      hint: '',
    })

    expect(error).toBeInstanceOf(AppError)
    expect(error.message).toBe('Ya existe un registro con esos datos. Verifica los valores unicos.')
    expect(error.code).toBe('23505')
  })

  it('traduce errores de permisos (RLS)', () => {
    const error = toAppError({
      code: '42501',
      message: 'permission denied for table expenses',
      details: '',
      hint: '',
    })

    expect(error.message).toBe('No tienes permisos para realizar esta accion.')
  })

  it('detecta violaciones de row-level security sin codigo conocido', () => {
    const error = toAppError({
      code: 'XX000',
      message: 'new row violates row-level security policy for table "alerts"',
      details: '',
      hint: '',
    })

    expect(error.code).toBe('RLS_DENIED')
    expect(error.message).toBe('No tienes permisos para realizar esta accion.')
  })

  it('nunca expone el mensaje tecnico de PostgreSQL al usuario', () => {
    const technical = 'null value in column "condominium_id" of relation "alerts" violates not-null'
    const error = toAppError({ code: '23502', message: technical, details: '', hint: '' })

    expect(error.message).not.toContain('condominium_id')
    expect(error.technical).toContain('condominium_id')
  })

  it('traduce credenciales invalidas de Supabase Auth', () => {
    const error = toAppError({ code: 'invalid_credentials', message: 'Invalid login credentials' })
    expect(error.message).toBe('Correo o contrasena incorrectos.')
  })

  it('detecta errores de red', () => {
    const error = toAppError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })
    expect(error.code).toBe('NETWORK')
  })

  it('devuelve un mensaje generico ante errores desconocidos', () => {
    expect(getErrorMessage(undefined)).toBe('Ocurrio un error inesperado. Intenta nuevamente.')
  })

  it('explica que falta ejecutar el SQL cuando PostgREST no encuentra la funcion', () => {
    const error = toAppError({
      code: 'PGRST202',
      message: 'Could not find the function tribuia.registration_catalog in the schema cache',
      details: 'Searched for the function tribuia.registration_catalog...',
      hint: null,
    })

    // El usuario debe saber que accion tomar, no leer "error inesperado".
    expect(error.message).toContain('supabase/schema.sql')
    expect(error.message).not.toContain('schema cache')
  })

  it('explica que el esquema no esta expuesto en la API', () => {
    const error = toAppError({
      code: 'PGRST106',
      message: 'The schema must be one of the following: public',
      details: '',
      hint: '',
    })

    expect(error.message).toContain('Exposed schemas')
  })

  it('conserva los AppError ya construidos', () => {
    const original = new AppError('Mensaje propio', { code: 'CUSTOM' })
    expect(toAppError(original)).toBe(original)
  })

  it('muestra tal cual el motivo que escribe una funcion SQL (P0001)', () => {
    const error = toAppError({
      code: 'P0001',
      message: 'Ese apartamento ya tiene un propietario registrado. Contacta a la administracion.',
      details: null,
      hint: null,
    })

    // El motivo lo escribe la funcion para el usuario: sustituirlo por un texto
    // generico le quitaria la unica pista de que hacer a continuacion.
    expect(error.message).toBe(
      'Ese apartamento ya tiene un propietario registrado. Contacta a la administracion.',
    )
    expect(error.code).toBe('P0001')
  })

  it('cae al texto generico si P0002 llega sin mensaje', () => {
    const error = toAppError({ code: 'P0002', message: '   ', details: null, hint: null })
    expect(error.message).toBe('No se encontro el registro solicitado.')
  })
})

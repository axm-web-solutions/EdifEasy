import { describe, expect, it } from 'vitest'
import {
  extractToken,
  normalizeAlarmEvent,
  parseBody,
  parseContactId,
  parseSia,
  typeFromText,
} from './alarmEvents'

const TOKEN = 'a'.repeat(64)

describe('normalizacion de eventos de alarma', () => {
  it('JSON generico con el tipo canonico', () => {
    const event = normalizeAlarmEvent({
      event_type: 'PANIC',
      zone: 'Sala',
      message: 'Boton presionado',
      occurred_at: '2026-10-20T15:00:00Z',
    })
    expect(event).toMatchObject({
      event_type: 'PANIC',
      zone: 'Sala',
      message: 'Boton presionado',
      occurred_at: '2026-10-20T15:00:00.000Z',
    })
  })

  it('palabras en espanol e ingles, en cualquier nivel', () => {
    expect(
      normalizeAlarmEvent({ data: { event: { type: 'Alarma de incendio' } } }).event_type,
    ).toBe('FIRE')
    expect(normalizeAlarmEvent({ tipo: 'Pánico' }).event_type).toBe('PANIC')
    expect(normalizeAlarmEvent({ eventType: 'MotionDetected' }).event_type).toBe('INTRUSION')
    expect(normalizeAlarmEvent({ type: 'low_battery', device: 'Sensor puerta' })).toMatchObject({
      event_type: 'LOW_BATTERY',
      zone: 'Sensor puerta',
    })
    expect(normalizeAlarmEvent({ event: 'AC power loss' }).event_type).toBe('POWER_FAILURE')
    expect(normalizeAlarmEvent({ event: 'AC power restored' }).event_type).toBe('POWER_RESTORED')
  })

  it('desarmado no se confunde con armado', () => {
    expect(typeFromText('Disarmed by user')).toBe('DISARMED')
    expect(typeFromText('Sistema desarmado')).toBe('DISARMED')
    expect(typeFromText('Armed away')).toBe('ARMED')
    expect(typeFromText('Armado parcial (modo casa)')).toBe('PARTIAL_ARMED')
    expect(typeFromText('Alarm restored')).toBe('ALARM_RESTORED')
  })

  it('Contact ID de una receptora de monitoreo', () => {
    expect(parseContactId('18 1 130 01 015')).toEqual({
      type: 'INTRUSION',
      zone: '15',
      code: '1130 01 015',
    })
    expect(parseContactId('1110 01 003')?.type).toBe('FIRE')
    expect(parseContactId('1121 01 000')?.type).toBe('DURESS')
    expect(parseContactId('3130 01 015')?.type).toBe('ALARM_RESTORED')
    expect(parseContactId('1401 01 002')?.type).toBe('DISARMED')
    expect(parseContactId('3401 01 002')?.type).toBe('ARMED')
    expect(parseContactId('1302 00 000')?.type).toBe('LOW_BATTERY')
    expect(normalizeAlarmEvent({ code: '1120 01 007' })).toMatchObject({
      event_type: 'PANIC',
      zone: '7',
    })
  })

  it('codigos SIA', () => {
    expect(parseSia('BA015')).toEqual({ type: 'INTRUSION', zone: '15', code: 'BA015' })
    expect(parseSia('Nri1/FA003')?.type).toBe('FIRE')
    expect(parseSia('OP')?.type).toBe('DISARMED')
    expect(normalizeAlarmEvent({ sia: 'PA001' })).toMatchObject({ event_type: 'PANIC', zone: '1' })
  })

  it('texto plano y formulario', () => {
    expect(normalizeAlarmEvent(parseBody('18 1 110 01 004', 'text/plain'))).toMatchObject({
      event_type: 'FIRE',
      zone: '4',
    })
    expect(
      normalizeAlarmEvent(
        parseBody('event=panic&zone=Cocina', 'application/x-www-form-urlencoded'),
      ),
    ).toMatchObject({
      event_type: 'PANIC',
      zone: 'Cocina',
    })
  })

  it('tipo desconocido queda como OTHER y el token no se guarda', () => {
    const event = normalizeAlarmEvent({ foo: 'bar', key: TOKEN }, { token: TOKEN })
    expect(event.event_type).toBe('OTHER')
    expect(JSON.stringify(event.payload)).not.toContain(TOKEN)
  })

  it('hora en epoch segundos y milisegundos', () => {
    expect(normalizeAlarmEvent({ type: 'panic', timestamp: '1760972400' }).occurred_at).toBe(
      new Date(1760972400 * 1000).toISOString(),
    )
    expect(normalizeAlarmEvent({ type: 'panic', timestamp: '1760972400000' }).occurred_at).toBe(
      new Date(1760972400000).toISOString(),
    )
  })

  it('token por query, cabecera o ruta', () => {
    const headers = new Headers()
    expect(
      extractToken(new URL(`https://x/functions/v1/alarm-webhook?key=${TOKEN}`), headers),
    ).toBe(TOKEN)
    expect(extractToken(new URL(`https://x/functions/v1/alarm-webhook/${TOKEN}`), headers)).toBe(
      TOKEN,
    )
    expect(
      extractToken(
        new URL('https://x/functions/v1/alarm-webhook'),
        new Headers({ 'x-edifeasy-key': TOKEN }),
      ),
    ).toBe(TOKEN)
    expect(
      extractToken(new URL('https://x/functions/v1/alarm-webhook?key=corto'), headers),
    ).toBeNull()
  })
})

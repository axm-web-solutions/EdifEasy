/**
 * Alarmas conectadas por unidad. Las alarmas se crean y administran por RPC
 * (validan que sea la administracion o el propietario de la unidad); los
 * eventos los registra solo el servidor (Edge Function alarm-webhook).
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { env } from '@/lib/env'
import { toAppError } from '@/lib/errors'
import type { AlarmDeviceRow, AlarmEventRow, AlarmProvider } from '@/types/database'

type UnitRef = { id: string; number: string; building: { name: string } | null } | null

export interface AlarmDeviceWithUnit extends AlarmDeviceRow {
  apartment: UnitRef
}

export interface AlarmEventWithDevice extends AlarmEventRow {
  device: { id: string; name: string; provider: AlarmProvider; location: string | null } | null
  apartment: UnitRef
}

// El hash del token no tiene permiso de lectura: las columnas van explicitas.
const DEVICE_COLUMNS = `id, condominium_id, apartment_id, building_id, name, provider, location, notes,
  token_hint, is_active, armed_state, last_event_at, last_event_type, created_by, created_at, updated_at,
  apartment:apartments(id, number, building:buildings(name))`

const EVENT_COLUMNS = `*, device:alarm_devices(id, name, provider, location),
  apartment:apartments(id, number, building:buildings(name))`

export interface AlarmDeviceInput {
  name: string
  provider: AlarmProvider
  location: string | null
  notes: string | null
}

/** URL secreta que se configura en el panel, la app del fabricante o la central. */
export function alarmWebhookUrl(token: string): string {
  return `${env.VITE_SUPABASE_URL}/functions/v1/alarm-webhook?key=${token}`
}

export const alarmService = {
  async devices(condominiumId: string): Promise<AlarmDeviceWithUnit[]> {
    const { data, error } = await supabase
      .from('alarm_devices')
      .select(DEVICE_COLUMNS)
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: true })
      .returns<AlarmDeviceWithUnit[]>()
    if (error) throw toAppError(error)
    return data
  },

  async events(condominiumId: string, from: string): Promise<AlarmEventWithDevice[]> {
    const { data, error } = await supabase
      .from('alarm_events')
      .select(EVENT_COLUMNS)
      .eq('condominium_id', condominiumId)
      .gte('received_at', from)
      .order('received_at', { ascending: false })
      .limit(300)
      .returns<AlarmEventWithDevice[]>()
    if (error) throw toAppError(error)
    return data
  },

  /** Devuelve el token: es la unica vez que se puede ver. */
  async create(
    condominiumId: string,
    apartmentId: string | null,
    input: AlarmDeviceInput,
  ): Promise<{ id: string; token: string }> {
    const { data, error } = await supabase.rpc('create_alarm_device', {
      p_condominium: condominiumId,
      p_apartment: apartmentId,
      p_name: input.name,
      p_provider: input.provider,
      p_location: input.location,
      p_notes: input.notes,
    })
    if (error) throw toAppError(error)
    return data as unknown as { id: string; token: string }
  },

  async update(deviceId: string, input: AlarmDeviceInput & { is_active: boolean }): Promise<void> {
    const { error } = await supabase.rpc('update_alarm_device', {
      p_device: deviceId,
      p_name: input.name,
      p_provider: input.provider,
      p_location: input.location,
      p_notes: input.notes,
      p_is_active: input.is_active,
    })
    if (error) throw toAppError(error)
  },

  async rotateToken(deviceId: string): Promise<string> {
    const { data, error } = await supabase.rpc('rotate_alarm_device_token', { p_device: deviceId })
    if (error) throw toAppError(error)
    return data
  },

  async remove(deviceId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_alarm_device', { p_device: deviceId })
    if (error) throw toAppError(error)
  },

  async test(deviceId: string): Promise<void> {
    const { error } = await supabase.rpc('test_alarm_device', { p_device: deviceId })
    if (error) throw toAppError(error)
  },

  async acknowledge(eventId: string, note: string | null): Promise<void> {
    const { error } = await supabase.rpc('acknowledge_alarm_event', {
      p_event: eventId,
      p_note: note,
    })
    if (error) throw toAppError(error)
  },

  /** Eventos nuevos en vivo (RLS filtra lo que cada quien puede ver). */
  subscribe(condominiumId: string, onEvent: (event: AlarmEventRow) => void): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`alarm-events:${condominiumId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: DB_SCHEMA,
          table: 'alarm_events',
          filter: `condominium_id=eq.${condominiumId}`,
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as AlarmEventRow | undefined
          if (record) onEvent(record)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },
}

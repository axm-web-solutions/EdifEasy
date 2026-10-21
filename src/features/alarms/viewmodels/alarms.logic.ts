import type { AlarmDeviceWithUnit, AlarmEventWithDevice } from '@/services/alarmService'
import type { AlarmEventType, AlarmProvider, AlarmSeverity } from '@/types/database'
import { formatDateTime, formatRelative } from '@/utils/format'

export const PROVIDER_LABELS: Record<AlarmProvider, string> = {
  GENERIC: 'Generica (webhook)',
  AJAX: 'Ajax',
  HIKVISION: 'Hikvision',
  DAHUA: 'Dahua',
  PARADOX: 'Paradox',
  DSC: 'DSC',
  HONEYWELL: 'Honeywell / Resideo',
  TEXECOM: 'Texecom',
  MONITORING_CENTER: 'Central de monitoreo',
  OTHER: 'Otra',
}

/** Como se conecta cada marca (todas terminan en la misma URL). */
export const PROVIDER_SETUP: Record<AlarmProvider, string> = {
  GENERIC:
    'Configura en el panel, la app o el sistema que envie los eventos una notificacion HTTP (webhook) a esta URL.',
  AJAX: 'En Ajax PRO o con tu empresa de monitoreo, agrega una integracion por webhook con esta URL. Si la monitorea una central, entregale la URL.',
  HIKVISION:
    'En el panel AX PRO / Hik-Connect, configura el envio de eventos a un servidor HTTP con esta URL, o pidelo a tu instalador.',
  DAHUA:
    'En DMSS o el panel, configura el envio de alarmas a un servidor HTTP con esta URL, o pidelo a tu instalador.',
  PARADOX:
    'Paradox envia los eventos por su modulo IP a una receptora. Entrega esta URL a tu central de monitoreo para que reenvie los eventos.',
  DSC: 'Los paneles DSC reportan a una receptora (Contact ID / SIA). Entrega esta URL a tu central de monitoreo para que reenvie los eventos.',
  HONEYWELL:
    'Usa el modulo de comunicacion del panel o tu central de monitoreo para reenviar los eventos a esta URL.',
  TEXECOM:
    'Configura el modulo de comunicacion (SmartCom) o tu central de monitoreo para reenviar los eventos a esta URL.',
  MONITORING_CENTER:
    'La central reenvia cada evento de la receptora (Contact ID o SIA) a esta URL, en JSON o texto.',
  OTHER:
    'Cualquier sistema que pueda enviar una notificacion HTTP sirve. Se reconocen JSON, formularios, Contact ID y SIA.',
}

interface EventMeta {
  label: string
  color: string
}

export const EVENT_META: Record<AlarmEventType, EventMeta> = {
  PANIC: { label: 'Boton de panico', color: 'red' },
  FIRE: { label: 'Incendio', color: 'red' },
  INTRUSION: { label: 'Intrusion', color: 'red' },
  MEDICAL: { label: 'Emergencia medica', color: 'red' },
  GAS: { label: 'Fuga de gas', color: 'red' },
  FLOOD: { label: 'Inundacion', color: 'volcano' },
  DURESS: { label: 'Coaccion (silenciosa)', color: 'magenta' },
  TAMPER: { label: 'Sabotaje', color: 'orange' },
  LOW_BATTERY: { label: 'Bateria baja', color: 'gold' },
  POWER_FAILURE: { label: 'Falla de energia', color: 'gold' },
  COMMUNICATION_FAILURE: { label: 'Sin comunicacion', color: 'gold' },
  ARMED: { label: 'Armada', color: 'blue' },
  DISARMED: { label: 'Desarmada', color: 'default' },
  PARTIAL_ARMED: { label: 'Armado parcial', color: 'geekblue' },
  ALARM_RESTORED: { label: 'Restaurada', color: 'green' },
  POWER_RESTORED: { label: 'Energia restablecida', color: 'green' },
  TEST: { label: 'Prueba', color: 'default' },
  OTHER: { label: 'Otro evento', color: 'default' },
}

export const SEVERITY_LABELS: Record<AlarmSeverity, string> = {
  CRITICAL: 'Critico',
  HIGH: 'Alto',
  TECHNICAL: 'Tecnico',
  INFO: 'Informativo',
}

type UnitRef = AlarmDeviceWithUnit['apartment']

export function unitLabel(apartment: UnitRef, location: string | null = null): string {
  if (apartment) {
    return `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`
  }
  return location ? `Zona comun · ${location}` : 'Zona comun'
}

export interface DeviceView {
  id: string
  name: string
  unitLabel: string
  apartmentId: string | null
  providerLabel: string
  provider: AlarmProvider
  location: string | null
  notes: string | null
  stateLabel: string
  stateColor: string
  lastEventLabel: string
  tokenHint: string
  isActive: boolean
  canManage: boolean
}

export function toDeviceView(
  device: AlarmDeviceWithUnit,
  ctx: { isAdmin: boolean; ownedApartmentIds: string[] },
): DeviceView {
  const state = !device.is_active
    ? { label: 'Desactivada', color: 'default' }
    : device.armed_state === 'ARMED'
      ? { label: 'Armada', color: 'blue' }
      : device.armed_state === 'PARTIAL'
        ? { label: 'Armado parcial', color: 'geekblue' }
        : device.armed_state === 'DISARMED'
          ? { label: 'Desarmada', color: 'default' }
          : { label: 'Sin reportes', color: 'default' }
  return {
    id: device.id,
    name: device.name,
    unitLabel: unitLabel(device.apartment, device.location),
    apartmentId: device.apartment_id,
    providerLabel: PROVIDER_LABELS[device.provider] ?? device.provider,
    provider: device.provider,
    location: device.location,
    notes: device.notes,
    stateLabel: state.label,
    stateColor: state.color,
    lastEventLabel: device.last_event_at
      ? `${EVENT_META[device.last_event_type ?? 'OTHER'].label} · ${formatRelative(device.last_event_at)}`
      : 'Aun no ha enviado eventos',
    tokenHint: `••••${device.token_hint}`,
    isActive: device.is_active,
    canManage:
      ctx.isAdmin ||
      (device.apartment_id !== null && ctx.ownedApartmentIds.includes(device.apartment_id)),
  }
}

export interface EventView {
  id: string
  type: AlarmEventType
  label: string
  color: string
  severity: AlarmSeverity
  severityLabel: string
  unitLabel: string
  deviceName: string
  detail: string | null
  whenLabel: string
  relativeLabel: string
  needsAttention: boolean
  acknowledged: boolean
  resolutionNote: string | null
  canAcknowledge: boolean
}

export function toEventView(
  event: AlarmEventWithDevice,
  ctx: { isStaff: boolean; ownedApartmentIds: string[] },
): EventView {
  const meta = EVENT_META[event.event_type] ?? EVENT_META.OTHER
  const important = event.severity !== 'INFO'
  const detail = [event.message, event.zone ? `Zona ${event.zone}` : null, event.raw_code]
    .filter(Boolean)
    .join(' · ')
  return {
    id: event.id,
    type: event.event_type,
    label: meta.label,
    color: meta.color,
    severity: event.severity,
    severityLabel: SEVERITY_LABELS[event.severity],
    unitLabel: unitLabel(event.apartment, event.device?.location ?? null),
    deviceName: event.device?.name ?? 'Alarma eliminada',
    detail: detail || null,
    whenLabel: formatDateTime(event.received_at),
    relativeLabel: formatRelative(event.received_at),
    needsAttention: important && !event.acknowledged_at,
    acknowledged: Boolean(event.acknowledged_at),
    resolutionNote: event.resolution_note,
    canAcknowledge:
      important &&
      !event.acknowledged_at &&
      (ctx.isStaff ||
        (event.apartment_id !== null && ctx.ownedApartmentIds.includes(event.apartment_id))),
  }
}

export type EventFilter = 'attention' | 'all' | 'critical' | 'technical' | 'activity'

export function filterEvents(events: EventView[], filter: EventFilter): EventView[] {
  switch (filter) {
    case 'attention':
      return events.filter((event) => event.needsAttention)
    case 'critical':
      return events.filter((event) => event.severity === 'CRITICAL' || event.severity === 'HIGH')
    case 'technical':
      return events.filter((event) => event.severity === 'TECHNICAL')
    case 'activity':
      return events.filter((event) => event.severity === 'INFO')
    default:
      return events
  }
}

/** Ejemplo para el instalador: el mismo evento por JSON y por Contact ID. */
export function setupExample(url: string): string {
  return [
    `curl -X POST "${url}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"event_type":"PANIC","zone":"Sala","message":"Boton de panico"}'`,
    '',
    '# Tambien se aceptan codigos de receptora, por ejemplo Contact ID:',
    `curl -X POST "${url}" -d "18 1 130 01 015"`,
  ].join('\n')
}

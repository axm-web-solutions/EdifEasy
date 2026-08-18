import type {
  AlertStatus,
  AlertType,
  AnnouncementStatus,
  ApartmentStatus,
  AudienceType,
  BuildingStatus,
  CondominiumStatus,
  ExpenseStatus,
  FineStatus,
  IncidentStatus,
  IncidentType,
  MemberStatus,
  NotificationType,
  PetType,
  PriorityLevel,
  PurchaseStatus,
  RequestStatus,
  RequestType,
  ResidentRelationship,
  VehicleType,
} from '@/types/database'

export interface EnumMeta {
  label: string
  /** Color de Ant Design (Tag / Badge) */
  color: string
  /** Color hexadecimal para graficas */
  hex: string
}

export type EnumMap<T extends string> = Record<T, EnumMeta>

export interface SelectOption<T extends string = string> {
  value: T
  label: string
}

export function toOptions<T extends string>(map: EnumMap<T>): SelectOption<T>[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }))
}


// ---------------------------------------------------------------------------
export const MEMBER_STATUS: EnumMap<MemberStatus> = {
  ACTIVE: { label: 'Activo', color: 'green', hex: '#10b981' },
  INACTIVE: { label: 'Inactivo', color: 'default', hex: '#94a3b8' },
  PENDING: { label: 'Pendiente', color: 'gold', hex: '#f59e0b' },
}

export const CONDOMINIUM_STATUS: EnumMap<CondominiumStatus> = {
  ACTIVE: { label: 'Activo', color: 'green', hex: '#10b981' },
  INACTIVE: { label: 'Inactivo', color: 'default', hex: '#94a3b8' },
  SUSPENDED: { label: 'Suspendido', color: 'red', hex: '#ef4444' },
}

export const BUILDING_STATUS: EnumMap<BuildingStatus> = {
  ACTIVE: { label: 'Activo', color: 'green', hex: '#10b981' },
  INACTIVE: { label: 'Inactivo', color: 'default', hex: '#94a3b8' },
}

export const APARTMENT_STATUS: EnumMap<ApartmentStatus> = {
  OCCUPIED: { label: 'Ocupado', color: 'green', hex: '#10b981' },
  VACANT: { label: 'Desocupado', color: 'blue', hex: '#3b76f6' },
  MAINTENANCE: { label: 'En mantenimiento', color: 'gold', hex: '#f59e0b' },
  INACTIVE: { label: 'Inactivo', color: 'default', hex: '#94a3b8' },
}

export const RESIDENT_RELATIONSHIP: EnumMap<ResidentRelationship> = {
  OWNER: { label: 'Propietario', color: 'blue', hex: '#3b76f6' },
  TENANT: { label: 'Arrendatario', color: 'purple', hex: '#8b5cf6' },
  FAMILY: { label: 'Familiar', color: 'cyan', hex: '#06b6d4' },
  EMPLOYEE: { label: 'Empleado', color: 'orange', hex: '#f97316' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const VEHICLE_TYPE: EnumMap<VehicleType> = {
  CAR: { label: 'Automovil', color: 'blue', hex: '#3b76f6' },
  MOTORCYCLE: { label: 'Motocicleta', color: 'purple', hex: '#8b5cf6' },
  BICYCLE: { label: 'Bicicleta', color: 'green', hex: '#10b981' },
  TRUCK: { label: 'Camioneta', color: 'orange', hex: '#f97316' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const PET_TYPE: EnumMap<PetType> = {
  DOG: { label: 'Perro', color: 'orange', hex: '#f97316' },
  CAT: { label: 'Gato', color: 'purple', hex: '#8b5cf6' },
  BIRD: { label: 'Ave', color: 'cyan', hex: '#06b6d4' },
  FISH: { label: 'Pez', color: 'blue', hex: '#3b76f6' },
  REPTILE: { label: 'Reptil', color: 'green', hex: '#10b981' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const AUDIENCE_TYPE: EnumMap<AudienceType> = {
  CONDOMINIUM: { label: 'Todo el condominio', color: 'blue', hex: '#3b76f6' },
  BUILDING: { label: 'Un bloque', color: 'cyan', hex: '#06b6d4' },
  APARTMENT: { label: 'Un apartamento', color: 'purple', hex: '#8b5cf6' },
  ROLE: { label: 'Un rol especifico', color: 'orange', hex: '#f97316' },
}

export const ALERT_TYPE: EnumMap<AlertType> = {
  EMERGENCY: { label: 'Emergencia', color: 'red', hex: '#dc2626' },
  SECURITY: { label: 'Seguridad', color: 'volcano', hex: '#ea580c' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'gold', hex: '#f59e0b' },
  WATER: { label: 'Agua', color: 'blue', hex: '#3b76f6' },
  ELECTRICITY: { label: 'Energia', color: 'orange', hex: '#f97316' },
  GAS: { label: 'Gas', color: 'magenta', hex: '#db2777' },
  ADMINISTRATION: { label: 'Administracion', color: 'geekblue', hex: '#4f46e5' },
  COMMUNITY: { label: 'Comunidad', color: 'green', hex: '#10b981' },
  PAYMENT: { label: 'Pagos', color: 'purple', hex: '#8b5cf6' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const PRIORITY_LEVEL: EnumMap<PriorityLevel> = {
  LOW: { label: 'Baja', color: 'default', hex: '#94a3b8' },
  MEDIUM: { label: 'Media', color: 'blue', hex: '#3b76f6' },
  HIGH: { label: 'Alta', color: 'orange', hex: '#f97316' },
  CRITICAL: { label: 'Critica', color: 'red', hex: '#dc2626' },
}

export const ALERT_STATUS: EnumMap<AlertStatus> = {
  DRAFT: { label: 'Borrador', color: 'default', hex: '#94a3b8' },
  ACTIVE: { label: 'Activa', color: 'green', hex: '#10b981' },
  RESOLVED: { label: 'Resuelta', color: 'blue', hex: '#3b76f6' },
  EXPIRED: { label: 'Expirada', color: 'default', hex: '#cbd5e1' },
  CANCELLED: { label: 'Cancelada', color: 'red', hex: '#ef4444' },
}

export const ANNOUNCEMENT_STATUS: EnumMap<AnnouncementStatus> = {
  DRAFT: { label: 'Borrador', color: 'default', hex: '#94a3b8' },
  PUBLISHED: { label: 'Publicado', color: 'green', hex: '#10b981' },
  ARCHIVED: { label: 'Archivado', color: 'default', hex: '#cbd5e1' },
}

export const NOTIFICATION_TYPE: EnumMap<NotificationType> = {
  ALERT: { label: 'Alerta', color: 'red', hex: '#dc2626' },
  ANNOUNCEMENT: { label: 'Comunicado', color: 'blue', hex: '#3b76f6' },
  MESSAGE: { label: 'Mensaje', color: 'cyan', hex: '#06b6d4' },
  REQUEST: { label: 'Solicitud', color: 'gold', hex: '#f59e0b' },
  INCIDENT: { label: 'Incidente', color: 'volcano', hex: '#ea580c' },
  FINE: { label: 'Multa', color: 'magenta', hex: '#db2777' },
  SYSTEM: { label: 'Sistema', color: 'default', hex: '#94a3b8' },
}

export const REQUEST_TYPE: EnumMap<RequestType> = {
  MAINTENANCE: { label: 'Mantenimiento', color: 'gold', hex: '#f59e0b' },
  SECURITY: { label: 'Seguridad', color: 'red', hex: '#dc2626' },
  ADMINISTRATION: { label: 'Administracion', color: 'geekblue', hex: '#4f46e5' },
  PARKING: { label: 'Parqueadero', color: 'blue', hex: '#3b76f6' },
  NOISE: { label: 'Ruido', color: 'orange', hex: '#f97316' },
  COMMON_AREAS: { label: 'Zonas comunes', color: 'green', hex: '#10b981' },
  SERVICES: { label: 'Servicios', color: 'cyan', hex: '#06b6d4' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const REQUEST_STATUS: EnumMap<RequestStatus> = {
  OPEN: { label: 'Abierta', color: 'blue', hex: '#3b76f6' },
  IN_PROGRESS: { label: 'En progreso', color: 'gold', hex: '#f59e0b' },
  RESOLVED: { label: 'Resuelta', color: 'green', hex: '#10b981' },
  CLOSED: { label: 'Cerrada', color: 'default', hex: '#94a3b8' },
}

export const INCIDENT_TYPE: EnumMap<IncidentType> = {
  THEFT: { label: 'Hurto', color: 'red', hex: '#dc2626' },
  VANDALISM: { label: 'Vandalismo', color: 'volcano', hex: '#ea580c' },
  TRESPASSING: { label: 'Ingreso no autorizado', color: 'magenta', hex: '#db2777' },
  NOISE: { label: 'Ruido', color: 'orange', hex: '#f97316' },
  FIRE: { label: 'Incendio', color: 'red', hex: '#b91c1c' },
  FLOOD: { label: 'Inundacion', color: 'blue', hex: '#3b76f6' },
  ACCIDENT: { label: 'Accidente', color: 'gold', hex: '#f59e0b' },
  MEDICAL: { label: 'Emergencia medica', color: 'purple', hex: '#8b5cf6' },
  PARKING: { label: 'Parqueadero', color: 'cyan', hex: '#06b6d4' },
  PET: { label: 'Mascotas', color: 'green', hex: '#10b981' },
  OTHER: { label: 'Otro', color: 'default', hex: '#94a3b8' },
}

export const INCIDENT_STATUS: EnumMap<IncidentStatus> = {
  OPEN: { label: 'Abierto', color: 'blue', hex: '#3b76f6' },
  INVESTIGATING: { label: 'En investigacion', color: 'gold', hex: '#f59e0b' },
  RESOLVED: { label: 'Resuelto', color: 'green', hex: '#10b981' },
  CLOSED: { label: 'Cerrado', color: 'default', hex: '#94a3b8' },
}

export const EXPENSE_STATUS: EnumMap<ExpenseStatus> = {
  PENDING: { label: 'Pendiente', color: 'gold', hex: '#f59e0b' },
  APPROVED: { label: 'Aprobado', color: 'blue', hex: '#3b76f6' },
  PAID: { label: 'Pagado', color: 'green', hex: '#10b981' },
  REJECTED: { label: 'Rechazado', color: 'red', hex: '#ef4444' },
}

export const PURCHASE_STATUS: EnumMap<PurchaseStatus> = {
  DRAFT: { label: 'Borrador', color: 'default', hex: '#94a3b8' },
  ORDERED: { label: 'Ordenada', color: 'blue', hex: '#3b76f6' },
  RECEIVED: { label: 'Recibida', color: 'green', hex: '#10b981' },
  CANCELLED: { label: 'Cancelada', color: 'red', hex: '#ef4444' },
}

export const FINE_STATUS: EnumMap<FineStatus> = {
  PENDING: { label: 'Pendiente', color: 'gold', hex: '#f59e0b' },
  PAID: { label: 'Pagada', color: 'green', hex: '#10b981' },
  CANCELLED: { label: 'Cancelada', color: 'default', hex: '#94a3b8' },
  APPEALED: { label: 'Apelada', color: 'purple', hex: '#8b5cf6' },
}

export const DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'CC', label: 'Cedula de ciudadania' },
  { value: 'CE', label: 'Cedula de extranjeria' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'NIT', label: 'NIT' },
]

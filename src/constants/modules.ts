import type { RoleCode } from '@/types/database'

/**
 * Modulos que el SUPER_ADMIN puede activar u ocultar por rol en cada conjunto.
 * Las claves deben coincidir con las de la base (`tribuia.role_modules`).
 *
 * Desactivar un modulo solo RESTRINGE: un rol nunca obtiene un modulo que sus
 * permisos no le dan. El dashboard, la estructura, la configuracion y los
 * pagos del plan no son configurables.
 */
export type ModuleKey =
  | 'residents'
  | 'visitors'
  | 'alerts'
  | 'announcements'
  | 'messages'
  | 'requests'
  | 'incidents'
  | 'fines'
  | 'admin_fees'
  | 'expenses'
  | 'purchases'
  | 'documents'
  | 'reports'
  | 'marketplace'
  | 'reservations'

export interface ModuleMeta {
  key: ModuleKey
  label: string
  description: string
}

export const MODULES: ModuleMeta[] = [
  { key: 'residents', label: 'Residentes', description: 'Residentes, vehiculos y mascotas' },
  {
    key: 'visitors',
    label: 'Visitantes',
    description: 'Registro de visitas, domicilios y proveedores',
  },
  { key: 'alerts', label: 'Alertas', description: 'Avisos urgentes del conjunto' },
  { key: 'announcements', label: 'Comunicados', description: 'Publicaciones de la administracion' },
  { key: 'messages', label: 'Mensajes', description: 'Conversaciones con la administracion' },
  { key: 'requests', label: 'Solicitudes', description: 'PQRS y solicitudes de mantenimiento' },
  { key: 'incidents', label: 'Incidentes', description: 'Novedades de seguridad y convivencia' },
  { key: 'fines', label: 'Multas', description: 'Sanciones y su pago en linea' },
  {
    key: 'admin_fees',
    label: 'Cuotas de administracion',
    description: 'Cobro y pago de la cuota mensual',
  },
  { key: 'expenses', label: 'Gastos', description: 'Gastos del conjunto' },
  { key: 'purchases', label: 'Compras', description: 'Ordenes de compra e insumos' },
  { key: 'documents', label: 'Documentos', description: 'Reglamentos, actas y archivos' },
  { key: 'reports', label: 'Reportes', description: 'Indicadores y graficas' },
  {
    key: 'reservations',
    label: 'Reservas',
    description: 'Reserva de zonas comunes con fecha y pago',
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    description: 'Servicios y comercios cercanos (aseo, plomeros, taxis...)',
  },
]

/** Roles cuya visibilidad de modulos se configura (SUPER_ADMIN siempre ve todo). */
export const CONFIGURABLE_ROLES: RoleCode[] = [
  'ADMINISTRATOR',
  'SPOKESPERSON',
  'OWNER',
  'TENANT',
  'SECURITY',
  'SERVICE_STAFF',
]

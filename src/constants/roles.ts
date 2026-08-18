import type { RoleCode } from '@/types/database'

export interface RoleMeta {
  code: RoleCode
  label: string
  description: string
  color: string
  level: number
}

export const ROLES: Record<RoleCode, RoleMeta> = {
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    label: 'Super Administrador',
    description: 'Acceso total a la plataforma y a todos los condominios',
    color: 'magenta',
    level: 100,
  },
  ADMINISTRATOR: {
    code: 'ADMINISTRATOR',
    label: 'Administrador',
    description: 'Administra un condominio especifico',
    color: 'geekblue',
    level: 80,
  },
  SPOKESPERSON: {
    code: 'SPOKESPERSON',
    label: 'Vocero',
    description: 'Consulta informacion y publica alertas y comunicados',
    color: 'purple',
    level: 60,
  },
  OWNER: {
    code: 'OWNER',
    label: 'Propietario',
    description: 'Propietario de uno o mas apartamentos',
    color: 'blue',
    level: 40,
  },
  TENANT: {
    code: 'TENANT',
    label: 'Arrendatario',
    description: 'Arrendatario de un apartamento',
    color: 'cyan',
    level: 30,
  },
  SECURITY: {
    code: 'SECURITY',
    label: 'Celaduria',
    description: 'Personal de seguridad: residentes, visitantes e incidentes',
    color: 'volcano',
    level: 20,
  },
  SERVICE_STAFF: {
    code: 'SERVICE_STAFF',
    label: 'Personal de Servicios',
    description: 'Personal operativo: tareas, mantenimientos y solicitudes',
    color: 'orange',
    level: 10,
  },
}

export const ROLE_OPTIONS = (Object.values(ROLES) as RoleMeta[])
  .filter((role) => role.code !== 'SUPER_ADMIN')
  .sort((a, b) => b.level - a.level)
  .map((role) => ({ value: role.code, label: role.label }))

export function roleLabel(code: RoleCode | null | undefined): string {
  if (!code) return 'Sin rol'
  return ROLES[code]?.label ?? code
}

export function roleColor(code: RoleCode | null | undefined): string {
  if (!code) return 'default'
  return ROLES[code]?.color ?? 'default'
}

/**
 * Permisos de UI. La seguridad real vive en las politicas RLS de PostgreSQL;
 * esto solo evita mostrar acciones que el backend rechazaria.
 */
export const PERMISSIONS = {
  manageCondominium: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
  manageStructure: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
  manageMembers: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
  manageAlerts: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'] as RoleCode[],
  manageAnnouncements: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON'] as RoleCode[],
  manageRequests: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SERVICE_STAFF'] as RoleCode[],
  manageIncidents: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SECURITY'] as RoleCode[],
  viewFinance: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER'] as RoleCode[],
  manageFinance: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
  manageFines: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
  manageDocuments: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON'] as RoleCode[],
  viewResidents: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'] as RoleCode[],
  viewReports: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON'] as RoleCode[],
  viewAudit: ['SUPER_ADMIN', 'ADMINISTRATOR'] as RoleCode[],
} as const

export type PermissionKey = keyof typeof PERMISSIONS

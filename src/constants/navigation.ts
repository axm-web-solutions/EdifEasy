import type { RoleCode } from '@/types/database'
import type { PermissionKey } from './roles'

export interface NavItem {
  key: string
  label: string
  path?: string
  icon?: string
  /** Roles que ven el item. Vacio = todos. */
  roles?: RoleCode[]
  /** Permiso necesario (ademas del rol). */
  permission?: PermissionKey
  children?: NavItem[]
}

/**
 * Menu lateral. Se filtra dinamicamente segun el rol activo del usuario
 * en el condominio seleccionado.
 */
export const NAVIGATION: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },

  {
    key: 'my-apartment',
    label: 'Mi apartamento',
    path: '/my-apartment',
    icon: 'Home',
    roles: ['OWNER', 'TENANT'],
  },

  {
    key: 'structure',
    label: 'Estructura',
    icon: 'Building2',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON'],
    children: [
      { key: 'condominiums', label: 'Condominios', path: '/condominiums', icon: 'Building' },
      { key: 'buildings', label: 'Bloques', path: '/buildings', icon: 'Blocks' },
      { key: 'apartments', label: 'Apartamentos', path: '/apartments', icon: 'DoorOpen' },
      { key: 'users', label: 'Usuarios', path: '/users', icon: 'Users', permission: 'manageMembers' },
      {
        key: 'approvals',
        label: 'Aprobaciones',
        path: '/approvals',
        icon: 'UserCheck',
        permission: 'manageMembers',
      },
    ],
  },

  {
    key: 'residents',
    label: 'Residentes',
    path: '/residents',
    icon: 'UsersRound',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'],
  },

  {
    key: 'communication',
    label: 'Comunicacion',
    icon: 'MessagesSquare',
    children: [
      { key: 'alerts', label: 'Alertas', path: '/alerts', icon: 'Siren' },
      { key: 'announcements', label: 'Comunicados', path: '/announcements', icon: 'Megaphone' },
      { key: 'messages', label: 'Mensajes', path: '/messages', icon: 'MessageCircle' },
    ],
  },

  {
    key: 'management',
    label: 'Gestion',
    icon: 'ClipboardList',
    children: [
      { key: 'requests', label: 'Solicitudes', path: '/requests', icon: 'FileQuestion' },
      { key: 'incidents', label: 'Incidentes', path: '/incidents', icon: 'ShieldAlert' },
      {
        key: 'fines',
        label: 'Multas',
        path: '/fines',
        icon: 'Gavel',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT'],
      },
    ],
  },

  {
    key: 'finance',
    label: 'Finanzas',
    icon: 'Wallet',
    permission: 'viewFinance',
    children: [
      { key: 'expenses', label: 'Gastos', path: '/expenses', icon: 'Receipt', permission: 'viewFinance' },
      { key: 'purchases', label: 'Compras', path: '/purchases', icon: 'ShoppingCart', permission: 'viewFinance' },
    ],
  },

  { key: 'documents', label: 'Documentos', path: '/documents', icon: 'FolderOpen' },

  {
    key: 'reports',
    label: 'Reportes',
    path: '/reports',
    icon: 'BarChart3',
    permission: 'viewReports',
  },

  {
    key: 'activity',
    label: 'Auditoria',
    path: '/activity',
    icon: 'History',
    permission: 'viewAudit',
  },

  { key: 'settings', label: 'Configuracion', path: '/settings', icon: 'Settings' },
]

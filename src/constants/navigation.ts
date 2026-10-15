import type { RoleCode } from '@/types/database'
import type { PermissionKey } from './roles'

type HasRole = (roles: RoleCode[]) => boolean
type HasPermission = (permission: PermissionKey) => boolean

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
  {
    key: 'platform',
    label: 'Plataforma',
    path: '/platform',
    icon: 'Globe',
    roles: ['SUPER_ADMIN'],
  },

  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },

  {
    key: 'my-apartment',
    label: 'Mi apartamento',
    path: '/my-apartment',
    icon: 'Home',
    roles: ['OWNER', 'TENANT'],
  },

  {
    key: 'admin-fees',
    label: 'Cuotas de administracion',
    path: '/admin-fees',
    icon: 'CreditCard',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'OWNER'],
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
    key: 'visitors',
    label: 'Visitantes',
    path: '/visitors',
    icon: 'IdCard',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'OWNER', 'TENANT'],
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

  {
    key: 'plans',
    label: 'Planes',
    path: '/plans',
    icon: 'BadgeCheck',
    roles: ['ADMINISTRATOR'],
  },

  { key: 'settings', label: 'Configuracion', path: '/settings', icon: 'Settings' },
]

/** Regla unica de visibilidad: rol y permiso del usuario en el condominio activo. */
export function isNavItemVisible(item: NavItem, hasRole: HasRole, hasPermission: HasPermission): boolean {
  if (item.roles && item.roles.length > 0 && !hasRole(item.roles)) return false
  if (item.permission && !hasPermission(item.permission)) return false
  return true
}

/** Rutas del menu a las que el usuario tiene acceso (un hijo exige ver tambien a su padre). */
export function visibleNavPaths(
  hasRole: HasRole,
  hasPermission: HasPermission,
  items: NavItem[] = NAVIGATION,
): Set<string> {
  const paths = new Set<string>()
  for (const item of items) {
    if (!isNavItemVisible(item, hasRole, hasPermission)) continue
    if (item.path) paths.add(item.path)
    if (item.children) visibleNavPaths(hasRole, hasPermission, item.children).forEach((path) => paths.add(path))
  }
  return paths
}

import type { RoleCode } from '@/types/database'
import type { PermissionKey } from './roles'
import type { ModuleKey } from './modules'

type HasRole = (roles: RoleCode[]) => boolean
type HasPermission = (permission: PermissionKey) => boolean
type IsModuleEnabled = (module: ModuleKey) => boolean

export interface NavItem {
  key: string
  label: string
  path?: string
  icon?: string
  /** Roles que ven el item. Vacio = todos. */
  roles?: RoleCode[]
  /** Permiso necesario (ademas del rol). */
  permission?: PermissionKey
  /** Modulo configurable: se oculta si el SUPER_ADMIN lo desactivo para el rol. */
  module?: ModuleKey
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
    icon: 'Globe',
    roles: ['SUPER_ADMIN'],
    children: [
      { key: 'platform-condominiums', label: 'Conjuntos', path: '/platform', icon: 'Building' },
      {
        key: 'platform-modules',
        label: 'Modulos por rol',
        path: '/platform/modules',
        icon: 'SlidersHorizontal',
      },
    ],
  },

  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },

  // Propietarios y arrendatarios ya tienen el feed como dashboard.
  {
    key: 'feed',
    label: 'Feed',
    path: '/feed',
    icon: 'Newspaper',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'],
  },

  {
    key: 'marketplace',
    module: 'marketplace',
    label: 'Marketplace',
    path: '/marketplace',
    icon: 'Store',
  },

  {
    key: 'my-apartment',
    label: 'Mi apartamento',
    path: '/my-apartment',
    icon: 'Home',
    roles: ['OWNER', 'TENANT'],
  },

  {
    key: 'admin-fees',
    module: 'admin_fees',
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
      {
        key: 'users',
        label: 'Usuarios',
        path: '/users',
        icon: 'Users',
        permission: 'manageMembers',
      },
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
    module: 'residents',
    label: 'Residentes',
    path: '/residents',
    icon: 'UsersRound',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'],
  },

  {
    key: 'visitors',
    module: 'visitors',
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
      { key: 'alerts', module: 'alerts', label: 'Alertas', path: '/alerts', icon: 'Siren' },
      {
        key: 'announcements',
        module: 'announcements',
        label: 'Comunicados',
        path: '/announcements',
        icon: 'Megaphone',
      },
      {
        key: 'messages',
        module: 'messages',
        label: 'Mensajes',
        path: '/messages',
        icon: 'MessageCircle',
      },
    ],
  },

  {
    key: 'management',
    label: 'Gestion',
    icon: 'ClipboardList',
    children: [
      {
        key: 'requests',
        module: 'requests',
        label: 'Solicitudes',
        path: '/requests',
        icon: 'FileQuestion',
      },
      {
        key: 'incidents',
        module: 'incidents',
        label: 'Incidentes',
        path: '/incidents',
        icon: 'ShieldAlert',
      },
      {
        key: 'fines',
        module: 'fines',
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
      {
        key: 'expenses',
        module: 'expenses',
        label: 'Gastos',
        path: '/expenses',
        icon: 'Receipt',
        permission: 'viewFinance',
      },
      {
        key: 'purchases',
        module: 'purchases',
        label: 'Compras',
        path: '/purchases',
        icon: 'ShoppingCart',
        permission: 'viewFinance',
      },
    ],
  },

  {
    key: 'documents',
    module: 'documents',
    label: 'Documentos',
    path: '/documents',
    icon: 'FolderOpen',
  },

  {
    key: 'reports',
    module: 'reports',
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
export function isNavItemVisible(
  item: NavItem,
  hasRole: HasRole,
  hasPermission: HasPermission,
  isModuleEnabled: IsModuleEnabled = () => true,
): boolean {
  if (item.roles && item.roles.length > 0 && !hasRole(item.roles)) return false
  if (item.permission && !hasPermission(item.permission)) return false
  if (item.module && !isModuleEnabled(item.module)) return false
  return true
}

/** Rutas del menu a las que el usuario tiene acceso (un hijo exige ver tambien a su padre). */
export function visibleNavPaths(
  hasRole: HasRole,
  hasPermission: HasPermission,
  isModuleEnabled: IsModuleEnabled = () => true,
  items: NavItem[] = NAVIGATION,
): Set<string> {
  const paths = new Set<string>()
  for (const item of items) {
    if (!isNavItemVisible(item, hasRole, hasPermission, isModuleEnabled)) continue
    if (item.path) paths.add(item.path)
    if (item.children) {
      visibleNavPaths(hasRole, hasPermission, isModuleEnabled, item.children).forEach((path) =>
        paths.add(path),
      )
    }
  }
  return paths
}

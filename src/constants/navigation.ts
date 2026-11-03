import type { RoleCode, WorkspaceKind } from '@/types/database'
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
  /** Tipos de espacio donde aparece. Sin valor: solo en conjuntos. */
  kinds?: WorkspaceKind[]
  children?: NavItem[]
}

const BOTH: WorkspaceKind[] = ['CONDOMINIUM', 'AGENCY']
const AGENCY: WorkspaceKind[] = ['AGENCY']

/** Todos menos el contador: su trabajo es solo contable. */
const COMMUNITY_ROLES: RoleCode[] = [
  'SUPER_ADMIN',
  'ADMINISTRATOR',
  'SPOKESPERSON',
  'OWNER',
  'TENANT',
  'SECURITY',
  'SERVICE_STAFF',
]

/**
 * Menu lateral por segmentos. Se filtra segun el rol activo del usuario en el
 * condominio seleccionado. Cada ruta aparece una sola vez (el SUPER_ADMIN ve
 * todo y no debe ver entradas repetidas).
 *
 * Comunicados y alertas ya se ven en el feed: en el menu solo los tiene quien
 * los gestiona.
 */
export const NAVIGATION: NavItem[] = [
  {
    key: 'platform',
    label: 'Plataforma',
    icon: 'Globe',
    roles: ['SUPER_ADMIN'],
    kinds: BOTH,
    children: [
      { key: 'platform-condominiums', label: 'Conjuntos', path: '/platform', icon: 'Building' },
      {
        key: 'platform-legal',
        label: 'Cumplimiento legal',
        path: '/platform/legal',
        icon: 'Scale',
      },
      {
        key: 'platform-modules',
        label: 'Modulos por rol',
        path: '/platform/modules',
        icon: 'SlidersHorizontal',
      },
    ],
  },

  // ---------------------------------------------------------------- Inicio
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'],
  },
  // Para propietarios y arrendatarios el feed es su inicio.
  { key: 'feed', label: 'Feed', path: '/feed', icon: 'Newspaper', roles: COMMUNITY_ROLES },
  {
    key: 'my-apartment',
    label: 'Mi apartamento',
    path: '/my-apartment',
    icon: 'Home',
    roles: ['OWNER', 'TENANT'],
  },

  // ------------------------------------------------------------- Comunidad
  {
    key: 'community',
    label: 'Comunidad',
    icon: 'MessagesSquare',
    children: [
      {
        key: 'marketplace',
        module: 'marketplace',
        label: 'Marketplace',
        path: '/marketplace',
        icon: 'Store',
        roles: COMMUNITY_ROLES,
      },
      { key: 'nearby', label: 'Mapa', path: '/nearby', icon: 'MapPinned', roles: COMMUNITY_ROLES },
      {
        key: 'surveys',
        module: 'surveys',
        label: 'Encuestas',
        path: '/surveys',
        icon: 'Vote',
        roles: COMMUNITY_ROLES,
      },
      {
        key: 'requests',
        module: 'requests',
        label: 'Solicitudes y reservas',
        path: '/requests',
        icon: 'FileQuestion',
        roles: COMMUNITY_ROLES,
      },
      {
        key: 'messages',
        module: 'messages',
        label: 'Mensajes',
        path: '/messages',
        icon: 'MessageCircle',
      },
      {
        key: 'documents',
        module: 'documents',
        label: 'Documentos',
        path: '/documents',
        icon: 'FolderOpen',
      },
      {
        key: 'announcements',
        module: 'announcements',
        label: 'Comunicados',
        path: '/announcements',
        icon: 'Megaphone',
        permission: 'manageAnnouncements',
      },
      {
        key: 'alerts',
        module: 'alerts',
        label: 'Alertas',
        path: '/alerts',
        icon: 'Siren',
        permission: 'manageAlerts',
      },
    ],
  },

  // -------------------------------------------------------------- Finanzas
  {
    key: 'finance',
    label: 'Finanzas',
    icon: 'Wallet',
    children: [
      {
        key: 'finances',
        module: 'accounting',
        label: 'Finanzas del conjunto',
        path: '/finances',
        icon: 'Landmark',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'],
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
        key: 'fines',
        module: 'fines',
        label: 'Multas',
        path: '/fines',
        icon: 'Gavel',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT'],
      },
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

  // ------------------------------------------------------------- Seguridad
  {
    key: 'security',
    label: 'Seguridad',
    icon: 'ShieldCheck',
    children: [
      {
        key: 'visitors',
        module: 'visitors',
        label: 'Visitantes',
        path: '/visitors',
        icon: 'IdCard',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'OWNER', 'TENANT'],
      },
      {
        key: 'alarms',
        module: 'alarms',
        label: 'Alarmas',
        path: '/alarms',
        icon: 'BellRing',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'OWNER', 'TENANT'],
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
        key: 'logbook',
        module: 'logbook',
        label: 'Minuta',
        path: '/logbook',
        icon: 'NotebookPen',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'],
      },
      {
        key: 'staff',
        module: 'staff',
        label: 'Personal',
        path: '/staff',
        icon: 'UserRoundCheck',
        roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'],
      },
      {
        key: 'incidents',
        module: 'incidents',
        label: 'Incidentes',
        path: '/incidents',
        icon: 'ShieldAlert',
        roles: COMMUNITY_ROLES,
      },
    ],
  },

  // -------------------------------------------------------- Administracion
  {
    key: 'administration',
    label: 'Administracion',
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
    ],
  },

  // ----------------------------------------------------------- Inmobiliaria
  {
    key: 'agency-dashboard',
    label: 'Panel',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR'],
    kinds: AGENCY,
  },
  {
    key: 'agency-my-lease',
    label: 'Mi arriendo',
    path: '/agency/my-lease',
    icon: 'Home',
    roles: ['TENANT'],
    kinds: AGENCY,
  },
  {
    key: 'agency-my-properties',
    label: 'Mis propiedades',
    path: '/agency/my-properties',
    icon: 'Building2',
    roles: ['OWNER'],
    kinds: AGENCY,
  },
  {
    key: 'agency-portfolio',
    label: 'Inmobiliaria',
    icon: 'Building',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR'],
    kinds: AGENCY,
    children: [
      {
        key: 'agency-properties',
        label: 'Propiedades',
        path: '/agency/properties',
        icon: 'Building',
        kinds: AGENCY,
      },
      {
        key: 'agency-leases',
        label: 'Contratos',
        path: '/agency/leases',
        icon: 'FileSignature',
        kinds: AGENCY,
      },
      {
        key: 'agency-charges',
        label: 'Cobros y pagos',
        path: '/agency/charges',
        icon: 'Receipt',
        kinds: AGENCY,
      },
      {
        key: 'agency-leads',
        label: 'Interesados',
        path: '/agency/leads',
        icon: 'UserPlus',
        kinds: AGENCY,
      },
      {
        key: 'agency-store',
        label: 'Tienda y pagos en linea',
        path: '/agency/store',
        icon: 'Store',
        kinds: AGENCY,
      },
    ],
  },
  {
    key: 'agency-admin',
    label: 'Administracion',
    icon: 'Building2',
    roles: ['SUPER_ADMIN', 'ADMINISTRATOR'],
    kinds: AGENCY,
    children: [
      {
        key: 'agency-users',
        label: 'Usuarios',
        path: '/users',
        icon: 'Users',
        permission: 'manageMembers',
        kinds: AGENCY,
      },
      {
        key: 'agency-plans',
        label: 'Planes',
        path: '/plans',
        icon: 'BadgeCheck',
        roles: ['ADMINISTRATOR'],
        kinds: AGENCY,
      },
    ],
  },

  { key: 'settings', label: 'Configuracion', path: '/settings', icon: 'Settings', kinds: BOTH },
]

/** Regla unica de visibilidad: rol y permiso del usuario en el condominio activo. */
export function isNavItemVisible(
  item: NavItem,
  hasRole: HasRole,
  hasPermission: HasPermission,
  isModuleEnabled: IsModuleEnabled = () => true,
  kind: WorkspaceKind = 'CONDOMINIUM',
): boolean {
  if (!(item.kinds ?? ['CONDOMINIUM']).includes(kind)) return false
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
  kind: WorkspaceKind = 'CONDOMINIUM',
): Set<string> {
  const paths = new Set<string>()
  for (const item of items) {
    if (!isNavItemVisible(item, hasRole, hasPermission, isModuleEnabled, kind)) continue
    if (item.path) paths.add(item.path)
    if (item.children) {
      visibleNavPaths(hasRole, hasPermission, isModuleEnabled, item.children, kind).forEach(
        (path) => paths.add(path),
      )
    }
  }
  return paths
}

import { useMemo } from 'react'
import { Badge, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { NAVIGATION, isNavItemVisible, type NavItem } from '@/constants/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useModuleAccess } from '@/hooks/useModules'
import type { ModuleKey } from '@/constants/modules'
import { usePendingRegistrationCount } from '@/hooks/useRegistrationRequests'
import { Icon } from '@/components/ui/Icon'

type MenuItem = Required<MenuProps>['items'][number]

function buildMenu(
  items: NavItem[],
  hasRole: ReturnType<typeof useAuth>['hasRole'],
  hasPermission: ReturnType<typeof useAuth>['hasPermission'],
  pendingApprovals: number,
  isModuleEnabled: (module: ModuleKey) => boolean,
): MenuItem[] {
  return items
    .filter((item) => isNavItemVisible(item, hasRole, hasPermission, isModuleEnabled))
    .map<MenuItem | null>((item) => {
      if (item.children) {
        const children = buildMenu(
          item.children,
          hasRole,
          hasPermission,
          pendingApprovals,
          isModuleEnabled,
        )
        if (children.length === 0) return null
        return {
          key: item.key,
          label: item.label,
          icon: <Icon name={item.icon} />,
          children,
        }
      }
      // El contador hace visible que hay inscripciones esperando revision.
      const showBadge = item.key === 'approvals' && pendingApprovals > 0

      return {
        key: item.path ?? item.key,
        label: showBadge ? (
          <span className="flex items-center justify-between gap-2">
            {item.label}
            <Badge count={pendingApprovals} size="small" />
          </span>
        ) : (
          item.label
        ),
        icon: <Icon name={item.icon} />,
      }
    })
    .filter((item): item is MenuItem => item !== null)
}

function findOpenKeys(items: NavItem[], pathname: string): string[] {
  const keys: string[] = []
  for (const item of items) {
    if (item.children?.some((child) => child.path && pathname.startsWith(child.path))) {
      keys.push(item.key)
    }
  }
  return keys
}

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasRole, hasPermission, currentCondominiumId } = useAuth()
  const pendingApprovals = usePendingRegistrationCount(
    hasPermission('manageMembers') ? currentCondominiumId : null,
  )

  const { isModuleEnabled } = useModuleAccess()

  const items = useMemo(
    () => buildMenu(NAVIGATION, hasRole, hasPermission, pendingApprovals, isModuleEnabled),
    [hasRole, hasPermission, pendingApprovals, isModuleEnabled],
  )

  const selectedKey = useMemo(() => {
    const paths = NAVIGATION.flatMap((item) => (item.children ? item.children : [item]))
      .map((item) => item.path)
      .filter((path): path is string => Boolean(path))
      .sort((a, b) => b.length - a.length)

    return paths.find((path) => location.pathname.startsWith(path)) ?? '/dashboard'
  }, [location.pathname])

  const defaultOpenKeys = useMemo(
    () => findOpenKeys(NAVIGATION, location.pathname),
    [location.pathname],
  )

  return (
    <Menu
      theme="dark"
      mode="inline"
      inlineCollapsed={collapsed}
      items={items}
      selectedKeys={[selectedKey]}
      defaultOpenKeys={defaultOpenKeys}
      onClick={({ key }) => {
        if (key.startsWith('/')) {
          navigate(key)
          onNavigate?.()
        }
      }}
      style={{ borderInlineEnd: 'none' }}
    />
  )
}

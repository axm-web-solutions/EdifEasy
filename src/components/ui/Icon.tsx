import {
  BadgeCheck,
  BarChart3,
  Blocks,
  Building,
  Building2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileQuestion,
  FolderOpen,
  Gavel,
  Globe,
  History,
  Home,
  IdCard,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  Receipt,
  Scale,
  Store,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Siren,
  UserCheck,
  UserRoundCheck,
  Users,
  UsersRound,
  Vote,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Newspaper,
  Store,
  Scale,
  Globe,
  CreditCard,
  BadgeCheck,
  Home,
  Building,
  Building2,
  Blocks,
  DoorOpen,
  UserCheck,
  Users,
  UsersRound,
  MessagesSquare,
  Siren,
  Megaphone,
  MessageCircle,
  ClipboardList,
  FileQuestion,
  ShieldAlert,
  Gavel,
  Wallet,
  Receipt,
  IdCard,
  ShoppingCart,
  SlidersHorizontal,
  FolderOpen,
  BarChart3,
  History,
  Settings,
  MapPinned,
  NotebookPen,
  ShieldCheck,
  UserRoundCheck,
  Vote,
}

/**
 * Icono del menu. Reenvia `className`: antd le pasa `ant-menu-item-icon`, que es
 * lo que oculta el texto cuando el menu esta colapsado.
 */
export function Icon({
  name,
  size = 18,
  className,
}: {
  name?: string
  size?: number
  className?: string
}) {
  const Component = name ? ICONS[name] : undefined
  if (!Component) return null
  return <Component size={size} className={className} aria-hidden />
}

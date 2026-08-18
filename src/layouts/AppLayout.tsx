import { useState } from 'react'
import { Drawer, Grid, Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/hooks/useAuth'
import { useAlertsRealtime } from '@/hooks/useAlerts'
import { useNotificationsRealtime } from '@/hooks/useNotifications'
import { GlobalSearch } from '@/components/layout/GlobalSearch'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-16 items-center gap-2 px-4">
      <img src="/favicon.svg" alt="EdiFeasy" className="h-8 w-8 shrink-0" />
      {!collapsed ? (
        <div className="min-w-0">
          <p className="m-0 truncate text-base font-semibold text-white">EdiFeasy</p>
          <p className="m-0 truncate text-[11px] text-slate-400">Administracion de condominios</p>
        </div>
      ) : null}
    </div>
  )
}

export function AppLayout() {
  const screens = useBreakpoint()
  const isDesktop = Boolean(screens.lg)
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { currentCondominiumId } = useAuth()

  // Suscripciones Realtime activas mientras el usuario navega la aplicacion.
  useAlertsRealtime(currentCondominiumId)
  useNotificationsRealtime()

  return (
    <Layout className="min-h-screen">
      {isDesktop ? (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={252}
          collapsedWidth={72}
          theme="dark"
          className="!fixed left-0 top-0 bottom-0 z-20 overflow-auto"
        >
          <Brand collapsed={collapsed} />
          <Sidebar />
        </Sider>
      ) : (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={264}
          closable={false}
          styles={{ body: { padding: 0, background: '#0f172a' } }}
        >
          <Brand collapsed={false} />
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <Layout
        style={{ marginInlineStart: isDesktop ? (collapsed ? 72 : 252) : 0 }}
        className="transition-all"
      >
        <Header className="sticky top-0 z-10 !h-16 !px-0 border-b border-slate-100 bg-white">
          <Topbar onOpenDrawer={() => setDrawerOpen(true)} />
        </Header>

        <div className="border-b border-slate-100 bg-white px-3 py-2 md:hidden">
          <GlobalSearch />
        </div>

        <Content className="app-shell-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

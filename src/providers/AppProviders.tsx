import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider, theme } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { queryClient } from '@/lib/queryClient'
import { NotifyBridge } from '@/lib/notify'
import { AuthProvider } from './AuthProvider'

dayjs.locale('es')

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2559eb',
          colorInfo: '#2559eb',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          borderRadius: 8,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          colorBgLayout: '#f5f7fb',
        },
        components: {
          Layout: { headerBg: '#ffffff', siderBg: '#0f172a', bodyBg: '#f5f7fb' },
          Menu: {
            darkItemBg: '#0f172a',
            darkSubMenuItemBg: '#0b1220',
            darkItemSelectedBg: '#2559eb',
            darkItemHoverBg: '#1e293b',
          },
          Card: { borderRadiusLG: 12 },
          Table: { headerBg: '#f8fafc', headerColor: '#475569', rowHoverBg: '#f8fafc' },
          Statistic: { titleFontSize: 13 },
        },
      }}
    >
      <AntApp>
        <NotifyBridge />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  )
}

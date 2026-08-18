import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/providers/AppProviders'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { EnvGuard } from '@/components/EnvGuard'
import { AppRoutes } from '@/routes'

export function App() {
  return (
    <ErrorBoundary>
      <EnvGuard>
        <BrowserRouter>
          <AppProviders>
            <AppRoutes />
          </AppProviders>
        </BrowserRouter>
      </EnvGuard>
    </ErrorBoundary>
  )
}


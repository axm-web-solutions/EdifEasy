import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/providers/AppProviders'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { EnvGuard } from '@/components/EnvGuard'
import { AppRoutes } from '@/routes'
import { TourProvider } from '@/providers/TourProvider'

export function App() {
  return (
    <ErrorBoundary>
      <EnvGuard>
        <BrowserRouter>
          <AppProviders>
            <TourProvider>
              <AppRoutes />
            </TourProvider>
          </AppProviders>
        </BrowserRouter>
      </EnvGuard>
    </ErrorBoundary>
  )
}


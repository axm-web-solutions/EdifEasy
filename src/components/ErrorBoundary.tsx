import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

/**
 * Frontera de errores global. Evita la pantalla en blanco ante cualquier
 * excepcion de render y registra el detalle tecnico en el logger.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Error no controlado en la interfaz', error, {
      componentStack: info.componentStack,
    })
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' })
    window.location.assign('/dashboard')
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-4">
          <Result
            status="500"
            title="Algo salio mal"
            subTitle="Ocurrio un error inesperado. Puedes volver al inicio e intentarlo nuevamente."
            extra={
              <Button type="primary" onClick={this.handleReset}>
                Volver al inicio
              </Button>
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}

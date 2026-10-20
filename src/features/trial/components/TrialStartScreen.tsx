import { Button, Card, Result, Spin } from 'antd'
import { useTrialStartViewModel } from '../viewmodels/useTrialStartViewModel'

type TrialStartViewModel = ReturnType<typeof useTrialStartViewModel>

/** Arranque de la prueba gratis: crea el conjunto y entra a la app. */
export function TrialStartScreen({ vm }: { vm: TrialStartViewModel }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="surface-card w-full max-w-lg">
        {vm.error ? (
          <Result
            status="warning"
            title="No pudimos crear tu conjunto de prueba"
            subTitle={vm.error}
            extra={[
              <Button key="retry" type="primary" onClick={vm.retry}>
                Intentar de nuevo
              </Button>,
              <Button key="out" onClick={vm.signOut}>
                Cerrar sesion
              </Button>,
            ]}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Spin size="large" />
            <div>
              <p className="m-0 text-base font-semibold text-slate-800">
                Preparando {vm.condoName ?? 'tu conjunto'}
              </p>
              <p className="m-0 text-sm text-slate-500">
                Empiezas con 7 dias gratis. Esto toma unos segundos.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

import { Button, Card, Result } from 'antd'
import { Link } from 'react-router-dom'
import { Hourglass, Lock } from 'lucide-react'
import type { TrialViewModel } from '../viewmodels/useTrialViewModel'

/** Aviso de dias restantes de la prueba (solo administracion). */
export function TrialBanner({ vm }: { vm: TrialViewModel }) {
  if (!vm.banner) return null
  return (
    <div
      className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${
        vm.banner.urgent ? 'border-amber-200 bg-amber-50' : 'border-brand-100 bg-brand-50'
      }`}
    >
      <Hourglass
        size={18}
        className={vm.banner.urgent ? 'shrink-0 text-amber-600' : 'shrink-0 text-brand-text'}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold text-slate-800">{vm.banner.text}</p>
        <p className="m-0 text-xs text-slate-600">{vm.banner.detail}</p>
      </div>
      <Link to="/plans">
        <Button type="primary" size="small">
          Ver planes
        </Button>
      </Link>
    </div>
  )
}

/** Pantalla cuando la prueba vencio sin un plan vigente. */
export function TrialExpiredState({ vm }: { vm: TrialViewModel }) {
  return (
    <Card className="surface-card mx-auto max-w-xl">
      <Result
        icon={<Lock size={48} className="mx-auto text-slate-400" />}
        title="La prueba gratis termino"
        subTitle={
          vm.canPay
            ? `Elige un plan para seguir usando EdiFeasy en ${vm.condominiumName}. Tus datos estan guardados y vuelven en cuanto se confirme el pago.`
            : `El acceso a ${vm.condominiumName} esta pausado mientras la administracion activa un plan.`
        }
        extra={
          vm.canPay ? (
            <Link to="/plans">
              <Button type="primary" size="large">
                Elegir un plan
              </Button>
            </Link>
          ) : null
        }
      />
    </Card>
  )
}

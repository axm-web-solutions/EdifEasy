import type { ReactNode } from 'react'
import { Alert, Button, Card, Checkbox, Spin } from 'antd'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useLegalConsentViewModel } from '../viewmodels/useLegalConsentViewModel'

/** Bloquea la app hasta que el usuario acepte los documentos vigentes. */
export function LegalConsentGate({ children }: { children: ReactNode }) {
  const vm = useLegalConsentViewModel()

  if (vm.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }
  if (!vm.blocked) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <Card className="surface-card w-full max-w-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
            <ShieldCheck size={22} />
          </span>
          <h1 className="m-0 text-lg font-semibold text-slate-900">
            {vm.isUpdate ? 'Actualizamos nuestros documentos' : 'Antes de continuar'}
          </h1>
        </div>
        <p className="mt-0 text-sm text-slate-600">
          Para usar EdiFeasy necesitamos tu aceptacion. Puedes leer cada documento en una pestana
          nueva. Guardamos la fecha y la version que aceptas como prueba, segun la Ley 1581 de 2012.
        </p>

        <div className="my-4 space-y-3">
          {vm.items.map((item) => (
            <Checkbox
              key={item.document}
              checked={item.checked}
              onChange={(event) => vm.toggle(item.document, event.target.checked)}
            >
              {item.text}{' '}
              <Link to={item.link} target="_blank" rel="noopener">
                {item.linkText}
              </Link>
              .
            </Checkbox>
          ))}
        </div>

        {vm.error ? <Alert type="error" showIcon message={vm.error} className="mb-3" /> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={vm.signOut}>Salir</Button>
          <Button
            type="primary"
            disabled={!vm.canAccept}
            loading={vm.accepting}
            onClick={vm.accept}
          >
            Aceptar y continuar
          </Button>
        </div>
      </Card>
    </div>
  )
}

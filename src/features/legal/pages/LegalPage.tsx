import { Alert, Card, Segmented, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { LegalMarkdown } from '../components/LegalMarkdown'
import { useLegalPageViewModel } from '../viewmodels/useLegalPageViewModel'

/** Pagina publica de un documento legal (/legal/terminos | privacidad | marketplace). */
export function LegalPage() {
  const vm = useLegalPageViewModel()

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <img src="/brand/edifeasy-mark.png" alt="" className="h-9 w-9 object-contain" />
            <span className="text-base font-semibold text-slate-800">EdiFeasy</span>
          </Link>
          <Segmented
            value={vm.slug}
            onChange={(value) => vm.go(value as string)}
            options={vm.options}
          />
        </header>

        {vm.incomplete ? (
          <Alert
            type="warning"
            showIcon
            className="mb-4"
            message="Documento en preparacion: faltan algunos datos del operador."
          />
        ) : null}

        <Card className="surface-card">
          {vm.loading ? (
            <Skeleton active paragraph={{ rows: 12 }} />
          ) : (
            <LegalMarkdown source={vm.text} />
          )}
        </Card>
      </div>
    </div>
  )
}

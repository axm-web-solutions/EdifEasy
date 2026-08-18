import type { ReactNode } from 'react'
import { envErrors, envIsValid } from '@/lib/env'

/**
 * Si faltan las variables de Supabase, mostramos instrucciones claras en lugar
 * de dejar que la app falle con errores de red incomprensibles.
 */
export function EnvGuard({ children }: { children: ReactNode }) {
  if (envIsValid) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-slate-100">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800/60 p-8">
        <h1 className="mb-2 text-2xl font-semibold">Configuracion pendiente</h1>
        <p className="text-slate-300">
          EdiFeasy necesita las credenciales de tu proyecto Supabase para funcionar.
        </p>

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-slate-300">
          <li>
            Copia <code className="rounded bg-slate-900 px-1.5 py-0.5">.env.example</code> como{' '}
            <code className="rounded bg-slate-900 px-1.5 py-0.5">.env</code>
          </li>
          <li>
            Completa <code className="rounded bg-slate-900 px-1.5 py-0.5">VITE_SUPABASE_URL</code> y{' '}
            <code className="rounded bg-slate-900 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> con los
            valores de <em>Project Settings &rarr; API</em>
          </li>
          <li>
            Reinicia el servidor de desarrollo:{' '}
            <code className="rounded bg-slate-900 px-1.5 py-0.5">npm run dev</code>
          </li>
        </ol>

        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="m-0 mb-2 text-sm font-medium text-red-200">Variables invalidas o faltantes</p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-red-100">
            {envErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

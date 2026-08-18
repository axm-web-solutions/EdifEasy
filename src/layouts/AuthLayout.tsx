import { Outlet } from 'react-router-dom'
import { Building2, ShieldCheck, Sparkles } from 'lucide-react'

const HIGHLIGHTS = [
  {
    icon: Building2,
    title: 'Multi-condominio',
    description: 'Administra varios conjuntos desde una sola cuenta, con datos totalmente aislados.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguridad por roles',
    description: 'Permisos aplicados directamente en PostgreSQL con Row Level Security.',
  },
  {
    icon: Sparkles,
    title: 'Todo en un lugar',
    description: 'Alertas, comunicados, solicitudes, incidentes, gastos, compras y multas.',
  },
]

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-start bg-surface">
      {/*
        El panel se ancla a la altura de la ventana. Sin esto, al crecer el
        formulario de la derecha esta columna se estira y `justify-between`
        reparte su contenido a lo largo de miles de pixeles, dejando a la vista
        solo el logo.
      */}
      <aside
        className="sticky top-0 relative hidden h-screen w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white lg:flex xl:w-[55%]"
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-800/40 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="EdiFeasy" className="h-10 w-10" />
          <div>
            <p className="m-0 text-lg font-semibold">EdiFeasy</p>
            <p className="m-0 text-xs text-slate-400">Administracion de condominios</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-3xl font-semibold leading-tight xl:text-4xl">
            La plataforma para administrar condominios, edificios y conjuntos residenciales.
          </h1>
          <p className="mt-3 text-slate-300">
            Centraliza la operacion, la comunicacion con residentes y el control financiero de tu
            propiedad horizontal.
          </p>

          <div className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="mt-0.5 rounded-lg bg-white/10 p-2">
                  <item.icon size={18} />
                </span>
                <div>
                  <p className="m-0 font-medium">{item.title}</p>
                  <p className="m-0 text-sm text-slate-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative m-0 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} EdiFeasy. Todos los derechos reservados.
        </p>
      </aside>

      <main className="flex w-full items-start justify-center px-4 py-10 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="EdiFeasy" className="h-9 w-9" />
            <div>
              <p className="m-0 text-base font-semibold text-slate-800">EdiFeasy</p>
              <p className="m-0 text-xs text-slate-500">Administracion de condominios</p>
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

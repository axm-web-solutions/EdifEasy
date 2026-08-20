import { Outlet } from 'react-router-dom'
import { Building2, ShieldCheck, Sparkles } from 'lucide-react'
import { GlassTowers } from '@/components/ui/GlassTowers'

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
      <aside className="sticky top-0 relative hidden h-screen w-1/2 flex-col justify-between overflow-hidden bg-slate-900 text-white lg:flex xl:w-[55%]">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-brand-800/40 blur-3xl" />

        {/*
          La ilustracion cubre el panel entero (`slice` recorta lo que sobra en
          lugar de deformar), y el velo va de IZQUIERDA a derecha: opaco donde se
          apoya el texto y transparente sobre el cielo del punto de fuga, que es
          la parte que interesa ver.

          Con el velo de abajo arriba que habia antes, un cielo claro dejaba el
          texto ilegible; con este, la foto respira por la derecha y el texto
          conserva contraste.
        */}
        <GlassTowers className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/25" />

        <div className="relative z-10 flex items-center gap-3 p-10 pb-0">
          <img src="/favicon.svg" alt="EdiFeasy" className="h-10 w-10" />
          <div>
            <p className="m-0 text-lg font-semibold">EdiFeasy</p>
            <p className="m-0 text-xs text-slate-400">Administracion de condominios</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg px-10">
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
                <span className="mt-0.5 rounded-lg bg-white/10 p-2 ring-1 ring-white/10 backdrop-blur-sm">
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

        <p className="relative z-10 m-0 p-10 pt-0 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} EdiFeasy. Todos los derechos reservados.
        </p>
      </aside>

      {/* Degradado suave para que la columna del formulario no sea un plano gris. */}
      <main className="flex w-full items-start justify-center bg-gradient-to-b from-white via-surface to-brand-50/60 px-4 py-10 lg:w-1/2 xl:w-[45%]">
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

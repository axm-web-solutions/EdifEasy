import { Card, Skeleton, Tag } from 'antd'
import { ImageOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/states'
import { useMyPropertiesViewModel } from '../viewmodels/useMyPropertiesViewModel'

export function MyPropertiesPage() {
  const vm = useMyPropertiesViewModel()
  return (
    <div>
      <PageHeader
        title="Mis propiedades"
        subtitle="Como va cada propiedad que administra la inmobiliaria por ti."
        dataTour="agency-my-properties"
      />
      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.properties.length === 0 ? (
        <EmptyState
          title="Aun no tienes propiedades"
          description="La inmobiliaria las vinculara a tu cuenta."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vm.properties.map((item) => (
            <Card
              key={item.id}
              className="surface-card overflow-hidden"
              styles={{ body: { padding: 0 } }}
            >
              <div className="flex flex-col sm:flex-row">
                <div className="aspect-[4/3] w-full shrink-0 bg-slate-100 sm:w-44">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-400">
                      <ImageOff size={24} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                    <Tag color={item.statusColor} bordered={false} className="!m-0">
                      {item.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs text-slate-500">{item.location}</p>
                  {item.tenant ? (
                    <p className="m-0 text-sm text-slate-700">
                      Arrendada a {item.tenant} · {item.rent} / mes
                    </p>
                  ) : (
                    <p className="m-0 text-sm text-slate-600">Sin arrendatario · {item.price}</p>
                  )}
                  <p className="m-0 text-xs text-slate-600">
                    Recaudado ultimos 6 meses: <strong>{item.collected}</strong>
                    {item.pending ? ` · ${item.pending} pendientes` : ''}
                    {item.overdue ? ` · ${item.overdue} vencidos` : ''}
                  </p>
                  {item.charges.length ? (
                    <ul className="m-0 mt-2 list-none space-y-1 p-0">
                      {item.charges.map((charge) => (
                        <li
                          key={charge.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate capitalize text-slate-600">
                            {charge.concept} · {charge.periodLabel}
                          </span>
                          <Tag color={charge.statusColor} bordered={false} className="!m-0">
                            {charge.statusLabel}
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

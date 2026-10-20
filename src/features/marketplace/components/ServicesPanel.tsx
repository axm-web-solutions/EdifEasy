import { lazy, Suspense } from 'react'
import { Button, Card, Input, Skeleton, Switch, Tag } from 'antd'
import {
  BadgeCheck,
  Car,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Search,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ContactFormDrawer } from './ContactFormDrawer'

// El mapa (leaflet) se descarga solo al abrir esta pestana.
const NearbyPlacesCard = lazy(() =>
  import('@/features/dashboard/components/NearbyPlacesCard').then((m) => ({
    default: m.NearbyPlacesCard,
  })),
)
import { useMarketplaceViewModel } from '../viewmodels/useMarketplaceViewModel'
import { useContactFormViewModel } from '../viewmodels/useContactFormViewModel'
import type { MarketItem } from '../viewmodels/marketplace.logic'

function MarketCard({ item, onEdit }: { item: MarketItem; onEdit?: () => void }) {
  return (
    <Card
      size="small"
      className="surface-card h-full"
      styles={{ body: { padding: 14, height: '100%' } }}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900" title={item.name}>
              {item.name}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>{item.categoryLabel}</span>
              {item.distanceLabel ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} /> {item.distanceLabel}
                </span>
              ) : null}
            </div>
          </div>
          {onEdit ? (
            <Button
              type="text"
              size="small"
              aria-label={`Editar ${item.name}`}
              icon={<Pencil size={14} />}
              onClick={onEdit}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {item.source === 'admin' ? (
            <Tag bordered={false} color="green" className="!m-0 inline-flex items-center gap-1">
              <BadgeCheck size={12} /> Recomendado
            </Tag>
          ) : null}
          {item.hidden ? (
            <Tag bordered={false} className="!m-0">
              Oculto
            </Tag>
          ) : null}
        </div>

        {item.description ? (
          <p className="m-0 line-clamp-2 text-xs text-slate-600">{item.description}</p>
        ) : null}
        {item.address ? (
          <p className="m-0 truncate text-xs text-slate-500">{item.address}</p>
        ) : null}
        {item.phoneLabel ? (
          <p className="m-0 text-xs font-medium text-slate-700">{item.phoneLabel}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {item.callHref ? (
            <Button size="small" type="primary" icon={<Phone size={14} />} href={item.callHref}>
              Llamar
            </Button>
          ) : null}
          {item.whatsappHref ? (
            <Button
              size="small"
              icon={<MessageCircle size={14} />}
              href={item.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </Button>
          ) : null}
          {item.directionsHref ? (
            <Button
              size="small"
              icon={<Navigation size={14} />}
              href={item.directionsHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ir
            </Button>
          ) : null}
          {item.website ? (
            <Button
              size="small"
              icon={<Globe size={14} />}
              href={item.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Sitio web de ${item.name}`}
            />
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/** Pestana "Servicios cercanos": recomendados por la administracion y negocios del mapa. */
export function ServicesPanel() {
  const vm = useMarketplaceViewModel()
  const contactForm = useContactFormViewModel()

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {vm.uberHref ? (
          <Button
            icon={<Car size={16} />}
            href={vm.uberHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Pedir Uber
          </Button>
        ) : null}
        {vm.canManage ? (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => contactForm.openNew('SERVICE')}
          >
            Recomendar servicio
          </Button>
        ) : null}
      </div>

      {vm.condominiumId ? (
        <div className="mb-4">
          <Suspense
            fallback={
              <Card className="surface-card">
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            }
          >
            <NearbyPlacesCard condominiumId={vm.condominiumId} dataTour="marketplace-map" />
          </Suspense>
        </div>
      ) : null}

      <Card
        className="surface-card mb-4"
        styles={{ body: { padding: 12 } }}
        data-tour="marketplace-filters"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            allowClear
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Buscar: plomero, aseo, pizza..."
            value={vm.search}
            onChange={(event) => vm.setSearch(event.target.value)}
            className="md:max-w-sm"
            aria-label="Buscar servicios"
          />
          <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <Switch size="small" checked={vm.onlyWithPhone} onChange={vm.setOnlyWithPhone} />
            Solo con telefono
          </label>
        </div>
        {vm.chips.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Tag.CheckableTag
              checked={vm.category === null}
              onChange={() => vm.setCategory(null)}
              className="!m-0 shrink-0 rounded-full border border-slate-200 px-3 py-1"
            >
              Todos
            </Tag.CheckableTag>
            {vm.chips.map((chip) => (
              <Tag.CheckableTag
                key={chip.value}
                checked={vm.category === chip.value}
                onChange={(checked) => vm.setCategory(checked ? chip.value : null)}
                className="!m-0 shrink-0 rounded-full border border-slate-200 px-3 py-1"
              >
                {chip.label} ({chip.count})
              </Tag.CheckableTag>
            ))}
          </div>
        ) : null}
      </Card>

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState description="No se pudo cargar el marketplace." onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Aun no hay servicios"
          description={
            vm.canManage
              ? vm.hasLocation
                ? 'Recomienda los servicios de confianza del conjunto. Los negocios cercanos del mapa apareceran cuando se actualicen los alrededores.'
                : 'Registra la direccion del conjunto para ver negocios cercanos, o recomienda servicios de confianza.'
              : 'La administracion aun no ha recomendado servicios.'
          }
          action={
            vm.canManage ? (
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => contactForm.openNew('SERVICE')}
              >
                Recomendar servicio
              </Button>
            ) : undefined
          }
        />
      ) : vm.status === 'no-results' ? (
        <EmptyState
          title="Sin resultados"
          description="Prueba con otra busqueda o categoria."
          action={<Button onClick={vm.clearFilters}>Quitar filtros</Button>}
        />
      ) : (
        <>
          <p className="mb-3 mt-0 text-xs text-slate-500">
            {vm.total} resultado(s). Los negocios del mapa vienen de OpenStreetMap; confirma precios
            y disponibilidad directamente con ellos.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vm.items.map((item) => (
              <MarketCard
                key={item.id}
                item={item}
                onEdit={
                  vm.canManage && item.contact
                    ? () => contactForm.openEdit(item.contact!)
                    : undefined
                }
              />
            ))}
          </div>
          {vm.hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button onClick={vm.showMore}>Ver mas</Button>
            </div>
          ) : null}
        </>
      )}

      {contactForm.canManage ? <ContactFormDrawer form={contactForm} /> : null}
    </>
  )
}

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Result,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import { Link, useParams } from 'react-router-dom'
import { Controller } from 'react-hook-form'
import { ArrowLeft, Building2, ImageOff, Mail, MessageCircle, Phone, Search } from 'lucide-react'
import { TextAreaField, TextField } from '@/components/forms/fields'
import type { PropertyType } from '@/types/database'
import {
  useStorefrontPropertyViewModel,
  useStorefrontViewModel,
  type StorefrontPropertyViewModel,
} from '../viewmodels/useStorefrontViewModel'

function StoreShell({
  agency,
  children,
}: {
  agency: { name: string; logo: string | null } | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          {agency?.logo ? (
            <img src={agency.logo} alt="" className="h-9 w-9 rounded object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded bg-brand-50 text-brand-text">
              <Building2 size={18} />
            </span>
          )}
          <span className="min-w-0 truncate text-base font-semibold text-slate-900">
            {agency?.name ?? 'Inmobiliaria'}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-500">
        Tienda creada con EdiFeasy ·{' '}
        <Link to="/legal/privacidad" className="text-slate-500 underline">
          Tratamiento de datos
        </Link>
      </footer>
    </div>
  )
}

/** Tienda publica: /i/:slug */
export function StorefrontPage() {
  const { slug = '' } = useParams()
  const vm = useStorefrontViewModel(slug)

  if (vm.status === 'not-found') {
    return (
      <StoreShell agency={null}>
        <Result
          status="404"
          title="Tienda no disponible"
          subTitle="Revisa el enlace o escribe a la inmobiliaria."
        />
      </StoreShell>
    )
  }

  return (
    <StoreShell agency={vm.agency}>
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : vm.status === 'error' ? (
        <Alert type="error" showIcon message="No se pudo cargar la tienda. Intenta de nuevo." />
      ) : (
        <>
          <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="m-0 text-2xl font-semibold text-slate-900">Propiedades disponibles</h1>
              {vm.agency?.description ? (
                <p className="m-0 mt-1 max-w-2xl text-sm text-slate-600">{vm.agency.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {vm.agency?.whatsapp ? (
                <Button
                  type="primary"
                  icon={<MessageCircle size={16} />}
                  href={vm.agency.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </Button>
              ) : null}
              {vm.agency?.call ? (
                <Button icon={<Phone size={16} />} href={vm.agency.call}>
                  Llamar
                </Button>
              ) : null}
              {vm.agency?.email ? (
                <Button icon={<Mail size={16} />} href={`mailto:${vm.agency.email}`}>
                  Correo
                </Button>
              ) : null}
            </div>
          </section>

          <Card size="small" className="surface-card !mb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <Segmented
                value={vm.filters.operation}
                onChange={(value) => vm.setFilter('operation', value as 'ALL' | 'RENT' | 'SALE')}
                options={[
                  { value: 'ALL', label: 'Todas' },
                  { value: 'RENT', label: 'Arriendo' },
                  { value: 'SALE', label: 'Venta' },
                ]}
              />
              <Select
                className="w-full lg:w-44"
                value={vm.filters.type}
                onChange={(value: PropertyType | 'ALL') => vm.setFilter('type', value)}
                options={vm.typeOptions}
                aria-label="Tipo de propiedad"
              />
              <Select
                className="w-full lg:w-44"
                value={vm.filters.city}
                onChange={(value: string) => vm.setFilter('city', value)}
                options={vm.cityOptions}
                aria-label="Ciudad"
              />
              <Select
                className="w-full lg:w-40"
                value={vm.filters.minBedrooms ?? 0}
                onChange={(value: number) => vm.setFilter('minBedrooms', value || null)}
                options={vm.bedroomOptions}
                aria-label="Habitaciones"
              />
              <Input
                allowClear
                className="lg:max-w-xs"
                prefix={<Search size={14} className="text-slate-400" />}
                placeholder="Barrio, ciudad o palabra"
                value={vm.filters.search}
                onChange={(event) => vm.setFilter('search', event.target.value)}
              />
            </div>
          </Card>

          {vm.properties.length === 0 ? (
            <Result
              status="info"
              title={vm.total ? 'Nada coincide con tu busqueda' : 'Pronto publicaremos propiedades'}
              extra={vm.total ? <Button onClick={vm.clearFilters}>Ver todas</Button> : null}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vm.properties.map((item) => (
                <Link key={item.id} to={item.href} className="group block no-underline">
                  <Card
                    className="surface-card h-full overflow-hidden transition-shadow group-hover:shadow-md"
                    styles={{ body: { padding: 0 } }}
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-slate-400">
                          <ImageOff size={28} />
                        </span>
                      )}
                      <Tag className="!absolute left-2 top-2 !m-0" color="blue" bordered={false}>
                        {item.badge}
                      </Tag>
                      {item.reserved ? (
                        <Tag className="!absolute right-2 top-2 !m-0" color="gold" bordered={false}>
                          Reservada
                        </Tag>
                      ) : null}
                    </div>
                    <div className="space-y-1 p-4">
                      <p className="m-0 text-lg font-semibold text-slate-900">{item.price}</p>
                      {item.priceExtra ? (
                        <p className="m-0 text-xs text-slate-500">{item.priceExtra}</p>
                      ) : null}
                      <p className="m-0 text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="m-0 text-xs text-slate-500">
                        {item.type} · {item.location}
                      </p>
                      {item.specs.length ? (
                        <p className="m-0 text-xs text-slate-600">{item.specs.join(' · ')}</p>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </StoreShell>
  )
}

function LeadForm({ vm }: { vm: StorefrontPropertyViewModel }) {
  if (vm.sent) {
    return <Alert type="success" showIcon message="¡Listo! La inmobiliaria te contactara pronto." />
  }
  return (
    <form onSubmit={vm.submit} noValidate>
      {vm.sendError ? (
        <Alert type="error" showIcon message={vm.sendError} className="!mb-3" />
      ) : null}
      <TextField control={vm.control} name="name" label="Nombre" required />
      <TextField control={vm.control} name="phone" label="Telefono" required type="tel" />
      <TextField control={vm.control} name="email" label="Correo" type="email" />
      <TextAreaField
        control={vm.control}
        name="message"
        label="Mensaje"
        rows={3}
        maxLength={1000}
        placeholder="Quiero agendar una visita..."
      />
      <Controller
        control={vm.control}
        name="consent"
        render={({ field, fieldState }) => (
          <div className="mb-3">
            <Checkbox
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            >
              <span className="text-xs text-slate-600">
                Autorizo a la inmobiliaria a tratar mis datos para contactarme sobre esta propiedad,
                segun la{' '}
                <Link to="/legal/privacidad" target="_blank">
                  politica de tratamiento de datos
                </Link>
                .
              </span>
            </Checkbox>
            {fieldState.error ? (
              <p className="m-0 mt-1 text-xs text-red-600">{fieldState.error.message}</p>
            ) : null}
          </div>
        )}
      />
      <Button type="primary" htmlType="submit" block loading={vm.sending}>
        Quiero que me contacten
      </Button>
    </form>
  )
}

/** Ficha publica: /i/:slug/p/:propertyId */
export function StorefrontPropertyPage() {
  const { slug = '', propertyId = '' } = useParams()
  const vm = useStorefrontPropertyViewModel(slug, propertyId)
  const property = vm.property

  return (
    <StoreShell agency={vm.agency}>
      <Link
        to={vm.backHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 no-underline"
      >
        <ArrowLeft size={16} /> Todas las propiedades
      </Link>
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : vm.status === 'not-found' || !property ? (
        <Result status="404" title="Esta propiedad ya no esta disponible" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-xl bg-slate-100">
              {property.images.length ? (
                <img
                  src={property.images[vm.imageIndex]}
                  alt={property.title}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <span className="flex aspect-[4/3] items-center justify-center text-slate-400">
                  <ImageOff size={40} />
                </span>
              )}
            </div>
            {property.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {property.images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => vm.setImageIndex(index)}
                    className={`h-16 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 p-0 ${
                      index === vm.imageIndex ? 'border-brand-500' : 'border-transparent'
                    }`}
                    aria-label={`Foto ${index + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag color="blue" bordered={false} className="!m-0">
                  {property.badge}
                </Tag>
                <span className="text-sm text-slate-500">{property.type}</span>
                {property.code ? (
                  <span className="text-xs text-slate-400">Ref. {property.code}</span>
                ) : null}
              </div>
              <h1 className="m-0 mt-2 text-2xl font-semibold text-slate-900">{property.title}</h1>
              <p className="m-0 text-sm text-slate-600">{property.location}</p>
            </div>
            {property.specs.length ? (
              <div className="flex flex-wrap gap-2">
                {property.specs.map((spec) => (
                  <Tag key={spec} className="!m-0 !px-3 !py-1">
                    {spec}
                  </Tag>
                ))}
              </div>
            ) : null}
            {property.description ? (
              <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {property.description}
              </p>
            ) : null}
            {property.features.length ? (
              <ul className="m-0 grid list-disc gap-1 pl-5 text-sm text-slate-700 sm:grid-cols-2">
                {property.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="surface-card">
              <p className="m-0 text-2xl font-semibold text-slate-900">{property.price}</p>
              {property.priceExtra ? (
                <p className="m-0 text-sm text-slate-500">{property.priceExtra}</p>
              ) : null}
              {property.reserved ? (
                <Tag color="gold" bordered={false} className="!mt-2">
                  Reservada
                </Tag>
              ) : null}
              <div className="mt-4 flex flex-col gap-2">
                {vm.whatsapp ? (
                  <Button
                    type="primary"
                    size="large"
                    icon={<MessageCircle size={18} />}
                    href={vm.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preguntar por WhatsApp
                  </Button>
                ) : null}
                {vm.call ? (
                  <Button size="large" icon={<Phone size={18} />} href={vm.call}>
                    Llamar
                  </Button>
                ) : null}
              </div>
            </Card>
            <Card className="surface-card" title="Dejanos tus datos">
              <LeadForm vm={vm} />
            </Card>
          </div>
        </div>
      )}
    </StoreShell>
  )
}

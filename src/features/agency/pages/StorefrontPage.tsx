import { lazy, Suspense, type ReactNode } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Input,
  Modal,
  Result,
  Select,
  Skeleton,
} from 'antd'
import { Link, useParams } from 'react-router-dom'
import { Controller } from 'react-hook-form'
import {
  ArrowLeft,
  Bath,
  BedDouble,
  BedSingle,
  Briefcase,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  Globe,
  Home,
  ImageOff,
  Images,
  LandPlot,
  LayoutGrid,
  List,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Search,
  Store,
  Trees,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { TextAreaField, TextField } from '@/components/forms/fields'
import type { PropertyType } from '@/types/database'
import type { SpecKind } from '../agency.logic'
import type { StoreText } from '../storefront.i18n'
import {
  useStorefrontPropertyViewModel,
  useStorefrontViewModel,
  type StorefrontPropertyViewModel,
  type StorefrontViewModel,
} from '../viewmodels/useStorefrontViewModel'

// El mapa (leaflet) se descarga aparte para que la portada cargue rapido.
const StoreMap = lazy(() => import('../components/StoreMap').then((m) => ({ default: m.StoreMap })))

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ALL: LayoutGrid,
  APARTAMENTO: Building2,
  CASA: Home,
  APARTAESTUDIO: BedSingle,
  LOCAL: Store,
  OFICINA: Briefcase,
  BODEGA: Warehouse,
  LOTE: LandPlot,
  FINCA: Trees,
}

const SPEC_ICONS: Record<SpecKind, LucideIcon> = {
  bedrooms: BedDouble,
  bathrooms: Bath,
  area: Ruler,
  parking: Car,
  stratum: Building2,
}

type LanguageOption = { value: 'es' | 'en'; short: string; label: string; active: boolean }

/** Selector ES / EN de la tienda. `dark` para ponerlo sobre la foto de portada. */
function LanguageSwitch({
  languages,
  onChange,
  label,
  dark = false,
}: {
  languages: LanguageOption[]
  onChange: (value: 'es' | 'en') => void
  label: string
  dark?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full p-1 text-xs font-semibold ${
        dark ? 'bg-white/15 text-white backdrop-blur' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <Globe size={14} className="mx-1 opacity-80" aria-hidden />
      {languages.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          title={option.label}
          aria-pressed={option.active}
          onClick={() => onChange(option.value)}
          className={`min-h-[32px] min-w-[36px] cursor-pointer rounded-full border-0 px-2 transition ${
            option.active
              ? dark
                ? 'bg-white text-slate-900'
                : 'bg-white text-slate-900 shadow'
              : 'bg-transparent text-inherit hover:opacity-80'
          }`}
        >
          {option.short}
        </button>
      ))}
    </div>
  )
}

/** Tema de antd con el color de la marca de la inmobiliaria. */
function Brand({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: accent, borderRadius: 12 } }}>
      <div className="min-h-screen bg-white" style={{ ['--store-accent' as string]: accent }}>
        {children}
      </div>
    </ConfigProvider>
  )
}

function Footer({ name, t }: { name: string; t: StoreText }) {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-8 text-xs text-slate-500 sm:flex-row">
        <span>
          © {new Date().getFullYear()} {name}
        </span>
        <span>
          {t.madeWith} <strong className="text-slate-700">EdiFeasy</strong> ·{' '}
          <Link to="/legal/privacidad" className="text-slate-500 underline">
            {t.privacy}
          </Link>
        </span>
      </div>
    </footer>
  )
}

function MapFallback() {
  return <div className="h-full w-full animate-pulse rounded-2xl bg-slate-100" />
}

// ---------------------------------------------------------------- portada
function Hero({ vm }: { vm: StorefrontViewModel }) {
  const agency = vm.agency
  if (!agency) return null
  return (
    <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden md:min-h-[86vh] md:items-center">
      {agency.heroVideo ? (
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src={agency.heroVideo}
          poster={agency.heroImage}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      ) : (
        <img
          src={agency.heroImage}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover motion-safe:animate-ken-burns"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/30" />

      <header className="absolute inset-x-0 top-0">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-4">
          {agency.logo ? (
            <img
              src={agency.logo}
              alt=""
              className="h-10 w-10 rounded-xl bg-white/90 object-contain p-1"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
              <Building2 size={20} />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-white drop-shadow">
            {agency.name}
          </span>
          {agency.whatsapp ? (
            <a
              href={agency.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white no-underline backdrop-blur transition hover:bg-white/25 sm:inline-flex"
            >
              <MessageCircle size={16} /> {vm.t.writeUs}
            </a>
          ) : null}
          <LanguageSwitch
            dark
            languages={vm.languages}
            onChange={vm.setLang}
            label={vm.t.language}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-28 md:pb-0">
        <div className="max-w-3xl motion-safe:animate-fade-up">
          <h1 className="m-0 text-4xl font-semibold leading-tight text-white drop-shadow md:text-6xl">
            {agency.tagline}
          </h1>
          {agency.description ? (
            <p className="m-0 mt-4 max-w-2xl text-base text-white/85 md:text-lg">
              {agency.description}
            </p>
          ) : null}
        </div>

        {/* Buscador en pildora, estilo Airbnb. */}
        <div
          className="mt-8 flex max-w-4xl flex-col gap-2 rounded-3xl bg-white p-2 shadow-2xl motion-safe:animate-fade-up md:flex-row md:items-center md:rounded-full"
          style={{ animationDelay: '120ms' }}
        >
          <div className="flex rounded-full bg-slate-100 p-1">
            {vm.operations.map((operation) => (
              <button
                key={operation.value}
                type="button"
                aria-pressed={operation.active}
                onClick={() => vm.setFilter('operation', operation.value)}
                className={`flex-1 cursor-pointer rounded-full border-0 px-4 py-2 text-sm font-medium transition md:flex-none ${
                  operation.active
                    ? 'bg-white text-slate-900 shadow'
                    : 'bg-transparent text-slate-600'
                }`}
              >
                {operation.label}
              </button>
            ))}
          </div>
          <Select
            variant="borderless"
            className="w-full md:w-48"
            value={vm.filters.city}
            onChange={(value: string) => vm.setFilter('city', value)}
            options={vm.cityOptions}
            aria-label={vm.t.city}
          />
          <Input
            variant="borderless"
            className="flex-1"
            placeholder={vm.t.searchPlaceholder}
            value={vm.filters.search}
            onChange={(event) => vm.setFilter('search', event.target.value)}
          />
          <a
            href="#propiedades"
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white no-underline transition hover:brightness-110"
            style={{ background: 'var(--store-accent)' }}
          >
            <Search size={18} /> {vm.t.search}
          </a>
        </div>
      </div>
    </section>
  )
}

function Categories({ vm }: { vm: StorefrontViewModel }) {
  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur"
      aria-label={vm.t.categories}
    >
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4">
        {vm.categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.value] ?? LayoutGrid
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => vm.setCategory(category.value as PropertyType | 'ALL')}
              className={`flex shrink-0 cursor-pointer flex-col items-center gap-1 border-0 border-b-2 bg-transparent px-1 py-3 text-xs font-medium transition ${
                category.active
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              <Icon size={22} strokeWidth={1.6} />
              {category.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function PropertyCard({
  card,
  index,
  vm,
}: {
  card: StorefrontViewModel['cards'][number]
  index: number
  vm: StorefrontViewModel
}) {
  return (
    <Link
      to={card.href}
      className="group block text-inherit no-underline motion-safe:animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
      onMouseEnter={() => vm.setActiveId(card.id)}
      onMouseLeave={() => vm.setActiveId(null)}
    >
      <div className="relative aspect-[20/19] overflow-hidden rounded-2xl bg-slate-100">
        {card.cover ? (
          <img
            src={card.cover}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-slate-400">
            <ImageOff size={28} />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
          {card.badge}
        </span>
        {card.reserved ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-900">
            {vm.t.reserved}
          </span>
        ) : null}
        {card.images.length > 1 ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
            <Images size={12} /> {card.images.length}
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-0.5">
        <p className="m-0 truncate text-[15px] font-semibold text-slate-900">{card.title}</p>
        <p className="m-0 flex items-center gap-1 text-sm text-slate-500">
          <MapPin size={13} /> {card.location}
        </p>
        {card.specs.length ? (
          <p className="m-0 text-sm text-slate-500">{card.specs.join(' · ')}</p>
        ) : null}
        <p className="m-0 pt-1 text-[15px] text-slate-900">
          <strong>{card.price}</strong>
        </p>
        {card.priceExtra ? <p className="m-0 text-xs text-slate-500">{card.priceExtra}</p> : null}
      </div>
    </Link>
  )
}

/** Tienda publica: /i/:slug */
export function StorefrontPage() {
  const { slug = '' } = useParams()
  const vm = useStorefrontViewModel(slug)

  if (vm.status === 'loading') {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-[70vh] animate-pulse bg-slate-200" />
        <div className="mx-auto max-w-7xl p-4">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    )
  }
  if (vm.status !== 'ready' || !vm.agency) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Result
          status={vm.status === 'error' ? 'warning' : '404'}
          title={vm.status === 'error' ? vm.t.errorTitle : vm.t.notFoundTitle}
          subTitle={vm.t.notFoundHint}
        />
      </div>
    )
  }

  return (
    <Brand accent={vm.accent}>
      <Hero vm={vm} />
      <Categories vm={vm} />

      <main id="propiedades" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold text-slate-900">
            {vm.t.count(vm.cards.length)}
          </h2>
          <div className="flex items-center gap-2">
            <Select
              className="w-40"
              value={vm.filters.minBedrooms ?? 0}
              onChange={(value: number) => vm.setFilter('minBedrooms', value || null)}
              options={vm.bedroomOptions}
              aria-label={vm.t.bedrooms}
            />
            <Button onClick={vm.clearFilters}>{vm.t.clear}</Button>
          </div>
        </div>

        {vm.cards.length === 0 ? (
          <Result
            status="info"
            title={vm.total ? vm.t.noMatch : vm.t.comingSoon}
            extra={vm.total ? <Button onClick={vm.clearFilters}>{vm.t.seeAll}</Button> : null}
          />
        ) : (
          <div
            className={vm.hasMap ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]' : ''}
          >
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {vm.cards.map((card, index) => (
                <PropertyCard key={card.id} card={card} index={index} vm={vm} />
              ))}
            </div>
            {vm.hasMap ? (
              <aside className="hidden lg:block">
                <div className="sticky top-24 h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
                  <Suspense fallback={<MapFallback />}>
                    <StoreMap
                      points={vm.points}
                      activeId={vm.activeId}
                      accent={vm.accent}
                      label={vm.t.mapLabel}
                    />
                  </Suspense>
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </main>

      {/* Telefono: mapa a pantalla completa con boton flotante, como Airbnb. */}
      {vm.hasMap && vm.mapOpen ? (
        <div className="fixed inset-0 z-30 bg-white pt-14 lg:hidden">
          <Suspense fallback={<MapFallback />}>
            <StoreMap
              points={vm.points}
              activeId={vm.activeId}
              accent={vm.accent}
              label={vm.t.mapLabel}
            />
          </Suspense>
        </div>
      ) : null}
      {vm.hasMap ? (
        <button
          type="button"
          onClick={vm.toggleMap}
          className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border-0 bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:scale-105 lg:hidden"
        >
          {vm.mapOpen ? <List size={16} /> : <MapIcon size={16} />}
          {vm.mapOpen ? vm.t.showList : vm.t.showMap}
        </button>
      ) : null}

      <section className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="m-0 text-2xl font-semibold">{vm.t.ctaTitle}</p>
            <p className="m-0 mt-1 text-white/70">{vm.t.ctaText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {vm.agency.whatsapp ? (
              <Button
                type="primary"
                size="large"
                icon={<MessageCircle size={18} />}
                href={vm.agency.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </Button>
            ) : null}
            {vm.agency.call ? (
              <Button size="large" icon={<Phone size={18} />} href={vm.agency.call}>
                {vm.t.call}
              </Button>
            ) : null}
            {vm.agency.email ? (
              <Button size="large" icon={<Mail size={18} />} href={`mailto:${vm.agency.email}`}>
                {vm.t.email}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      <Footer name={vm.agency.name} t={vm.t} />
    </Brand>
  )
}

// ------------------------------------------------------------------ ficha
function LeadForm({ vm }: { vm: StorefrontPropertyViewModel }) {
  if (vm.sent) {
    return <Alert type="success" showIcon message={vm.t.sent} />
  }
  return (
    <form onSubmit={vm.submit} noValidate>
      {vm.sendError ? (
        <Alert type="error" showIcon message={vm.sendError} className="!mb-3" />
      ) : null}
      <TextField control={vm.control} name="name" label={vm.t.name} required />
      <TextField control={vm.control} name="phone" label={vm.t.phone} required type="tel" />
      <TextField control={vm.control} name="email" label={vm.t.email} type="email" />
      <TextAreaField
        control={vm.control}
        name="message"
        label={vm.t.message}
        rows={3}
        maxLength={1000}
        placeholder={vm.t.messagePlaceholder}
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
                {vm.t.consentBefore}{' '}
                <Link to="/legal/privacidad" target="_blank">
                  {vm.t.consentLink}
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
      <Button type="primary" htmlType="submit" block size="large" loading={vm.sending}>
        {vm.t.submit}
      </Button>
    </form>
  )
}

function Gallery({ vm }: { vm: StorefrontPropertyViewModel }) {
  const images = vm.property?.images ?? []
  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <ImageOff size={40} />
      </div>
    )
  }
  return (
    <div className="relative">
      <div className="grid h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:h-[460px]">
        {images.slice(0, 5).map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => vm.openGallery(index)}
            className={`cursor-pointer overflow-hidden border-0 bg-slate-100 p-0 ${
              index === 0 ? 'col-span-4 row-span-2 md:col-span-2' : 'hidden md:block'
            }`}
            aria-label={vm.t.photo(index + 1)}
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover transition duration-500 hover:scale-105"
            />
          </button>
        ))}
      </div>
      {images.length > 1 ? (
        <Button
          className="!absolute bottom-4 right-4 shadow"
          icon={<Images size={16} />}
          onClick={() => vm.openGallery(0)}
        >
          {vm.t.seePhotos(images.length)}
        </Button>
      ) : null}
      <Modal
        open={vm.galleryOpen}
        onCancel={vm.closeGallery}
        footer={null}
        width={1000}
        centered
        destroyOnHidden
      >
        <div className="relative">
          <img
            src={images[vm.imageIndex]}
            alt=""
            className="max-h-[70vh] w-full rounded-xl object-contain"
          />
          {images.length > 1 ? (
            <>
              <Button
                shape="circle"
                className="!absolute left-2 top-1/2 -translate-y-1/2"
                icon={<ChevronLeft size={18} />}
                aria-label={vm.t.prevPhoto}
                onClick={() =>
                  vm.setImageIndex((vm.imageIndex - 1 + images.length) % images.length)
                }
              />
              <Button
                shape="circle"
                className="!absolute right-2 top-1/2 -translate-y-1/2"
                icon={<ChevronRight size={18} />}
                aria-label={vm.t.nextPhoto}
                onClick={() => vm.setImageIndex((vm.imageIndex + 1) % images.length)}
              />
            </>
          ) : null}
        </div>
        <p className="m-0 mt-2 text-center text-sm text-slate-500">
          {vm.t.photoOf(vm.imageIndex + 1, images.length)}
        </p>
      </Modal>
    </div>
  )
}

/** Ficha publica: /i/:slug/p/:propertyId */
export function StorefrontPropertyPage() {
  const { slug = '', propertyId = '' } = useParams()
  const vm = useStorefrontPropertyViewModel(slug, propertyId)
  const property = vm.property

  return (
    <Brand accent={vm.accent}>
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link
            to={vm.backHref}
            className="inline-flex items-center gap-1 text-sm text-slate-700 no-underline"
          >
            <ArrowLeft size={18} /> <span className="hidden sm:inline">{vm.t.back}</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-900">
            {vm.agency?.name}
          </span>
          <LanguageSwitch languages={vm.languages} onChange={vm.setLang} label={vm.t.language} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-10">
        {vm.status === 'loading' ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : vm.status !== 'ready' || !property ? (
          <Result
            status="404"
            title={vm.t.propertyGone}
            extra={<Link to={vm.backHref}>{vm.t.seeOthers}</Link>}
          />
        ) : (
          <>
            <div className="mb-4 motion-safe:animate-fade-up">
              <h1 className="m-0 text-2xl font-semibold text-slate-900 md:text-3xl">
                {property.title}
              </h1>
              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                <MapPin size={14} /> {property.location} · {property.type} · {property.badge}
                {property.code ? (
                  <span className="text-slate-400">
                    · {vm.t.ref} {property.code}
                  </span>
                ) : null}
              </p>
            </div>

            <Gallery vm={vm} />

            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-8">
                {property.specItems.length ? (
                  <div className="flex flex-wrap gap-3 border-b border-slate-100 pb-6">
                    {property.specItems.map((spec) => {
                      const Icon = SPEC_ICONS[spec.kind]
                      return (
                        <span
                          key={spec.kind}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
                        >
                          <Icon size={18} className="text-slate-500" /> {spec.label}
                        </span>
                      )
                    })}
                  </div>
                ) : null}
                {property.description ? (
                  <section>
                    <h2 className="m-0 mb-2 text-lg font-semibold text-slate-900">
                      {vm.t.about}
                    </h2>
                    <p className="m-0 whitespace-pre-line leading-relaxed text-slate-700">
                      {property.description}
                    </p>
                  </section>
                ) : null}
                {property.features.length ? (
                  <section>
                    <h2 className="m-0 mb-3 text-lg font-semibold text-slate-900">
                      {vm.t.features}
                    </h2>
                    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                      {property.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-slate-700">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: 'var(--store-accent)' }}
                          />{' '}
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {vm.zone.length ? (
                  <section>
                    <h2 className="m-0 mb-1 text-lg font-semibold text-slate-900">{vm.t.where}</h2>
                    <p className="m-0 mb-3 text-sm text-slate-500">
                      {property.location}. {vm.t.approximate}
                    </p>
                    <div className="h-72 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                      <Suspense fallback={<MapFallback />}>
                        <StoreMap
                          points={vm.zone}
                          accent={vm.accent}
                          label={vm.t.mapLabel}
                          approximate
                        />
                      </Suspense>
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border border-slate-200 p-6 shadow-lg">
                  <p className="m-0 text-2xl font-semibold text-slate-900">{property.price}</p>
                  {property.priceExtra ? (
                    <p className="m-0 text-sm text-slate-500">{property.priceExtra}</p>
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
                        {vm.t.askWhatsapp}
                      </Button>
                    ) : null}
                    {vm.call ? (
                      <Button size="large" icon={<Phone size={18} />} href={vm.call}>
                        {vm.t.call}
                      </Button>
                    ) : null}
                  </div>
                  <div className="my-5 h-px bg-slate-100" />
                  <p className="m-0 mb-3 font-semibold text-slate-900">{vm.t.leaveData}</p>
                  <LeadForm vm={vm} />
                </div>
              </aside>
            </div>

            {vm.similar.length ? (
              <section className="mt-14">
                <h2 className="m-0 mb-4 text-lg font-semibold text-slate-900">
                  {vm.t.similar}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {vm.similar.map((card) => (
                    <Link
                      key={card.id}
                      to={card.href}
                      className="group block text-inherit no-underline"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                        {card.cover ? (
                          <img
                            src={card.cover}
                            alt={card.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : null}
                      </div>
                      <p className="m-0 mt-2 truncate font-semibold text-slate-900">{card.title}</p>
                      <p className="m-0 text-sm text-slate-500">{card.location}</p>
                      <p className="m-0 text-sm text-slate-900">
                        <strong>{card.price}</strong>
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      {/* Telefono: barra fija con precio y contacto. */}
      {property ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate font-semibold text-slate-900">{property.price}</p>
              <p className="m-0 truncate text-xs text-slate-500">{property.location}</p>
            </div>
            {vm.whatsapp ? (
              <Button
                type="primary"
                size="large"
                icon={<MessageCircle size={18} />}
                href={vm.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Footer name={vm.agency?.name ?? ''} t={vm.t} />
    </Brand>
  )
}

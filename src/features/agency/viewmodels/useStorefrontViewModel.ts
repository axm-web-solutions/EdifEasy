import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useStorefront } from '@/hooks/useAgency'
import { agencyService, type StorefrontProperty } from '@/services/agencyService'
import { getErrorMessage } from '@/lib/errors'
import { makeLeadSchema, type LeadFormValues } from '@/schemas/agency'
import { resolvePrimaryColor } from '@/utils/brand'
import { telHref, whatsappHref } from '@/utils/phone'
import type { PropertyType } from '@/types/database'
import {
  EMPTY_FILTERS,
  cityOptions,
  filterStorefront,
  inquiryText,
  locationLabel,
  markerPrice,
  operationLabel,
  priceLines,
  specItems,
  storeCategories,
  typeLabel,
  type StorefrontFilters,
} from '../agency.logic'
import { PRICE_TEXT, amenityLabel, localized, type StoreLang } from '../storefront.i18n'
import type { StoreMapPoint } from '../components/StoreMap'
import { useStoreLanguage } from './useStoreLanguage'

/** Foto de portada por defecto cuando la inmobiliaria no sube la suya. */
const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=2000&q=75&fm=jpg&fit=crop'

function coordinate(value: unknown): number | null {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function toCard(item: StorefrontProperty, slug: string, lang: StoreLang) {
  const price = priceLines(item, lang)
  const title = localized(lang, item.title, item.title_en) ?? item.title
  return {
    id: item.id,
    href: `/i/${slug}/p/${item.id}?lang=${lang}`,
    title,
    images: item.images,
    cover: item.images[0] ?? null,
    badge: operationLabel(item.operation, lang),
    type: typeLabel(item.property_type, lang),
    price: price.main,
    priceExtra: price.extra,
    location: locationLabel(item, lang),
    specItems: specItems(item, lang),
    specs: specItems(item, lang).map((spec) => spec.label),
    reserved: item.status === 'RESERVED',
    marker: markerPrice(item, lang),
    // Solo coordenadas numericas validas (la base puede no enviarlas).
    lat: coordinate(item.lat),
    lng: coordinate(item.lng),
  }
}

type Card = ReturnType<typeof toCard>

const toPoint = (card: Card): StoreMapPoint => ({
  id: card.id,
  lat: Number(card.lat),
  lng: Number(card.lng),
  label: card.marker,
  title: card.title,
  subtitle: card.location,
  cover: card.cover,
  href: card.href,
})

/** Tienda publica: portada, categorias, filtros, tarjetas y mapa. */
export function useStorefrontViewModel(slug: string) {
  const language = useStoreLanguage()
  const { lang, t } = language
  const query = useStorefront(slug)
  const store = query.data
  const [filters, setFilters] = useState<StorefrontFilters>(EMPTY_FILTERS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    if (store?.agency.name) document.title = t.documentTitle(store.agency.name)
  }, [store?.agency.name, t])

  const cards = useMemo(
    () =>
      filterStorefront(store?.properties ?? [], filters).map((item) => toCard(item, slug, lang)),
    [store?.properties, filters, slug, lang],
  )
  const points: StoreMapPoint[] = useMemo(
    () => cards.filter((card) => card.lat !== null && card.lng !== null).map(toPoint),
    [cards],
  )

  const agency = store?.agency
  const counts = useMemo(() => {
    const all = store?.properties ?? []
    return new Map<string, number>(
      storeCategories().map((category) => [
        category.value,
        category.value === 'ALL'
          ? all.length
          : all.filter((item) => item.property_type === category.value).length,
      ]),
    )
  }, [store?.properties])

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !store ? 'not-found' : 'ready',
    t,
    lang,
    languages: language.languages,
    setLang: language.setLang,
    accent: resolvePrimaryColor(agency?.primary_color),
    agency: agency
      ? {
          name: agency.name,
          logo: agency.logo_url,
          description: localized(lang, agency.description, agency.description_en),
          tagline:
            localized(lang, agency.tagline, agency.tagline_en) ?? t.defaultTagline(agency.name),
          heroImage: agency.hero_image || DEFAULT_HERO,
          heroVideo: agency.hero_video,
          whatsapp: whatsappHref(agency.whatsapp, t.whatsappHello(agency.name)),
          call: telHref(agency.phone),
          email: agency.email,
        }
      : null,
    total: store?.properties.length ?? 0,
    cards,
    points,
    hasMap: points.length > 0,
    activeId,
    setActiveId,
    mapOpen,
    toggleMap: () => setMapOpen((open) => !open),

    filters,
    setFilter: <K extends keyof StorefrontFilters>(key: K, value: StorefrontFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(EMPTY_FILTERS),
    operations: (
      [
        ['ALL', t.allOperations],
        ['RENT', t.rent],
        ['SALE', t.sale],
      ] as const
    ).map(([value, label]) => ({ value, label, active: filters.operation === value })),
    categories: storeCategories(lang)
      .filter((category) => (counts.get(category.value) ?? 0) > 0)
      .map((category) => ({
        ...category,
        active: filters.type === category.value,
      })),
    setCategory: (value: PropertyType | 'ALL') =>
      setFilters((current) => ({ ...current, type: value })),
    cityOptions: [
      { value: '', label: t.anyCity },
      ...cityOptions(store?.properties ?? []).map((city) => ({ value: city, label: city })),
    ],
    bedroomOptions: [
      { value: 0, label: t.bedrooms },
      ...[1, 2, 3, 4].map((value) => ({ value, label: t.bedroomsAtLeast(value) })),
    ],
  }
}

export type StorefrontViewModel = ReturnType<typeof useStorefrontViewModel>

/** Ficha publica de una propiedad: galeria, datos, zona en el mapa y contacto. */
export function useStorefrontPropertyViewModel(slug: string, propertyId: string) {
  const language = useStoreLanguage()
  const { lang, t } = language
  const query = useStorefront(slug)
  const store = query.data
  const item = store?.properties.find((property) => property.id === propertyId) ?? null
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [sent, setSent] = useState(false)

  const card = item ? toCard(item, slug, lang) : null
  useEffect(() => {
    if (card && store) document.title = `${card.title} | ${store.agency.name}`
  }, [card?.title, store]) // eslint-disable-line react-hooks/exhaustive-deps

  const schema = useMemo(() => makeLeadSchema(t.validation), [t])
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', message: '', consent: false },
  })
  const submitLead = useMutation({
    mutationFn: (values: LeadFormValues) =>
      agencyService.submitLead({
        slug,
        propertyId,
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        message: values.message || null,
        consent: values.consent,
      }),
    onSuccess: () => setSent(true),
  })

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const agency = store?.agency
  const similar = (store?.properties ?? [])
    .filter(
      (property) => property.id !== propertyId && property.property_type === item?.property_type,
    )
    .slice(0, 3)
    .map((property) => toCard(property, slug, lang))
  const extra = PRICE_TEXT[lang]

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !item ? 'not-found' : 'ready',
    t,
    lang,
    languages: language.languages,
    setLang: language.setLang,
    accent: resolvePrimaryColor(agency?.primary_color),
    backHref: `/i/${slug}?lang=${lang}`,
    agency: agency ? { name: agency.name, logo: agency.logo_url } : null,
    property:
      item && card
        ? {
            ...card,
            features: [
              item.furnished ? amenityLabel('Amoblado', lang) : null,
              item.pets_allowed ? amenityLabel('Admite mascotas', lang) : null,
              item.floor ? extra.floor(item.floor) : null,
              ...item.amenities.map((amenity) => amenityLabel(amenity, lang)),
            ].filter(
              (feature, index, all): feature is string =>
                Boolean(feature) && all.indexOf(feature) === index,
            ),
            description: localized(lang, item.description, item.description_en),
            code: item.code,
          }
        : null,
    zone: card && card.lat !== null && card.lng !== null ? [toPoint(card)] : [],
    similar,
    galleryOpen,
    openGallery: (index = 0) => {
      setImageIndex(index)
      setGalleryOpen(true)
    },
    closeGallery: () => setGalleryOpen(false),
    imageIndex,
    setImageIndex,
    whatsapp:
      item && card && agency
        ? whatsappHref(agency.whatsapp, inquiryText(card.title, item.code, url, lang))
        : null,
    call: telHref(agency?.phone),

    control: form.control,
    submit: form.handleSubmit((values) => submitLead.mutate(values)),
    sending: submitLead.isPending,
    // El servidor responde en espanol; en ingles se muestra un mensaje generico.
    sendError: submitLead.error ? (t.sendError ?? getErrorMessage(submitLead.error)) : null,
    sent,
  }
}

export type StorefrontPropertyViewModel = ReturnType<typeof useStorefrontPropertyViewModel>

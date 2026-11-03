import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useStorefront } from '@/hooks/useAgency'
import { agencyService, type StorefrontProperty } from '@/services/agencyService'
import { getErrorMessage } from '@/lib/errors'
import { leadSchema, type LeadFormValues } from '@/schemas/agency'
import { resolvePrimaryColor } from '@/utils/brand'
import { telHref, whatsappHref } from '@/utils/phone'
import type { PropertyType } from '@/types/database'
import {
  EMPTY_FILTERS,
  STORE_CATEGORIES,
  cityOptions,
  filterStorefront,
  inquiryText,
  locationLabel,
  markerPrice,
  operationLabel,
  priceLines,
  specs,
  typeLabel,
  type StorefrontFilters,
} from '../agency.logic'
import type { StoreMapPoint } from '../components/StoreMap'

/** Foto de portada por defecto cuando la inmobiliaria no sube la suya. */
const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=2000&q=75&fm=jpg&fit=crop'

function coordinate(value: unknown): number | null {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function toCard(item: StorefrontProperty, slug: string) {
  const price = priceLines(item)
  return {
    id: item.id,
    href: `/i/${slug}/p/${item.id}`,
    title: item.title,
    images: item.images,
    cover: item.images[0] ?? null,
    badge: operationLabel(item.operation),
    type: typeLabel(item.property_type),
    price: price.main,
    priceExtra: price.extra,
    location: locationLabel(item),
    specs: specs(item),
    reserved: item.status === 'RESERVED',
    marker: markerPrice(item),
    // Solo coordenadas numericas validas (la base puede no enviarlas).
    lat: coordinate(item.lat),
    lng: coordinate(item.lng),
  }
}

/** Tienda publica: portada, categorias, filtros, tarjetas y mapa. */
export function useStorefrontViewModel(slug: string) {
  const query = useStorefront(slug)
  const store = query.data
  const [filters, setFilters] = useState<StorefrontFilters>(EMPTY_FILTERS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    if (store?.agency.name)
      document.title = `${store.agency.name} | Propiedades en arriendo y venta`
  }, [store?.agency.name])

  const cards = useMemo(
    () => filterStorefront(store?.properties ?? [], filters).map((item) => toCard(item, slug)),
    [store?.properties, filters, slug],
  )
  const points: StoreMapPoint[] = useMemo(
    () =>
      cards
        .filter((card) => card.lat !== null && card.lng !== null)
        .map((card) => ({
          id: card.id,
          lat: Number(card.lat),
          lng: Number(card.lng),
          label: card.marker,
          title: card.title,
          subtitle: card.location,
          cover: card.cover,
          href: card.href,
        })),
    [cards],
  )

  const agency = store?.agency
  const counts = useMemo(() => {
    const all = store?.properties ?? []
    return new Map<string, number>(
      STORE_CATEGORIES.map((category) => [
        category.value,
        category.value === 'ALL'
          ? all.length
          : all.filter((item) => item.property_type === category.value).length,
      ]),
    )
  }, [store?.properties])

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !store ? 'not-found' : 'ready',
    accent: resolvePrimaryColor(agency?.primary_color),
    agency: agency
      ? {
          name: agency.name,
          logo: agency.logo_url,
          description: agency.description,
          tagline: agency.tagline || `Encuentra tu proximo hogar con ${agency.name}`,
          heroImage: agency.hero_image || DEFAULT_HERO,
          heroVideo: agency.hero_video,
          whatsapp: whatsappHref(
            agency.whatsapp,
            `Hola ${agency.name}, vi su tienda y quiero informacion.`,
          ),
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
    categories: STORE_CATEGORIES.filter((category) => (counts.get(category.value) ?? 0) > 0).map(
      (category) => ({
        ...category,
        active: filters.type === category.value,
      }),
    ),
    setCategory: (value: PropertyType | 'ALL') =>
      setFilters((current) => ({ ...current, type: value })),
    cityOptions: [
      { value: '', label: 'Cualquier ciudad' },
      ...cityOptions(store?.properties ?? []).map((city) => ({ value: city, label: city })),
    ],
    bedroomOptions: [
      { value: 0, label: 'Habitaciones' },
      { value: 1, label: '1 o mas' },
      { value: 2, label: '2 o mas' },
      { value: 3, label: '3 o mas' },
      { value: 4, label: '4 o mas' },
    ],
  }
}

export type StorefrontViewModel = ReturnType<typeof useStorefrontViewModel>

/** Ficha publica de una propiedad: galeria, datos, zona en el mapa y contacto. */
export function useStorefrontPropertyViewModel(slug: string, propertyId: string) {
  const query = useStorefront(slug)
  const store = query.data
  const item = store?.properties.find((property) => property.id === propertyId) ?? null
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (item && store) document.title = `${item.title} | ${store.agency.name}`
  }, [item, store])

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
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
  const card = item ? toCard(item, slug) : null
  const agency = store?.agency
  const similar = (store?.properties ?? [])
    .filter(
      (property) => property.id !== propertyId && property.property_type === item?.property_type,
    )
    .slice(0, 3)
    .map((property) => toCard(property, slug))

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !item ? 'not-found' : 'ready',
    accent: resolvePrimaryColor(agency?.primary_color),
    backHref: `/i/${slug}`,
    agency: agency ? { name: agency.name, logo: agency.logo_url } : null,
    property:
      item && card
        ? {
            ...card,
            features: [
              item.furnished ? 'Amoblado' : null,
              item.pets_allowed ? 'Admite mascotas' : null,
              item.floor ? `Piso ${item.floor}` : null,
              ...item.amenities,
            ].filter((feature): feature is string => Boolean(feature)),
            description: item.description,
            code: item.code,
          }
        : null,
    zone:
      card && card.lat !== null && card.lng !== null
        ? [
            {
              id: card.id,
              lat: Number(card.lat),
              lng: Number(card.lng),
              label: card.marker,
              title: card.title,
              subtitle: card.location,
              cover: card.cover,
              href: card.href,
            },
          ]
        : [],
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
      item && agency
        ? whatsappHref(agency.whatsapp, inquiryText(item.title, item.code, url))
        : null,
    call: telHref(agency?.phone),

    control: form.control,
    submit: form.handleSubmit((values) => submitLead.mutate(values)),
    sending: submitLead.isPending,
    sendError: submitLead.error ? getErrorMessage(submitLead.error) : null,
    sent,
  }
}

export type StorefrontPropertyViewModel = ReturnType<typeof useStorefrontPropertyViewModel>

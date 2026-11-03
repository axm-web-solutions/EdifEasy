import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useStorefront } from '@/hooks/useAgency'
import { agencyService } from '@/services/agencyService'
import { getErrorMessage } from '@/lib/errors'
import { leadSchema, type LeadFormValues } from '@/schemas/agency'
import { telHref, whatsappHref } from '@/utils/phone'
import {
  EMPTY_FILTERS,
  PROPERTY_TYPES,
  cityOptions,
  filterStorefront,
  inquiryText,
  locationLabel,
  operationLabel,
  priceLines,
  specs,
  typeLabel,
  type StorefrontFilters,
} from '../agency.logic'

/** Tienda publica de una inmobiliaria: listado con filtros. */
export function useStorefrontViewModel(slug: string) {
  const query = useStorefront(slug)
  const store = query.data
  const [filters, setFilters] = useState<StorefrontFilters>(EMPTY_FILTERS)

  useEffect(() => {
    if (store?.agency.name)
      document.title = `${store.agency.name} | Propiedades en arriendo y venta`
  }, [store?.agency.name])

  const properties = useMemo(
    () =>
      filterStorefront(store?.properties ?? [], filters).map((item) => {
        const price = priceLines(item)
        return {
          id: item.id,
          href: `/i/${slug}/p/${item.id}`,
          title: item.title,
          cover: item.images[0] ?? null,
          badge: operationLabel(item.operation),
          type: typeLabel(item.property_type),
          price: price.main,
          priceExtra: price.extra,
          location: locationLabel(item),
          specs: specs(item),
          reserved: item.status === 'RESERVED',
        }
      }),
    [store?.properties, filters, slug],
  )

  const agency = store?.agency
  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !store ? 'not-found' : 'ready',
    agency: agency
      ? {
          name: agency.name,
          logo: agency.logo_url,
          description: agency.description,
          city: agency.city,
          whatsapp: whatsappHref(
            agency.whatsapp,
            `Hola ${agency.name}, vi su tienda y quiero informacion.`,
          ),
          call: telHref(agency.phone),
          email: agency.email,
        }
      : null,
    total: store?.properties.length ?? 0,
    properties,
    filters,
    setFilter: <K extends keyof StorefrontFilters>(key: K, value: StorefrontFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(EMPTY_FILTERS),
    typeOptions: [{ value: 'ALL', label: 'Todos los tipos' }, ...PROPERTY_TYPES],
    cityOptions: [
      { value: '', label: 'Todas las ciudades' },
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

/** Ficha publica de una propiedad: fotos, datos, WhatsApp y formulario. */
export function useStorefrontPropertyViewModel(slug: string, propertyId: string) {
  const query = useStorefront(slug)
  const store = query.data
  const item = store?.properties.find((property) => property.id === propertyId) ?? null
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
  const price = item ? priceLines(item) : null
  const agency = store?.agency

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : !item ? 'not-found' : 'ready',
    backHref: `/i/${slug}`,
    agency: agency ? { name: agency.name, logo: agency.logo_url } : null,
    property: item
      ? {
          title: item.title,
          type: typeLabel(item.property_type),
          badge: operationLabel(item.operation),
          price: price?.main ?? '',
          priceExtra: price?.extra ?? null,
          location: locationLabel(item),
          specs: specs(item),
          features: [
            item.furnished ? 'Amoblado' : null,
            item.pets_allowed ? 'Admite mascotas' : null,
            item.floor ? `Piso ${item.floor}` : null,
            ...item.amenities,
          ].filter((feature): feature is string => Boolean(feature)),
          description: item.description,
          images: item.images,
          code: item.code,
          reserved: item.status === 'RESERVED',
        }
      : null,
    imageIndex: Math.min(imageIndex, Math.max(0, (item?.images.length ?? 1) - 1)),
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

import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { placesService } from '@/services/placesService'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllMembers } from '@/hooks/useMembers'
import { useAgencyMutations, useAgencyProperties, useStoreSettings } from '@/hooks/useAgency'
import { getErrorMessage } from '@/lib/errors'
import { propertySchema, type PropertyFormValues } from '@/schemas/agency'
import type { AgencyPropertyRow, PropertyStatus } from '@/types/database'
import { OPERATIONS, PROPERTY_STATUS, PROPERTY_TYPES, toPropertyView } from '../agency.logic'

const EMPTY: PropertyFormValues = {
  title: '',
  code: '',
  property_type: 'APARTAMENTO',
  operation: 'RENT',
  status: 'AVAILABLE',
  rent_price: null,
  admin_fee: 0,
  sale_price: null,
  address: '',
  neighborhood: '',
  city: '',
  stratum: null,
  area_m2: null,
  bedrooms: null,
  bathrooms: null,
  parking: null,
  floor: null,
  furnished: false,
  pets_allowed: false,
  description: '',
  title_en: '',
  description_en: '',
  images: [],
  latitude: null,
  longitude: null,
  owner_profile_id: null,
  owner_name: '',
  owner_phone: '',
  is_published: false,
}

export type PropertyFilter = PropertyStatus | 'ALL' | 'PUBLISHED'

/** Inventario de la inmobiliaria: crear, editar, publicar en la tienda. */
export function usePropertiesViewModel() {
  const { currentCondominiumId } = useAuth()
  const query = useAgencyProperties(currentCondominiumId)
  const membersQuery = useAllMembers(currentCondominiumId)
  const storeQuery = useStoreSettings(currentCondominiumId)
  const mutations = useAgencyMutations()

  const owners = useMemo(
    () =>
      (membersQuery.data ?? []).filter((member) => member.role?.code === 'OWNER' && member.profile),
    [membersQuery.data],
  )
  const ownerNames = useMemo(
    () => new Map(owners.map((member) => [member.user_id, member.profile?.full_name ?? ''])),
    [owners],
  )

  const rows = useMemo(() => query.data ?? [], [query.data])
  const [filter, setFilter] = useState<PropertyFilter>('ALL')
  const [search, setSearch] = useState('')
  const views = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter((row) =>
        filter === 'ALL' ? true : filter === 'PUBLISHED' ? row.is_published : row.status === filter,
      )
      .filter((row) =>
        term
          ? [row.title, row.code, row.neighborhood, row.city, row.address]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(term)
          : true,
      )
      .map((row) =>
        toPropertyView(row, row.owner_profile_id ? ownerNames.get(row.owner_profile_id) : null),
      )
  }, [rows, filter, search, ownerNames])

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AgencyPropertyRow | null>(null)
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: EMPTY,
  })
  const operation = useWatch({ control: form.control, name: 'operation' })
  const [latitude, longitude] = useWatch({ control: form.control, name: ['latitude', 'longitude'] })

  // Ubica la propiedad a partir de la direccion (OpenStreetMap).
  const geocode = useMutation({
    mutationFn: () =>
      placesService.geocode({
        address: form.getValues('address') || null,
        city: form.getValues('city') || null,
        country: 'Colombia',
      }),
    onSuccess: (point) => {
      if (!point) return
      form.setValue('latitude', point.lat, { shouldDirty: true })
      form.setValue('longitude', point.lon, { shouldDirty: true })
    },
  })

  const openNew = () => {
    form.reset(EMPTY)
    setEditing(null)
    mutations.saveProperty.reset()
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    form.reset({
      title: row.title,
      code: row.code ?? '',
      property_type: row.property_type,
      operation: row.operation,
      status: row.status,
      rent_price: row.rent_price === null ? null : Number(row.rent_price),
      admin_fee: Number(row.admin_fee),
      sale_price: row.sale_price === null ? null : Number(row.sale_price),
      address: row.address ?? '',
      neighborhood: row.neighborhood ?? '',
      city: row.city ?? '',
      stratum: row.stratum,
      area_m2: row.area_m2 === null ? null : Number(row.area_m2),
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      parking: row.parking,
      floor: row.floor,
      furnished: row.furnished,
      pets_allowed: row.pets_allowed,
      description: row.description ?? '',
      title_en: row.title_en ?? '',
      description_en: row.description_en ?? '',
      images: row.images,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      owner_profile_id: row.owner_profile_id,
      owner_name: row.owner_name ?? '',
      owner_phone: row.owner_phone ?? '',
      is_published: row.is_published,
    })
    setEditing(row)
    mutations.saveProperty.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const text = (value: string) => value.trim() || null
    // Los textos en ingles solo se envian si hay algo que guardar o la base ya
    // tiene las columnas (asi la ficha se puede guardar antes de la migracion).
    const english =
      values.title_en.trim() || values.description_en.trim() || (editing && 'title_en' in editing)
        ? { title_en: text(values.title_en), description_en: text(values.description_en) }
        : {}
    mutations.saveProperty.mutate(
      {
        id: editing?.id ?? null,
        values: {
          condominium_id: currentCondominiumId,
          title: values.title,
          code: text(values.code),
          property_type: values.property_type,
          operation: values.operation,
          status: values.status,
          rent_price: values.operation === 'SALE' ? null : values.rent_price,
          admin_fee: values.admin_fee ?? 0,
          sale_price: values.operation === 'RENT' ? null : values.sale_price,
          address: text(values.address),
          neighborhood: text(values.neighborhood),
          city: text(values.city),
          stratum: values.stratum,
          area_m2: values.area_m2,
          bedrooms: values.bedrooms,
          bathrooms: values.bathrooms,
          parking: values.parking,
          floor: values.floor,
          furnished: values.furnished,
          pets_allowed: values.pets_allowed,
          description: text(values.description),
          ...english,
          images: values.images,
          latitude: values.latitude,
          longitude: values.longitude,
          owner_profile_id: values.owner_profile_id || null,
          owner_name: text(values.owner_name),
          owner_phone: text(values.owner_phone),
          is_published: values.is_published,
        },
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  const slug = storeQuery.data?.slug ?? null

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : rows.length ? 'ready' : 'empty',
    retry: () => void query.refetch(),
    properties: views,
    total: rows.length,
    filter,
    setFilter,
    filterOptions: [
      { value: 'ALL', label: 'Todas' },
      { value: 'PUBLISHED', label: 'En la tienda' },
      ...Object.entries(PROPERTY_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
    ],
    search,
    setSearch,
    storeUrl: slug ? `${window.location.origin}/i/${slug}` : null,

    togglePublished: (id: string) => {
      const row = rows.find((item) => item.id === id)
      if (row) mutations.setPublished.mutate({ id, isPublished: !row.is_published })
    },
    remove: (id: string) => mutations.removeProperty.mutate(id),

    formOpen,
    isEditing: Boolean(editing),
    openNew,
    openEdit,
    closeForm: () => setFormOpen(false),
    control: form.control,
    condominiumId: currentCondominiumId,
    showRent: operation !== 'SALE',
    showSale: operation !== 'RENT',
    typeOptions: PROPERTY_TYPES,
    operationOptions: OPERATIONS,
    statusOptions: Object.entries(PROPERTY_STATUS).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
    ownerOptions: owners.map((member) => ({
      value: member.user_id,
      label: member.profile?.full_name ?? member.profile?.email ?? 'Propietario',
    })),
    location: latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null,
    setLocation: (point: { lat: number; lng: number }) => {
      form.setValue('latitude', Math.round(point.lat * 1e6) / 1e6, { shouldDirty: true })
      form.setValue('longitude', Math.round(point.lng * 1e6) / 1e6, { shouldDirty: true })
    },
    clearLocation: () => {
      form.setValue('latitude', null, { shouldDirty: true })
      form.setValue('longitude', null, { shouldDirty: true })
    },
    locate: () => geocode.mutate(),
    locating: geocode.isPending,
    locateMessage: geocode.isError
      ? 'No pudimos buscar la direccion. Toca el mapa para ubicarla.'
      : geocode.isSuccess && !geocode.data
        ? 'No encontramos esa direccion. Toca el mapa para ubicarla.'
        : geocode.data?.approximate
          ? 'Ubicamos solo la ciudad: ajusta el punto tocando el mapa.'
          : null,
    submit,
    submitting: mutations.saveProperty.isPending,
    submitError: mutations.saveProperty.error
      ? getErrorMessage(mutations.saveProperty.error)
      : null,
  }
}

export type PropertiesViewModel = ReturnType<typeof usePropertiesViewModel>

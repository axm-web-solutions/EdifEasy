import { useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllApartments } from '@/hooks/useApartments'
import { useListingImageUrls, useListingMutations, useListings } from '@/hooks/useListings'
import { listingService } from '@/services/listingService'
import { userService } from '@/services/userService'
import { useLegalMutations, useMyAcceptances, useSellerRegistry } from '@/hooks/useLegal'
import { LEGAL_VERSION, hasAccepted } from '@/features/legal/legal.logic'
import { DOCUMENT_TYPE_OPTIONS } from '@/constants/enums'
import { listingSchema, type ListingFormValues } from '@/schemas/listings'
import {
  CATEGORIES_WITH_CONDITION,
  LISTING_CATEGORIES,
  LISTING_PRICE_TYPES,
  MAX_LISTING_IMAGES,
  PROPERTY_CATEGORIES,
} from '@/constants/listings'
import type { ListingCategory } from '@/types/database'
import { compressImage } from '@/utils/image'
import { getErrorMessage } from '@/lib/errors'
import { notify } from '@/lib/notify'
import {
  categoryCounts,
  filterListings,
  readDetails,
  toListingView,
  type ClassifiedsSort,
  type ClassifiedsTab,
  type ListingView,
} from './classifieds.logic'

const PAGE = 24

const emptyValues = (phone: string, apartmentId: string | null): ListingFormValues => ({
  category: 'PRODUCTS',
  title: '',
  description: '',
  price_type: 'FIXED',
  price: null,
  item_condition: null,
  bedrooms: null,
  bathrooms: null,
  area_m2: null,
  parking: false,
  modality: null,
  delivery: false,
  schedule: '',
  apartment_id: apartmentId,
  contact_phone: phone,
  contact_whatsapp: phone,
  document_type: 'CC',
  document_number: '',
  accept_rules: false,
})

/**
 * Clasificados: lo que publican los vecinos, con filtros por categoria. Toda
 * publicacion pasa por aprobacion de la administracion (la base lo exige).
 */
export function useClassifiedsViewModel(tab: ClassifiedsTab) {
  const { currentCondominiumId, user, profile, hasRole, apartmentIds, refreshContext } = useAuth()
  const isAdmin = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])
  const userId = user?.id ?? null

  const listingsQuery = useListings(currentCondominiumId)
  const apartmentsQuery = useAllApartments(currentCondominiumId)
  const mutations = useListingMutations()
  const acceptancesQuery = useMyAcceptances(userId)
  const legal = useLegalMutations()
  // Ley 1480 art. 53: para publicar se necesita documento y aceptar las reglas.
  const needsDocument = !profile?.document_number?.trim()
  const needsRules = !hasAccepted(acceptancesQuery.data ?? [], 'MARKETPLACE_RULES')
  const [preparing, setPreparing] = useState(false)

  const [category, setCategory] = useState<ListingCategory | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ClassifiedsSort>('recent')
  const [limit, setLimit] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const views = useMemo(
    () => (listingsQuery.data ?? []).map((row) => toListingView(row, { userId, isAdmin })),
    [listingsQuery.data, userId, isAdmin],
  )
  const filtered = useMemo(
    () => filterListings(views, { tab, category, search, sort }),
    [views, tab, category, search, sort],
  )
  const shown = filtered.slice(0, limit)
  const selected = views.find((view) => view.id === selectedId) ?? null
  // Registro del vendedor: solo la administracion (para atender reclamos).
  const sellerQuery = useSellerRegistry(isAdmin ? selectedId : null)

  // Fotos: portadas de lo visible + todas las del detalle abierto.
  const coverUrls = useListingImageUrls(
    shown.map((view) => view.cover).filter((path): path is string => Boolean(path)),
  )
  const detailUrls = useListingImageUrls(selected?.images ?? [])
  const urlFor = (path: string | null) =>
    path ? (detailUrls.data?.[path] ?? coverUrls.data?.[path] ?? null) : null

  // ----------------------------------------------------------- formulario
  const myApartments = useMemo(
    () =>
      (apartmentsQuery.data ?? [])
        .filter((apartment) => apartmentIds.includes(apartment.id))
        .map((apartment) => ({
          value: apartment.id,
          label: `${apartment.building?.name ? `${apartment.building.name} · ` : ''}Apto ${apartment.number}`,
        })),
    [apartmentsQuery.data, apartmentIds],
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(0)
  const originalImages = useRef<string[]>([])
  const sessionUploads = useRef<string[]>([])
  const formUrls = useListingImageUrls(images)

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: emptyValues('', null),
  })
  const [formCategory, priceType] = useWatch({
    control: form.control,
    name: ['category', 'price_type'],
  })

  const resetUploads = () => {
    sessionUploads.current = []
    originalImages.current = []
    setImages([])
  }

  const closeForm = () => {
    // Fotos subidas en esta sesion que no se guardaron: se borran.
    const orphans = sessionUploads.current.filter((path) => !originalImages.current.includes(path))
    if (orphans.length) void listingService.removeImages(orphans).catch(() => undefined)
    resetUploads()
    setEditingId(null)
    setFormOpen(false)
  }

  const addFiles = async (files: File[]) => {
    if (!currentCondominiumId || !userId) return
    const room = MAX_LISTING_IMAGES - images.length - uploading
    const batch = files.slice(0, Math.max(0, room))
    if (files.length > batch.length)
      notify.warning(`Maximo ${MAX_LISTING_IMAGES} fotos por publicacion`)
    setUploading((count) => count + batch.length)
    for (const file of batch) {
      try {
        const compressed = await compressImage(file)
        const path = await listingService.uploadImage(currentCondominiumId, userId, compressed)
        sessionUploads.current.push(path)
        setImages((current) => [...current, path])
      } catch (error) {
        notify.error(getErrorMessage(error))
      } finally {
        setUploading((count) => count - 1)
      }
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId || !userId) return
    if (!editingId && needsDocument && !values.document_number) {
      form.setError('document_number', { message: 'Registra tu documento para poder publicar' })
      return
    }
    if (!editingId && needsRules && !values.accept_rules) {
      form.setError('accept_rules', { message: 'Debes aceptar las reglas del marketplace' })
      return
    }
    if (!editingId && (needsDocument || needsRules)) {
      setPreparing(true)
      try {
        if (needsDocument) {
          await userService.updateProfile(userId, {
            document_type: values.document_type || 'CC',
            document_number: values.document_number,
          })
          await refreshContext()
        }
        if (needsRules)
          await legal.accept.mutateAsync({
            documents: ['MARKETPLACE_RULES'],
            version: LEGAL_VERSION,
          })
      } catch (error) {
        notify.error(getErrorMessage(error))
        return
      } finally {
        setPreparing(false)
      }
    }
    const details = Object.fromEntries(
      Object.entries({
        bedrooms: PROPERTY_CATEGORIES.includes(values.category) ? values.bedrooms : null,
        bathrooms: PROPERTY_CATEGORIES.includes(values.category) ? values.bathrooms : null,
        area_m2: PROPERTY_CATEGORIES.includes(values.category) ? values.area_m2 : null,
        parking: PROPERTY_CATEGORIES.includes(values.category) ? values.parking || null : null,
        modality: values.category === 'CLASSES' ? values.modality : null,
        delivery: values.category === 'FOOD' ? values.delivery || null : null,
        schedule: values.schedule || null,
      }).filter(([, value]) => value !== null && value !== undefined),
    )
    const payload = {
      category: values.category,
      title: values.title,
      description: values.description,
      price_type: values.price_type,
      price: values.price_type === 'FREE' ? null : values.price,
      item_condition: CATEGORIES_WITH_CONDITION.includes(values.category)
        ? values.item_condition
        : null,
      details,
      images,
      apartment_id: values.apartment_id,
      contact_phone: values.contact_phone || null,
      contact_whatsapp: values.contact_whatsapp || null,
    }
    const removed = originalImages.current.filter((path) => !images.includes(path))
    const onSuccess = () => {
      if (removed.length) void listingService.removeImages(removed).catch(() => undefined)
      originalImages.current = images
      closeForm()
    }
    if (editingId) mutations.update.mutate({ id: editingId, values: payload }, { onSuccess })
    else
      mutations.create.mutate({ ...payload, condominium_id: currentCondominiumId }, { onSuccess })
  })

  const openEdit = (view: ListingView) => {
    const row = view.row
    const details = readDetails(row.details)
    resetUploads()
    originalImages.current = view.images
    setImages(view.images)
    setEditingId(row.id)
    form.reset({
      category: row.category,
      title: row.title,
      description: row.description,
      price_type: row.price_type,
      price: row.price === null ? null : Number(row.price),
      item_condition: row.item_condition,
      bedrooms: details.bedrooms ?? null,
      bathrooms: details.bathrooms ?? null,
      area_m2: details.area_m2 ?? null,
      parking: Boolean(details.parking),
      modality: details.modality ?? null,
      delivery: Boolean(details.delivery),
      schedule: details.schedule ?? '',
      apartment_id: row.apartment_id,
      contact_phone: row.contact_phone ?? '',
      contact_whatsapp: row.contact_whatsapp ?? '',
      document_type: 'CC',
      document_number: '',
      accept_rules: false,
    })
    setSelectedId(null)
    setFormOpen(true)
  }

  let status: 'loading' | 'error' | 'empty' | 'no-results' | 'ready'
  if (listingsQuery.isLoading) status = 'loading'
  else if (listingsQuery.isError) status = 'error'
  else if (filterListings(views, { tab, category: null, search: '', sort }).length === 0)
    status = 'empty'
  else if (filtered.length === 0) status = 'no-results'
  else status = 'ready'

  const resetPaging = () => setLimit(PAGE)

  return {
    isAdmin,
    status,
    retry: () => void listingsQuery.refetch(),
    pendingCount: views.filter((view) => view.status === 'PENDING').length,
    myCount: views.filter((view) => view.isMine).length,

    // filtros
    categories: categoryCounts(views),
    category,
    setCategory: (value: ListingCategory | null) => {
      setCategory(value)
      resetPaging()
    },
    search,
    setSearch: (value: string) => {
      setSearch(value)
      resetPaging()
    },
    sort,
    setSort,
    sortOptions: [
      { value: 'recent', label: 'Recientes' },
      { value: 'price_asc', label: 'Menor precio' },
      { value: 'price_desc', label: 'Mayor precio' },
    ],

    // lista
    listings: shown.map((view) => ({ ...view, coverUrl: urlFor(view.cover) })),
    total: filtered.length,
    hasMore: filtered.length > limit,
    showMore: () => setLimit((value) => value + PAGE),

    // detalle
    selected: selected
      ? {
          ...selected,
          imageUrls: selected.images
            .map((path) => urlFor(path))
            .filter((url): url is string => Boolean(url)),
        }
      : null,
    seller: sellerQuery.data
      ? {
          name: sellerQuery.data.full_name,
          document:
            `${sellerQuery.data.document_type ?? ''} ${sellerQuery.data.document_number}`.trim(),
          address: sellerQuery.data.address,
          phone: sellerQuery.data.phone,
          email: sellerQuery.data.email,
        }
      : null,
    openDetail: (id: string) => setSelectedId(id),
    closeDetail: () => setSelectedId(null),

    // formulario
    formOpen,
    formTitle: editingId ? 'Editar publicacion' : 'Nueva publicacion',
    openNew: () => {
      resetUploads()
      setEditingId(null)
      form.reset(emptyValues(profile?.phone ?? '', myApartments[0]?.value ?? null))
      setFormOpen(true)
    },
    openEdit,
    closeForm,
    control: form.control,
    formCategory,
    showPrice: priceType !== 'FREE',
    showCondition: CATEGORIES_WITH_CONDITION.includes(formCategory),
    showProperty: PROPERTY_CATEGORIES.includes(formCategory),
    showModality: formCategory === 'CLASSES',
    showDelivery: formCategory === 'FOOD',
    categoryOptions: (Object.keys(LISTING_CATEGORIES) as ListingCategory[]).map((value) => ({
      value,
      label: LISTING_CATEGORIES[value].label,
    })),
    categoryHint: LISTING_CATEGORIES[formCategory]?.hint ?? '',
    priceTypeOptions: Object.entries(LISTING_PRICE_TYPES).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
    apartmentOptions: myApartments,
    images: images.map((path) => ({ path, url: formUrls.data?.[path] ?? null })),
    uploading,
    canAddImages: images.length + uploading < MAX_LISTING_IMAGES,
    maxImages: MAX_LISTING_IMAGES,
    addFiles: (files: File[]) => void addFiles(files),
    removeImage: (path: string) => setImages((current) => current.filter((item) => item !== path)),
    submit,
    submitting: mutations.create.isPending || mutations.update.isPending || preparing,
    needsDocument: !editingId && needsDocument,
    needsRules: !editingId && needsRules,
    documentTypeOptions: DOCUMENT_TYPE_OPTIONS,
    approvalNote: isAdmin
      ? 'Como administrador, tu publicacion sale de inmediato.'
      : 'La administracion revisa cada publicacion antes de mostrarla. Si editas una publicada, vuelve a revision.',

    // acciones
    markSold: (view: ListingView) =>
      mutations.update.mutate({ id: view.id, values: { status: 'SOLD' } }),
    archive: (view: ListingView) =>
      mutations.update.mutate({ id: view.id, values: { status: 'ARCHIVED' } }),
    republish: (view: ListingView) =>
      mutations.update.mutate({ id: view.id, values: { status: 'PENDING' } }),
    remove: (view: ListingView) =>
      mutations.remove.mutate(view.row, { onSuccess: () => setSelectedId(null) }),
    approve: (id: string) => mutations.review.mutate({ id, approve: true, notes: null }),
    reject: (id: string, notes: string | null) =>
      mutations.review.mutate({ id, approve: false, notes }),
  }
}

export type ClassifiedsViewModel = ReturnType<typeof useClassifiedsViewModel>

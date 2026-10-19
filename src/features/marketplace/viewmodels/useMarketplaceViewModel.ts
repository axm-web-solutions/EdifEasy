import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCondominium } from '@/hooks/useCondominiums'
import { useCondominiumPlaces } from '@/hooks/usePlaces'
import { useDirectory } from '@/hooks/useDirectory'
import { uberPickupHref } from '@/utils/phone'
import { buildMarketItems, categoryChips, filterMarketItems } from './marketplace.logic'

/** Cuantos resultados se pintan antes de "Ver mas". */
const PAGE = 24

/**
 * Marketplace: servicios recomendados por la administracion y negocios
 * cercanos del mapa (aseo, plomeros, carpinteros, taxis, domicilios...).
 */
export function useMarketplaceViewModel() {
  const { currentCondominiumId, hasRole } = useAuth()
  const condominiumQuery = useCondominium(currentCondominiumId)
  const placesQuery = useCondominiumPlaces(currentCondominiumId)
  const directoryQuery = useDirectory(currentCondominiumId)

  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyWithPhone, setOnlyWithPhone] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  // RLS ya oculta los inactivos a quien no administra; la administracion los ve marcados.
  const allItems = useMemo(
    () => buildMarketItems(directoryQuery.data ?? [], placesQuery.data ?? []),
    [directoryQuery.data, placesQuery.data],
  )
  const chips = useMemo(() => categoryChips(allItems), [allItems])
  const filtered = useMemo(
    () => filterMarketItems(allItems, { category, search, onlyWithPhone }),
    [allItems, category, search, onlyWithPhone],
  )

  const condominium = condominiumQuery.data
  const point =
    condominium?.latitude != null && condominium.longitude != null
      ? { lat: Number(condominium.latitude), lon: Number(condominium.longitude) }
      : null

  let status: 'loading' | 'error' | 'empty' | 'no-results' | 'ready'
  if (directoryQuery.isLoading || placesQuery.isLoading) status = 'loading'
  else if (directoryQuery.isError && placesQuery.isError) status = 'error'
  else if (allItems.length === 0) status = 'empty'
  else if (filtered.length === 0) status = 'no-results'
  else status = 'ready'

  const resetPaging = () => setLimit(PAGE)

  return {
    status,
    canManage: hasRole(['ADMINISTRATOR', 'SUPER_ADMIN']),
    hasLocation: Boolean(point),
    items: filtered.slice(0, limit),
    total: filtered.length,
    hasMore: filtered.length > limit,
    showMore: () => setLimit((current) => current + PAGE),
    chips,
    category,
    setCategory: (value: string | null) => {
      setCategory(value)
      resetPaging()
    },
    search,
    setSearch: (value: string) => {
      setSearch(value)
      resetPaging()
    },
    onlyWithPhone,
    setOnlyWithPhone: (value: boolean) => {
      setOnlyWithPhone(value)
      resetPaging()
    },
    clearFilters: () => {
      setCategory(null)
      setSearch('')
      setOnlyWithPhone(false)
      resetPaging()
    },
    /** Pedir un Uber con recogida en el conjunto. */
    uberHref: point ? uberPickupHref(point, condominium?.name ?? 'Conjunto') : null,
    retry: () => {
      void directoryQuery.refetch()
      void placesQuery.refetch()
    },
  }
}

export type MarketplaceViewModel = ReturnType<typeof useMarketplaceViewModel>

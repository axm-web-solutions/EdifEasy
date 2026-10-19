/**
 * Reglas puras del marketplace: une los servicios que recomienda la
 * administracion con los negocios cercanos de OpenStreetMap.
 */
import type { CommunityContactRow } from '@/types/database'
import { PLACE_CATEGORIES, type NearbyPlace, type PlaceCategory } from '@/services/placesService'
import { SERVICE_CONTACT_CATEGORIES, directoryCategoryLabel } from '@/constants/directory'
import { directionsHref, formatPhone, telHref, whatsappHref } from '@/utils/phone'
import { formatDistance } from '@/features/feed/viewmodels/feed.logic'

/** Categorias del mapa que tambien interesan en el marketplace (domicilios). */
const MAP_EXTRAS: PlaceCategory[] = ['restaurant', 'cafe', 'pharmacy', 'supermarket']

export interface MarketItem {
  id: string
  source: 'admin' | 'map'
  name: string
  category: string
  categoryLabel: string
  color: string
  description: string | null
  address: string | null
  distance: number | null
  distanceLabel: string | null
  phoneLabel: string
  callHref: string | null
  whatsappHref: string | null
  directionsHref: string | null
  website: string | null
  /** Recomendado oculto a los residentes (solo lo ve la administracion). */
  hidden: boolean
  /** Fila original (solo recomendados), para editarla. */
  contact: CommunityContactRow | null
}

const ADMIN_COLOR = '#0f766e'

function categoryLabel(category: string): string {
  return category in PLACE_CATEGORIES
    ? PLACE_CATEGORIES[category as PlaceCategory].label
    : directoryCategoryLabel('SERVICE', category)
}

export function buildMarketItems(
  contacts: CommunityContactRow[],
  places: NearbyPlace[],
): MarketItem[] {
  const recommended = contacts
    .filter((contact) => contact.kind === 'SERVICE')
    .map<MarketItem>((contact) => {
      const phone = contact.phone ?? contact.whatsapp
      return {
        id: `contact:${contact.id}`,
        source: 'admin',
        name: contact.name,
        category: contact.category,
        categoryLabel: categoryLabel(contact.category),
        color: ADMIN_COLOR,
        description: contact.description,
        address: contact.address,
        distance: null,
        distanceLabel: null,
        phoneLabel: formatPhone(phone),
        callHref: telHref(contact.phone),
        whatsappHref: whatsappHref(
          contact.whatsapp ?? contact.phone,
          'Hola, encontre tu numero en EdiFeasy.',
        ),
        directionsHref: null,
        website: null,
        hidden: !contact.is_active,
        contact,
      }
    })

  const nearby = places
    .filter(
      (place) =>
        PLACE_CATEGORIES[place.category].group === 'service' || MAP_EXTRAS.includes(place.category),
    )
    .sort((a, b) => a.distance - b.distance)
    .map<MarketItem>((place) => ({
      id: `place:${place.id}`,
      source: 'map',
      name: place.name,
      category: place.category,
      categoryLabel: PLACE_CATEGORIES[place.category].label,
      color: PLACE_CATEGORIES[place.category].hex,
      description: null,
      address: place.address,
      distance: place.distance,
      distanceLabel: formatDistance(place.distance),
      phoneLabel: formatPhone(place.phone),
      callHref: telHref(place.phone),
      whatsappHref: whatsappHref(place.whatsapp ?? place.phone),
      directionsHref: directionsHref(place),
      website: place.website,
      hidden: false,
      contact: null,
    }))

  return [...recommended, ...nearby]
}

export interface MarketFilters {
  category: string | null
  search: string
  onlyWithPhone: boolean
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filterMarketItems(items: MarketItem[], filters: MarketFilters): MarketItem[] {
  const search = normalize(filters.search.trim())
  return items.filter(
    (item) =>
      (!filters.category || item.category === filters.category) &&
      (!filters.onlyWithPhone || Boolean(item.callHref || item.whatsappHref)) &&
      (!search ||
        normalize(`${item.name} ${item.categoryLabel} ${item.description ?? ''}`).includes(search)),
  )
}

/** Chips de categoria con su conteo, en el orden del catalogo de servicios. */
export function categoryChips(
  items: MarketItem[],
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  const order = [
    ...SERVICE_CONTACT_CATEGORIES.map((category) => category.value),
    ...MAP_EXTRAS,
    'cafe',
  ]
  return [...counts.entries()]
    .sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
    .map(([value, count]) => ({ value, label: categoryLabel(value), count }))
}

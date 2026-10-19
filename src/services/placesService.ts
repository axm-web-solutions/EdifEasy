/**
 * Ubicacion del condominio y lugares cercanos a partir de OpenStreetMap.
 *
 * - Nominatim convierte la direccion registrada del condominio en coordenadas.
 * - Overpass consulta los comercios y servicios reales alrededor de ese punto.
 *
 * Son servicios publicos con limites estrictos (Nominatim: 1 consulta por
 * segundo para toda la aplicacion), asi que NO se consultan en cada visita:
 * la sesion de un administrador ubica el conjunto y guarda los lugares en la
 * base (`replace_condominium_location`); el resto de usuarios lee de la base.
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { CondominiumRow } from '@/types/database'

export interface GeoPoint {
  lat: number
  lon: number
  /** Direccion tal como la resolvio el mapa. */
  label: string
  /** true cuando no se encontro la direccion exacta y se uso la ciudad. */
  approximate: boolean
}

export type PlaceCategory =
  | 'mall'
  | 'supermarket'
  | 'restaurant'
  | 'cafe'
  | 'pharmacy'
  | 'health'
  | 'bank'
  | 'education'
  | 'park'
  | 'gym'

export interface NearbyPlace {
  id: string
  name: string
  category: PlaceCategory
  lat: number
  lon: number
  /** Distancia en metros desde el condominio. */
  distance: number
  address: string | null
}

export const PLACE_CATEGORIES: Record<PlaceCategory, { label: string; hex: string }> = {
  mall: { label: 'Centros comerciales', hex: '#7c3aed' },
  supermarket: { label: 'Supermercados', hex: '#16a34a' },
  restaurant: { label: 'Restaurantes', hex: '#ea580c' },
  cafe: { label: 'Cafeterias', hex: '#a16207' },
  pharmacy: { label: 'Droguerias', hex: '#db2777' },
  health: { label: 'Salud', hex: '#dc2626' },
  bank: { label: 'Bancos y cajeros', hex: '#2563eb' },
  education: { label: 'Educacion', hex: '#0891b2' },
  park: { label: 'Parques', hex: '#65a30d' },
  gym: { label: 'Gimnasios', hex: '#475569' },
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
/** Servidores publicos de Overpass; si uno falla o tarda se prueba el siguiente. */
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
// La consulta en paralelo se cancela si nadie responde en 3 veces este tiempo.
const OVERPASS_TIMEOUT_MS = 12000
const PER_CATEGORY_LIMIT = 120

/** Filtros de OpenStreetMap que alimentan cada categoria. */
const OVERPASS_SELECTORS: Record<PlaceCategory, string[]> = {
  mall: ['nwr["shop"~"^(mall|department_store)$"]'],
  supermarket: ['nwr["shop"~"^(supermarket|convenience)$"]'],
  restaurant: ['nwr["amenity"~"^(restaurant|fast_food)$"]'],
  cafe: ['nwr["amenity"="cafe"]', 'nwr["shop"="bakery"]'],
  pharmacy: ['nwr["amenity"="pharmacy"]', 'nwr["shop"="chemist"]'],
  health: ['nwr["amenity"~"^(hospital|clinic|doctors|dentist)$"]'],
  bank: ['nwr["amenity"~"^(bank|atm)$"]'],
  education: ['nwr["amenity"~"^(school|university|college|kindergarten)$"]'],
  park: ['nwr["leisure"="park"]'],
  gym: ['nwr["leisure"="fitness_centre"]'],
}

async function searchNominatim(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'es',
  })
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { signal })
  if (!response.ok) throw new Error('No se pudo consultar el servicio de mapas')
  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[]
  return results[0] ?? null
}

/** Clasifica un elemento de OSM en una de las categorias que mostramos. */
function categorize(tags: Record<string, string>): PlaceCategory | null {
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'mall'
  if (tags.shop === 'supermarket' || tags.shop === 'convenience') return 'supermarket'
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'restaurant'
  if (tags.amenity === 'cafe' || tags.shop === 'bakery') return 'cafe'
  if (tags.amenity === 'pharmacy' || tags.shop === 'chemist') return 'pharmacy'
  if (['hospital', 'clinic', 'doctors', 'dentist'].includes(tags.amenity)) return 'health'
  if (tags.amenity === 'bank' || tags.amenity === 'atm') return 'bank'
  if (['school', 'university', 'college', 'kindergarten'].includes(tags.amenity)) return 'education'
  if (tags.leisure === 'park') return 'park'
  if (tags.leisure === 'fitness_centre') return 'gym'
  return null
}

function distanceInMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function buildAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) return tags['addr:full']
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' # ')
  return street || null
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/** Elementos de Overpass -> lugares con categoria, dentro del radio y ordenados por cercania. */
function toPlaces(
  elements: OverpassElement[],
  center: { lat: number; lon: number },
  radius: number,
): NearbyPlace[] {
  const places: NearbyPlace[] = []
  const seen = new Set<string>()
  for (const element of elements) {
    const id = `${element.type}/${element.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const tags = element.tags ?? {}
    const category = categorize(tags)
    const lat = element.lat ?? element.center?.lat
    const lon = element.lon ?? element.center?.lon
    if (!category || lat === undefined || lon === undefined || !tags.name) continue
    const distance = distanceInMeters(center, { lat, lon })
    if (distance > radius) continue
    places.push({ id, name: tags.name, category, lat, lon, distance, address: buildAddress(tags) })
  }
  return places.sort((a, b) => a.distance - b.distance)
}

/** Radio con el que se guardan los lugares; la vista filtra radios menores. */
export const NEARBY_FETCH_RADIUS = 2000
/** Cada cuanto se refrescan los lugares guardados. */
export const PLACES_MAX_AGE_DAYS = 7

/** Texto de direccion que se geocodifica; sirve para detectar cambios de direccion. */
export function locationSourceKey(
  condominium: Pick<CondominiumRow, 'address' | 'city' | 'country'>,
): string {
  return [condominium.address, condominium.city, condominium.country].filter(Boolean).join(', ')
}

export const placesService = {
  /** Lugares guardados para el condominio, del mas cercano al mas lejano. */
  async listCached(condominiumId: string): Promise<NearbyPlace[]> {
    const { data, error } = await supabase
      .from('condominium_places')
      .select('osm_id, name, category, latitude, longitude, distance_m, address')
      .eq('condominium_id', condominiumId)
      .order('distance_m', { ascending: true })
    if (error) throw toAppError(error)
    return data
      .filter((row) => row.category in PLACE_CATEGORIES)
      .map((row) => ({
        id: row.osm_id,
        name: row.name,
        category: row.category as PlaceCategory,
        lat: Number(row.latitude),
        lon: Number(row.longitude),
        distance: row.distance_m,
        address: row.address,
      }))
  },

  /**
   * Guarda solo las coordenadas del conjunto, sin tocar sus lugares: asi el mapa
   * aparece en cuanto se ubica la direccion, aunque Overpass tarde o falle.
   */
  async saveCoordinates(condominiumId: string, location: GeoPoint & { source: string }) {
    const { error } = await supabase
      .from('condominiums')
      .update({
        latitude: Number(location.lat.toFixed(6)),
        longitude: Number(location.lon.toFixed(6)),
        location_label: location.label,
        location_approximate: location.approximate,
        location_source: location.source,
      })
      .eq('id', condominiumId)
    if (error) throw toAppError(error)
  },

  /**
   * Guarda (atomicamente) la ubicacion del conjunto, si cambio, y reemplaza sus
   * lugares cercanos. Solo la administracion del conjunto puede hacerlo.
   */
  async saveLocation(
    condominiumId: string,
    location: (GeoPoint & { source: string }) | null,
    places: NearbyPlace[],
  ): Promise<number> {
    const { data, error } = await supabase.rpc('replace_condominium_location', {
      p_condominium: condominiumId,
      p_location: location
        ? {
            latitude: Number(location.lat.toFixed(6)),
            longitude: Number(location.lon.toFixed(6)),
            label: location.label,
            approximate: location.approximate,
            source: location.source,
          }
        : null,
      p_places: places.map((place) => ({
        osm_id: place.id,
        name: place.name,
        category: place.category,
        latitude: Number(place.lat.toFixed(6)),
        longitude: Number(place.lon.toFixed(6)),
        distance_m: Math.round(place.distance),
        address: place.address,
      })),
    })
    if (error) throw toAppError(error)
    return data
  },

  /**
   * Geocodifica la direccion del condominio. Si la direccion exacta no existe
   * en el mapa se intenta con la ciudad para al menos ubicar la zona.
   */
  async geocode(
    location: { address: string | null; city: string | null; country: string | null },
    signal?: AbortSignal,
  ): Promise<GeoPoint | null> {
    const { address, city, country } = location
    const exact = [address, city, country].filter(Boolean).join(', ')
    if (address && exact) {
      const hit = await searchNominatim(exact, signal)
      if (hit)
        return {
          lat: Number(hit.lat),
          lon: Number(hit.lon),
          label: hit.display_name,
          approximate: false,
        }
    }
    const fallback = [city, country].filter(Boolean).join(', ')
    if (!fallback) return null
    const hit = await searchNominatim(fallback, signal)
    if (!hit) return null
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      label: hit.display_name,
      approximate: true,
    }
  },

  /** Lugares con nombre dentro de `radius` metros, ordenados por cercania. */
  async nearby(
    center: { lat: number; lon: number },
    radius: number,
    signal?: AbortSignal,
  ): Promise<NearbyPlace[]> {
    // Un bbox es mucho mas rapido en Overpass que `around`; las esquinas que
    // quedan fuera del radio se descartan al calcular la distancia.
    const dLat = radius / 111320
    const dLon = radius / (111320 * Math.cos((center.lat * Math.PI) / 180))
    const bbox = `(${center.lat - dLat},${center.lon - dLon},${center.lat + dLat},${center.lon + dLon})`
    // Una salida por categoria con su propio cupo: asi los restaurantes, que
    // suelen ser cientos, no dejan por fuera a los centros comerciales o parques.
    const groups = Object.values(OVERPASS_SELECTORS).map((selectors) => {
      const union = selectors.map((selector) => `${selector}["name"]${bbox};`).join('')
      return `(${union});out center tags ${PER_CATEGORY_LIMIT};`
    })
    const query = ['[out:json][timeout:25];', ...groups].join('\n')

    // Se consultan todos los servidores a la vez y gana el primero que responda;
    // al llegar una respuesta valida se cancelan los demas. Solo ocurre una vez
    // por conjunto cada PLACES_MAX_AGE_DAYS, asi que la carga extra es minima.
    const controllers = OVERPASS_URLS.map(() => new AbortController())
    const abortAll = () => controllers.forEach((controller) => controller.abort())
    signal?.addEventListener('abort', abortAll)
    const timer = setTimeout(abortAll, OVERPASS_TIMEOUT_MS * 3)

    const ask = async (url: string, controller: AbortController): Promise<OverpassElement[]> => {
      const response = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Overpass respondio ${response.status}`)
      const json = (await response.json()) as { elements?: OverpassElement[] }
      if (!Array.isArray(json.elements)) throw new Error('Respuesta invalida de Overpass')
      return json.elements
    }

    try {
      const elements = await Promise.any(
        OVERPASS_URLS.map((url, index) => ask(url, controllers[index])),
      )
      return toPlaces(elements, center, radius)
    } catch (error) {
      if (signal?.aborted) throw error
      throw new Error('No se pudieron cargar los lugares cercanos')
    } finally {
      clearTimeout(timer)
      abortAll()
      signal?.removeEventListener('abort', abortAll)
    }
  },
}

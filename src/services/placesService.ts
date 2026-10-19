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
  // Alrededores (mapa del dashboard)
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
  // Emergencias
  | 'hospital'
  | 'police'
  | 'fire_station'
  // Servicios (marketplace)
  | 'cleaning'
  | 'laundry'
  | 'carpenter'
  | 'plumber'
  | 'electrician'
  | 'locksmith'
  | 'painter'
  | 'appliance_repair'
  | 'gardening'
  | 'hardware'
  | 'mechanic'
  | 'veterinary'
  | 'taxi'

/**
 * nearby: comercios del mapa · emergency: tarjeta de emergencias (tambien en el
 * mapa) · service: solo en el marketplace.
 */
export type PlaceGroup = 'nearby' | 'emergency' | 'service'

export interface NearbyPlace {
  id: string
  name: string
  category: PlaceCategory
  lat: number
  lon: number
  /** Distancia en metros desde el condominio. */
  distance: number
  address: string | null
  phone: string | null
  website: string | null
}

export const PLACE_CATEGORIES: Record<
  PlaceCategory,
  { label: string; hex: string; group: PlaceGroup }
> = {
  mall: { label: 'Centros comerciales', hex: '#7c3aed', group: 'nearby' },
  supermarket: { label: 'Supermercados', hex: '#16a34a', group: 'nearby' },
  restaurant: { label: 'Restaurantes', hex: '#ea580c', group: 'nearby' },
  cafe: { label: 'Cafeterias', hex: '#a16207', group: 'nearby' },
  pharmacy: { label: 'Droguerias', hex: '#db2777', group: 'nearby' },
  health: { label: 'Salud', hex: '#e11d48', group: 'nearby' },
  bank: { label: 'Bancos y cajeros', hex: '#2563eb', group: 'nearby' },
  education: { label: 'Educacion', hex: '#0891b2', group: 'nearby' },
  park: { label: 'Parques', hex: '#65a30d', group: 'nearby' },
  gym: { label: 'Gimnasios', hex: '#475569', group: 'nearby' },
  hospital: { label: 'Hospitales y urgencias', hex: '#dc2626', group: 'emergency' },
  police: { label: 'Policia', hex: '#1e3a8a', group: 'emergency' },
  fire_station: { label: 'Bomberos', hex: '#b91c1c', group: 'emergency' },
  cleaning: { label: 'Aseo y limpieza', hex: '#0d9488', group: 'service' },
  laundry: { label: 'Lavanderias', hex: '#0284c7', group: 'service' },
  carpenter: { label: 'Carpinteros', hex: '#92400e', group: 'service' },
  plumber: { label: 'Plomeros', hex: '#1d4ed8', group: 'service' },
  electrician: { label: 'Electricistas', hex: '#ca8a04', group: 'service' },
  locksmith: { label: 'Cerrajeros', hex: '#57534e', group: 'service' },
  painter: { label: 'Pintores', hex: '#be185d', group: 'service' },
  appliance_repair: { label: 'Tecnicos de electrodomesticos', hex: '#4338ca', group: 'service' },
  gardening: { label: 'Jardineria', hex: '#15803d', group: 'service' },
  hardware: { label: 'Ferreterias', hex: '#c2410c', group: 'service' },
  mechanic: { label: 'Talleres', hex: '#334155', group: 'service' },
  veterinary: { label: 'Veterinarias', hex: '#7e22ce', group: 'service' },
  taxi: { label: 'Taxis', hex: '#eab308', group: 'service' },
}

/** Nombre por defecto de los lugares de emergencia sin nombre en el mapa. */
const UNNAMED_EMERGENCY: Partial<Record<PlaceCategory, string>> = {
  hospital: 'Hospital',
  police: 'Estacion de policia',
  fire_station: 'Estacion de bomberos',
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
  health: ['nwr["amenity"~"^(clinic|doctors|dentist)$"]'],
  bank: ['nwr["amenity"~"^(bank|atm)$"]'],
  education: ['nwr["amenity"~"^(school|university|college|kindergarten)$"]'],
  park: ['nwr["leisure"="park"]'],
  gym: ['nwr["leisure"="fitness_centre"]'],
  hospital: ['nwr["amenity"="hospital"]'],
  police: ['nwr["amenity"="police"]'],
  fire_station: ['nwr["amenity"="fire_station"]'],
  cleaning: ['nwr["craft"="cleaning"]', 'nwr["shop"="cleaning"]', 'nwr["office"="cleaning"]'],
  laundry: ['nwr["shop"~"^(laundry|dry_cleaning)$"]'],
  carpenter: ['nwr["craft"~"^(carpenter|cabinet_maker)$"]'],
  plumber: ['nwr["craft"="plumber"]'],
  electrician: ['nwr["craft"="electrician"]'],
  locksmith: ['nwr["craft"="locksmith"]', 'nwr["shop"="locksmith"]'],
  painter: ['nwr["craft"="painter"]'],
  appliance_repair: ['nwr["craft"~"^(electronics_repair|appliance_repair|hvac)$"]'],
  gardening: ['nwr["craft"="gardener"]', 'nwr["shop"="garden_centre"]'],
  hardware: ['nwr["shop"~"^(hardware|doityourself|paint)$"]'],
  mechanic: ['nwr["shop"~"^(car_repair|tyres|motorcycle_repair)$"]'],
  veterinary: ['nwr["amenity"="veterinary"]'],
  taxi: ['nwr["amenity"="taxi"]'],
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
  if (tags.amenity === 'hospital') return 'hospital'
  if (tags.amenity === 'police') return 'police'
  if (tags.amenity === 'fire_station') return 'fire_station'
  if (tags.amenity === 'taxi') return 'taxi'
  if (tags.amenity === 'veterinary') return 'veterinary'
  if (tags.craft === 'cleaning' || tags.shop === 'cleaning' || tags.office === 'cleaning')
    return 'cleaning'
  if (tags.shop === 'laundry' || tags.shop === 'dry_cleaning') return 'laundry'
  if (tags.craft === 'carpenter' || tags.craft === 'cabinet_maker') return 'carpenter'
  if (tags.craft === 'plumber') return 'plumber'
  if (tags.craft === 'electrician') return 'electrician'
  if (tags.craft === 'locksmith' || tags.shop === 'locksmith') return 'locksmith'
  if (tags.craft === 'painter') return 'painter'
  if (['electronics_repair', 'appliance_repair', 'hvac'].includes(tags.craft)) return 'appliance_repair'
  if (tags.craft === 'gardener' || tags.shop === 'garden_centre') return 'gardening'
  if (['hardware', 'doityourself', 'paint'].includes(tags.shop)) return 'hardware'
  if (['car_repair', 'tyres', 'motorcycle_repair'].includes(tags.shop)) return 'mechanic'
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'mall'
  if (tags.shop === 'supermarket' || tags.shop === 'convenience') return 'supermarket'
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'restaurant'
  if (tags.amenity === 'cafe' || tags.shop === 'bakery') return 'cafe'
  if (tags.amenity === 'pharmacy' || tags.shop === 'chemist') return 'pharmacy'
  if (['clinic', 'doctors', 'dentist'].includes(tags.amenity)) return 'health'
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

/** Primer telefono util de las etiquetas de OSM (pueden traer varios con ';'). */
function pickPhone(tags: Record<string, string>): string | null {
  const raw =
    tags.phone ??
    tags['contact:phone'] ??
    tags['contact:mobile'] ??
    tags.mobile ??
    tags['contact:whatsapp']
  const first = raw?.split(/[;,]/)[0]?.trim()
  return first ? first.slice(0, 60) : null
}

function pickWebsite(tags: Record<string, string>): string | null {
  const raw = tags.website ?? tags['contact:website']
  return raw && /^https?:\/\//i.test(raw) ? raw.slice(0, 300) : null
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
    const name = tags.name ?? (category ? UNNAMED_EMERGENCY[category] : undefined)
    if (!category || lat === undefined || lon === undefined || !name) continue
    const distance = distanceInMeters(center, { lat, lon })
    if (distance > radius) continue
    places.push({
      id,
      name,
      category,
      lat,
      lon,
      distance,
      address: buildAddress(tags),
      phone: pickPhone(tags),
      website: pickWebsite(tags),
    })
  }
  return places.sort((a, b) => a.distance - b.distance)
}

/** Radio con el que se guardan los lugares; la vista filtra radios menores. */
export const NEARBY_FETCH_RADIUS = 2000
/** Cada cuanto se refrescan los lugares guardados. */
const PLACES_MAX_AGE_DAYS = 7
/**
 * Lugares guardados antes de esta fecha no traen las categorias de emergencia
 * y servicios (ni telefonos): se vuelven a consultar aunque no tengan 7 dias.
 */
const PLACES_CATALOG_SINCE = Date.parse('2026-10-19T00:00:00Z')

/** true si los lugares guardados hay que volver a consultarlos. */
export function placesAreStale(updatedAt: string | null, now = Date.now()): boolean {
  if (!updatedAt) return true
  const time = Date.parse(updatedAt)
  return time < PLACES_CATALOG_SINCE || now - time >= PLACES_MAX_AGE_DAYS * 86_400_000
}

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
      .select('osm_id, name, category, latitude, longitude, distance_m, address, phone, website')
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
        phone: row.phone,
        website: row.website,
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
        phone: place.phone,
        website: place.website,
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
    // Los lugares de emergencia se aceptan sin nombre (reciben uno generico).
    const groups = (Object.keys(OVERPASS_SELECTORS) as PlaceCategory[]).map((category) => {
      const nameFilter = UNNAMED_EMERGENCY[category] ? '' : '["name"]'
      const union = OVERPASS_SELECTORS[category]
        .map((selector) => `${selector}${nameFilter}${bbox};`)
        .join('')
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

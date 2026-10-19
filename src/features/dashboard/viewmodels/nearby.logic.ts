/**
 * Ficha de informacion de un lugar del mapa (sin React): textos y enlaces
 * para llamar, escribir por WhatsApp, llegar y visitar su sitio web.
 */
import { PLACE_CATEGORIES, type NearbyPlace } from '@/services/placesService'
import { directionsHref, formatPhone, telHref, whatsappHref } from '@/utils/phone'

const DAYS: Record<string, string> = {
  Mo: 'Lun',
  Tu: 'Mar',
  We: 'Mie',
  Th: 'Jue',
  Fr: 'Vie',
  Sa: 'Sab',
  Su: 'Dom',
  PH: 'Festivos',
}

/** "Mo-Fr 08:00-18:00; Sa 09:00-13:00" -> "Lun-Vie 08:00-18:00 · Sab 09:00-13:00". */
export function formatOpeningHours(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  if (raw.trim() === '24/7') return 'Abierto 24 horas'
  return raw
    .split(';')
    .map((part) =>
      part
        .trim()
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (day) => DAYS[day])
        .replace(/\boff\b/gi, 'cerrado'),
    )
    .filter(Boolean)
    .join(' · ')
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

export interface PlaceInfo {
  id: string
  name: string
  category: string
  color: string
  distance: string
  address: string | null
  hours: string | null
  phoneLabel: string | null
  callHref: string | null
  whatsappHref: string | null
  directionsHref: string
  website: string | null
  /** true si no hay ningun numero: se sugiere buscarlo o pedirlo a la administracion. */
  noContact: boolean
}

export function toPlaceInfo(place: NearbyPlace): PlaceInfo {
  const meta = PLACE_CATEGORIES[place.category]
  const call = telHref(place.phone)
  const whatsapp = whatsappHref(place.whatsapp ?? place.phone, `Hola, te encontre en EdiFeasy.`)
  return {
    id: place.id,
    name: place.name,
    category: meta.label,
    color: meta.hex,
    distance: formatDistance(place.distance),
    address: place.address,
    hours: formatOpeningHours(place.openingHours),
    phoneLabel: place.phone ? formatPhone(place.phone) : null,
    callHref: call,
    whatsappHref: whatsapp,
    directionsHref: directionsHref(place),
    website: place.website,
    noContact: !call && !whatsapp && !place.website,
  }
}

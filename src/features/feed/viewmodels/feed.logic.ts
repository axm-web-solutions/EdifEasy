/**
 * Reglas puras del feed y de la tarjeta de emergencias (sin React).
 */
import type { CommunityContactRow } from '@/types/database'
import type { FeedPost } from '@/types/models'
import { PLACE_CATEGORIES, type NearbyPlace, type PlaceCategory } from '@/services/placesService'
import { directoryCategoryLabel } from '@/constants/directory'
import { directionsHref, formatPhone, telHref, whatsappHref } from '@/utils/phone'

/** Grupos destinatarios por rol, en plural como se leen en el feed. */
const ROLE_AUDIENCE: Record<string, string> = {
  ADMINISTRATOR: 'Administracion',
  SPOKESPERSON: 'Voceros',
  OWNER: 'Propietarios',
  TENANT: 'Arrendatarios',
  SECURITY: 'Seguridad',
  SERVICE_STAFF: 'Personal de servicio',
}

export function audienceLabel(post: Pick<FeedPost, 'audience' | 'building' | 'audience_role'>): string {
  switch (post.audience) {
    case 'BUILDING':
      return post.building?.name ?? 'Un bloque'
    case 'ROLE':
      return post.audience_role
        ? (ROLE_AUDIENCE[post.audience_role.code] ?? post.audience_role.name)
        : 'Un grupo'
    case 'APARTMENT':
      return 'Tu apartamento'
    default:
      return 'Todo el conjunto'
  }
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export interface FeedPostView {
  id: string
  title: string
  content: string
  imageUrl: string | null
  authorName: string
  authorInitials: string
  publishedAt: string
  audience: string
  /** true si el destino es todo el conjunto (se muestra discreto). */
  audienceIsEveryone: boolean
  pinned: boolean
}

export function toPostView(post: FeedPost): FeedPostView {
  const authorName = post.author?.full_name ?? 'Administracion'
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    imageUrl: post.image_url,
    authorName,
    authorInitials: initials(authorName),
    publishedAt: post.published_at,
    audience: audienceLabel(post),
    audienceIsEveryone: post.audience === 'CONDOMINIUM',
    pinned: post.pinned,
  }
}

// ---------------------------------------------------------------------------
// Emergencias
// ---------------------------------------------------------------------------

export interface EmergencyContactView {
  id: string
  name: string
  detail: string
  phoneLabel: string
  callHref: string | null
  whatsappHref: string | null
  directionsHref: string | null
}

/** Numeros que agrego la administracion (cuadrante, porteria...). */
export function toEmergencyContacts(contacts: CommunityContactRow[]): EmergencyContactView[] {
  return contacts
    .filter((contact) => contact.kind === 'EMERGENCY' && contact.is_active)
    .map((contact) => {
      const phone = contact.phone ?? contact.whatsapp
      return {
        id: contact.id,
        name: contact.name,
        detail: contact.description || directoryCategoryLabel('EMERGENCY', contact.category),
        phoneLabel: formatPhone(phone),
        callHref: telHref(phone),
        whatsappHref: whatsappHref(contact.whatsapp),
        directionsHref: null,
      }
    })
}

const EMERGENCY_PLACE_ORDER: PlaceCategory[] = ['police', 'hospital', 'fire_station']

/**
 * Lugares de emergencia mas cercanos del mapa: hasta `perCategory` por tipo,
 * en orden policia, hospitales, bomberos. Los de OSM rara vez traen telefono;
 * en ese caso se ofrece "como llegar".
 */
export function nearestEmergencyPlaces(
  places: NearbyPlace[],
  perCategory = 2,
): EmergencyContactView[] {
  return EMERGENCY_PLACE_ORDER.flatMap((category) =>
    places
      .filter((place) => place.category === category)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, perCategory)
      .map((place) => ({
        id: place.id,
        name: place.name,
        detail: `${PLACE_CATEGORIES[category].label} · ${formatDistance(place.distance)}`,
        phoneLabel: formatPhone(place.phone),
        callHref: telHref(place.phone),
        whatsappHref: null,
        directionsHref: directionsHref(place),
      })),
  )
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`
}

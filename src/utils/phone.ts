/**
 * Telefonos de Colombia: enlaces para llamar, escribir por WhatsApp y mostrar.
 * Funciones puras (sin React), usadas por el feed y el marketplace.
 */

/** Solo digitos, conservando un `+` inicial y los `#`/`*` de lineas cortas (#767). */
function cleanDial(phone: string): string {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/[^\d#*]/g, '')
}

/** Enlace `tel:` que funciona en celulares; null si no hay numero. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const dial = cleanDial(phone)
  if (!dial.replace(/\D/g, '')) return null
  return `tel:${dial.replace(/#/g, '%23')}`
}

/**
 * Numero en formato internacional para WhatsApp (sin `+`). Un celular
 * colombiano de 10 digitos (3xx) recibe el indicativo 57. Los fijos y numeros
 * cortos no tienen WhatsApp.
 */
function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (/^3\d{9}$/.test(digits)) return `57${digits}`
  if (/^573\d{9}$/.test(digits)) return digits
  // Otro pais escrito con +: se respeta.
  if (phone.trim().startsWith('+') && digits.length >= 10 && !digits.startsWith('57')) return digits
  return null
}

export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null
  const number = whatsappNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Formato legible: 310 434 4995 · 606 745 1234 · +57 310 434 4995. Lo demas, tal cual. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits
  if (local.length === 10) {
    const formatted = `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    return local === digits ? formatted : `+57 ${formatted}`
  }
  return phone.trim()
}

/** Enlace para pedir un Uber con recogida en el conjunto. */
export function uberPickupHref(point: { lat: number; lon: number }, nickname: string): string {
  const params = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': point.lat.toFixed(6),
    'pickup[longitude]': point.lon.toFixed(6),
    'pickup[nickname]': nickname,
  })
  return `https://m.uber.com/ul/?${params.toString()}`
}

/** Como llegar en Google Maps. */
export function directionsHref(point: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`
}

import type { PropertyOperation, PropertyType } from '@/types/database'

/**
 * Textos de la tienda publica de las inmobiliarias en espanol e ingles.
 * Solo datos: la logica que los usa vive en agency.logic.ts y en los ViewModels.
 */
export type StoreLang = 'es' | 'en'

export const STORE_LANGS: { value: StoreLang; label: string; short: string }[] = [
  { value: 'es', label: 'Espanol', short: 'ES' },
  { value: 'en', label: 'English', short: 'EN' },
]

export const STORE_LANG_KEY = 'edifeasy.store.lang'

/** Idioma inicial: ?lang= en la URL, luego el guardado, luego el del navegador. */
export function resolveStoreLang(
  param: string | null | undefined,
  stored: string | null | undefined,
  browser: string | null | undefined,
): StoreLang {
  for (const value of [param, stored]) {
    if (value === 'es' || value === 'en') return value
  }
  return browser?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

/** Texto en el idioma pedido; si no hay traduccion, el espanol. */
export function localized(
  lang: StoreLang,
  es: string | null | undefined,
  en: string | null | undefined,
): string | null {
  const english = en?.trim()
  if (lang === 'en' && english) return english
  return es?.trim() || null
}

export const TYPE_LABELS: Record<StoreLang, Record<PropertyType, string>> = {
  es: {
    APARTAMENTO: 'Apartamento',
    CASA: 'Casa',
    APARTAESTUDIO: 'Apartaestudio',
    LOCAL: 'Local',
    OFICINA: 'Oficina',
    BODEGA: 'Bodega',
    LOTE: 'Lote',
    FINCA: 'Finca',
    OTRO: 'Otro',
  },
  en: {
    APARTAMENTO: 'Apartment',
    CASA: 'House',
    APARTAESTUDIO: 'Studio apartment',
    LOCAL: 'Retail space',
    OFICINA: 'Office',
    BODEGA: 'Warehouse',
    LOTE: 'Land lot',
    FINCA: 'Country estate',
    OTRO: 'Other',
  },
}

export const OPERATION_LABELS: Record<StoreLang, Record<PropertyOperation, string>> = {
  es: { RENT: 'Arriendo', SALE: 'Venta', BOTH: 'Arriendo y venta' },
  en: { RENT: 'For rent', SALE: 'For sale', BOTH: 'For rent or sale' },
}

export const CATEGORY_LABELS: Record<StoreLang, Record<PropertyType | 'ALL', string>> = {
  es: {
    ALL: 'Todo',
    APARTAMENTO: 'Apartamentos',
    CASA: 'Casas',
    APARTAESTUDIO: 'Apartaestudios',
    LOCAL: 'Locales',
    OFICINA: 'Oficinas',
    BODEGA: 'Bodegas',
    LOTE: 'Lotes',
    FINCA: 'Fincas',
    OTRO: 'Otros',
  },
  en: {
    ALL: 'All',
    APARTAMENTO: 'Apartments',
    CASA: 'Houses',
    APARTAESTUDIO: 'Studios',
    LOCAL: 'Retail',
    OFICINA: 'Offices',
    BODEGA: 'Warehouses',
    LOTE: 'Land',
    FINCA: 'Estates',
    OTRO: 'Other',
  },
}

/** Frases de precio y ficha que cambian con el idioma. */
export const PRICE_TEXT: Record<
  StoreLang,
  {
    perMonth: string
    admin: string
    sale: string
    rentOnRequest: string
    priceOnRequest: string
    bedrooms: (n: number) => string
    bathrooms: (n: number) => string
    parking: (n: number) => string
    stratum: (n: number) => string
    floor: (n: number) => string
    noLocation: string
    marker: { million: string; thousand: string; see: string }
    inquiry: (title: string, code: string | null, url: string) => string
  }
> = {
  es: {
    perMonth: '/ mes',
    admin: 'Adm.',
    sale: 'Venta',
    rentOnRequest: 'Canon a convenir',
    priceOnRequest: 'Precio a convenir',
    bedrooms: (n) => `${n} hab.`,
    bathrooms: (n) => `${n} ${n === 1 ? 'bano' : 'banos'}`,
    parking: (n) => `${n} parq.`,
    stratum: (n) => `Estrato ${n}`,
    floor: (n) => `Piso ${n}`,
    noLocation: 'Ubicacion por confirmar',
    marker: { million: 'M', thousand: 'mil', see: 'Ver' },
    inquiry: (title, code, url) =>
      `Hola, me interesa la propiedad "${title}"${code ? ` (ref. ${code})` : ''}: ${url}`,
  },
  en: {
    perMonth: '/ month',
    admin: 'HOA fee',
    sale: 'Sale',
    rentOnRequest: 'Rent upon request',
    priceOnRequest: 'Price upon request',
    bedrooms: (n) => `${n} ${n === 1 ? 'bed' : 'beds'}`,
    bathrooms: (n) => `${n} ${n === 1 ? 'bath' : 'baths'}`,
    parking: (n) => `${n} parking`,
    stratum: (n) => `Stratum ${n}`,
    floor: (n) => `Floor ${n}`,
    noLocation: 'Location to be confirmed',
    marker: { million: 'M', thousand: 'K', see: 'View' },
    inquiry: (title, code, url) =>
      `Hi, I'm interested in the property "${title}"${code ? ` (ref. ${code})` : ''}: ${url}`,
  },
}

/** Amenidades frecuentes; las que no esten aqui se muestran como las escribio la inmobiliaria. */
const AMENITIES_EN: Record<string, string> = {
  amoblado: 'Furnished',
  'admite mascotas': 'Pets allowed',
  balcon: 'Balcony',
  terraza: 'Terrace',
  'terraza comunal': 'Shared terrace',
  gimnasio: 'Gym',
  piscina: 'Swimming pool',
  jacuzzi: 'Hot tub',
  sauna: 'Sauna',
  'turco': 'Steam room',
  bbq: 'BBQ area',
  kiosco: 'Gazebo',
  jardin: 'Garden',
  patio: 'Patio',
  chimenea: 'Fireplace',
  'porteria 24 h': '24/7 doorman',
  'vigilancia 24 h': '24/7 security',
  'conjunto cerrado': 'Gated community',
  ascensor: 'Elevator',
  deposito: 'Storage unit',
  'cuarto util': 'Storage unit',
  'parque infantil': 'Playground',
  'salon comunal': 'Community room',
  'zona de ropas': 'Laundry area',
  'cocina integral': 'Fitted kitchen',
  'cocina abierta': 'Open kitchen',
  'vista exterior': 'Exterior view',
  esquinero: 'Corner unit',
  'alto trafico': 'High foot traffic',
  'sala de juntas': 'Meeting room',
  recepcion: 'Reception',
  'muelle de carga': 'Loading dock',
  'planta electrica': 'Backup generator',
  'cancha': 'Sports court',
  'zonas verdes': 'Green areas',
  'parqueadero de visitantes': 'Visitor parking',
}

const plain = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

export function amenityLabel(value: string, lang: StoreLang): string {
  if (lang === 'es') return value
  const key = plain(value)
  if (AMENITIES_EN[key]) return AMENITIES_EN[key]
  const height = /^altura (\d+(?:[.,]\d+)?) ?m$/.exec(key)
  if (height) return `${height[1].replace(',', '.')} m ceiling height`
  return value
}

/** Textos de la interfaz de la tienda. */
export const STORE_TEXT = {
  es: {
    language: 'Idioma',
    writeUs: 'Escribenos',
    defaultTagline: (name: string) => `Encuentra tu proximo hogar con ${name}`,
    documentTitle: (name: string) => `${name} | Propiedades en arriendo y venta`,
    whatsappHello: (name: string) => `Hola ${name}, vi su tienda y quiero informacion.`,
    allOperations: 'Todas',
    rent: 'Arriendo',
    sale: 'Venta',
    city: 'Ciudad',
    anyCity: 'Cualquier ciudad',
    searchPlaceholder: 'Barrio, zona o palabra clave',
    search: 'Buscar',
    categories: 'Categorias',
    reserved: 'Reservada',
    count: (n: number) => `${n} ${n === 1 ? 'propiedad' : 'propiedades'}`,
    bedrooms: 'Habitaciones',
    bedroomsAtLeast: (n: number) => `${n} o mas`,
    clear: 'Limpiar',
    noMatch: 'Nada coincide con tu busqueda',
    comingSoon: 'Pronto publicaremos propiedades',
    seeAll: 'Ver todas',
    showMap: 'Mostrar mapa',
    showList: 'Mostrar lista',
    mapLabel: 'Mapa de propiedades',
    notFoundTitle: 'Tienda no disponible',
    errorTitle: 'No pudimos cargar la tienda',
    notFoundHint: 'Revisa el enlace o escribe a la inmobiliaria.',
    ctaTitle: '¿No encuentras lo que buscas?',
    ctaText: 'Cuentanos que necesitas y te ayudamos a encontrarlo.',
    call: 'Llamar',
    email: 'Correo',
    madeWith: 'Tienda creada con',
    privacy: 'Tratamiento de datos',
    back: 'Volver',
    propertyGone: 'Esta propiedad ya no esta disponible',
    seeOthers: 'Ver otras propiedades',
    ref: 'Ref.',
    about: 'Acerca de esta propiedad',
    features: 'Lo que ofrece',
    where: 'Donde queda',
    approximate: 'Ubicacion aproximada: la direccion exacta te la damos al agendar la visita.',
    askWhatsapp: 'Preguntar por WhatsApp',
    leaveData: 'Dejanos tus datos',
    similar: 'Tambien te puede interesar',
    seePhotos: (n: number) => `Ver las ${n} fotos`,
    photo: (n: number) => `Ver foto ${n}`,
    photoOf: (i: number, n: number) => `${i} de ${n}`,
    prevPhoto: 'Foto anterior',
    nextPhoto: 'Foto siguiente',
    sent: '¡Listo! La inmobiliaria te contactara pronto.',
    name: 'Nombre',
    phone: 'Telefono',
    message: 'Mensaje',
    messagePlaceholder: 'Quiero agendar una visita...',
    consentBefore:
      'Autorizo a la inmobiliaria a tratar mis datos para contactarme sobre esta propiedad, segun la',
    consentLink: 'politica de tratamiento de datos',
    submit: 'Quiero que me contacten',
    sendError: null as string | null,
    validation: {
      name: 'Escribe tu nombre',
      phone: 'Escribe un telefono valido',
      consent: 'Debes autorizar el tratamiento de tus datos',
    },
  },
  en: {
    language: 'Language',
    writeUs: 'Message us',
    defaultTagline: (name: string) => `Find your next home with ${name}`,
    documentTitle: (name: string) => `${name} | Properties for rent and sale`,
    whatsappHello: (name: string) =>
      `Hi ${name}, I saw your listings and would like more information.`,
    allOperations: 'All',
    rent: 'Rent',
    sale: 'Buy',
    city: 'City',
    anyCity: 'Any city',
    searchPlaceholder: 'Neighborhood, area or keyword',
    search: 'Search',
    categories: 'Categories',
    reserved: 'Under offer',
    count: (n: number) => `${n} ${n === 1 ? 'property' : 'properties'}`,
    bedrooms: 'Bedrooms',
    bedroomsAtLeast: (n: number) => `${n}+`,
    clear: 'Clear',
    noMatch: 'Nothing matches your search',
    comingSoon: 'New listings coming soon',
    seeAll: 'See all',
    showMap: 'Show map',
    showList: 'Show list',
    mapLabel: 'Property map',
    notFoundTitle: 'Store not available',
    errorTitle: 'We could not load this store',
    notFoundHint: 'Check the link or contact the agency.',
    ctaTitle: "Can't find what you're looking for?",
    ctaText: 'Tell us what you need and we will help you find it.',
    call: 'Call',
    email: 'Email',
    madeWith: 'Store powered by',
    privacy: 'Privacy policy',
    back: 'Back',
    propertyGone: 'This property is no longer available',
    seeOthers: 'See other properties',
    ref: 'Ref.',
    about: 'About this property',
    features: 'What this place offers',
    where: 'Where it is',
    approximate:
      'Approximate location: we share the exact address when you schedule a viewing.',
    askWhatsapp: 'Ask on WhatsApp',
    leaveData: 'Leave us your details',
    similar: 'You may also like',
    seePhotos: (n: number) => `Show all ${n} photos`,
    photo: (n: number) => `Open photo ${n}`,
    photoOf: (i: number, n: number) => `${i} of ${n}`,
    prevPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    sent: 'Done! The agency will contact you soon.',
    name: 'Name',
    phone: 'Phone',
    message: 'Message',
    messagePlaceholder: "I'd like to schedule a viewing...",
    consentBefore:
      'I authorize the agency to process my personal data to contact me about this property, under its',
    consentLink: 'privacy policy',
    submit: 'Contact me',
    sendError: 'We could not send your details. Please try again or contact the agency.' as
      | string
      | null,
    validation: {
      name: 'Enter your name',
      phone: 'Enter a valid phone number',
      consent: 'You must authorize the processing of your data',
    },
  },
} satisfies Record<StoreLang, unknown>

export type StoreText = (typeof STORE_TEXT)['es']

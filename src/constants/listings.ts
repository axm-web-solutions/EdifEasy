import type { ListingCategory, ListingPriceType, ListingStatus } from '@/types/database'

/** Categorias de los clasificados (son los filtros del marketplace). */
export const LISTING_CATEGORIES: Record<
  ListingCategory,
  { label: string; hex: string; hint: string }
> = {
  PRODUCTS: {
    label: 'Articulos en venta',
    hex: '#2563eb',
    hint: 'Muebles, electrodomesticos, bicicletas...',
  },
  PROPERTY_RENT: {
    label: 'Arriendos',
    hex: '#0d9488',
    hint: 'Casas, apartamentos, habitaciones, parqueaderos',
  },
  PROPERTY_SALE: {
    label: 'Venta de inmuebles',
    hex: '#7c3aed',
    hint: 'Casas y apartamentos en venta',
  },
  FOOD: { label: 'Comida', hex: '#ea580c', hint: 'Postres, almuerzos, panaderia, pedidos' },
  ACCESSORIES: {
    label: 'Accesorios',
    hex: '#db2777',
    hint: 'Ropa, joyeria, celulares, decoracion',
  },
  CLASSES: { label: 'Clases', hex: '#ca8a04', hint: 'Tareas, idiomas, musica, deporte' },
  SERVICES: {
    label: 'Servicios',
    hex: '#475569',
    hint: 'Lo que ofrecen los vecinos: belleza, mascotas...',
  },
  OTHER: { label: 'Otros', hex: '#64748b', hint: 'Lo demas' },
}

export const LISTING_PRICE_TYPES: Record<ListingPriceType, { label: string; suffix: string }> = {
  FIXED: { label: 'Precio fijo', suffix: '' },
  NEGOTIABLE: { label: 'Negociable', suffix: ' (negociable)' },
  FREE: { label: 'Gratis / regalo', suffix: '' },
  PER_HOUR: { label: 'Por hora', suffix: ' / hora' },
  PER_MONTH: { label: 'Mensual', suffix: ' / mes' },
  PER_UNIT: { label: 'Por unidad', suffix: ' c/u' },
}

export const LISTING_STATUS: Record<ListingStatus, { label: string; color: string }> = {
  PENDING: { label: 'Por aprobar', color: 'gold' },
  APPROVED: { label: 'Publicada', color: 'green' },
  REJECTED: { label: 'No aprobada', color: 'red' },
  SOLD: { label: 'Vendida', color: 'blue' },
  ARCHIVED: { label: 'Archivada', color: 'default' },
}

/** Categorias con estado nuevo/usado. */
export const CATEGORIES_WITH_CONDITION: ListingCategory[] = ['PRODUCTS', 'ACCESSORIES']
/** Categorias de inmuebles (habitaciones, banos, area, parqueadero). */
export const PROPERTY_CATEGORIES: ListingCategory[] = ['PROPERTY_RENT', 'PROPERTY_SALE']

export const MAX_LISTING_IMAGES = 6

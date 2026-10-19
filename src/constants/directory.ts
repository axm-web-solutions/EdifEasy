import type { CommunityContactKind } from '@/types/database'

/**
 * Numeros de emergencia nacionales de Colombia. El 123 integra policia,
 * ambulancias y bomberos en las ciudades principales; los demas son lineas
 * especializadas que funcionan en todo el pais.
 */
export interface EmergencyLine {
  number: string
  label: string
  description: string
  tone: 'general' | 'police' | 'medical' | 'fire' | 'other'
}

export const NATIONAL_EMERGENCY_LINES: EmergencyLine[] = [
  {
    number: '123',
    label: 'Linea unica de emergencias',
    description: 'Policia, ambulancias y bomberos',
    tone: 'general',
  },
  { number: '112', label: 'Policia Nacional', description: 'Desde celular', tone: 'police' },
  { number: '119', label: 'Bomberos', description: 'Incendios y rescates', tone: 'fire' },
  { number: '132', label: 'Cruz Roja', description: 'Ambulancias y primeros auxilios', tone: 'medical' },
  { number: '144', label: 'Defensa Civil', description: 'Desastres y emergencias', tone: 'other' },
  { number: '#767', label: 'Transito', description: 'Accidentes de transito', tone: 'other' },
  { number: '155', label: 'Linea de la mujer', description: 'Violencia contra la mujer', tone: 'other' },
  { number: '141', label: 'ICBF', description: 'Proteccion de ninos y adolescentes', tone: 'other' },
  { number: '165', label: 'GAULA', description: 'Secuestro y extorsion', tone: 'police' },
]

export interface DirectoryCategory {
  value: string
  label: string
}

/** Categorias que la administracion asigna a sus numeros de emergencia. */
const EMERGENCY_CONTACT_CATEGORIES: DirectoryCategory[] = [
  { value: 'police', label: 'Cuadrante de policia' },
  { value: 'security', label: 'Porteria y vigilancia' },
  { value: 'medical', label: 'Ambulancia y salud' },
  { value: 'fire', label: 'Bomberos' },
  { value: 'utilities', label: 'Gas, luz y agua' },
  { value: 'administration', label: 'Administracion' },
  { value: 'other', label: 'Otro' },
]

/**
 * Categorias de los servicios recomendados (marketplace). Las primeras
 * coinciden con las de OpenStreetMap para mostrarlos juntos.
 */
export const SERVICE_CONTACT_CATEGORIES: DirectoryCategory[] = [
  { value: 'cleaning', label: 'Aseo y limpieza' },
  { value: 'carpenter', label: 'Carpinteros' },
  { value: 'plumber', label: 'Plomeros' },
  { value: 'electrician', label: 'Electricistas' },
  { value: 'locksmith', label: 'Cerrajeros' },
  { value: 'hardware', label: 'Ferreterias' },
  { value: 'laundry', label: 'Lavanderias' },
  { value: 'taxi', label: 'Taxis y transporte' },
  { value: 'restaurant', label: 'Restaurantes y domicilios' },
  { value: 'pharmacy', label: 'Droguerias' },
  { value: 'supermarket', label: 'Supermercados' },
  { value: 'mechanic', label: 'Talleres' },
  { value: 'veterinary', label: 'Veterinarias' },
  { value: 'moving', label: 'Mudanzas' },
  { value: 'gardening', label: 'Jardineria' },
  { value: 'other', label: 'Otros servicios' },
]

export function directoryCategories(kind: CommunityContactKind): DirectoryCategory[] {
  return kind === 'EMERGENCY' ? EMERGENCY_CONTACT_CATEGORIES : SERVICE_CONTACT_CATEGORIES
}

export function directoryCategoryLabel(kind: CommunityContactKind, value: string): string {
  return directoryCategories(kind).find((category) => category.value === value)?.label ?? value
}

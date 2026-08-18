import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))

export const condominiumSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(150),
  nit: optionalText(30),
  address: optionalText(200),
  city: optionalText(80),
  country: z.string().max(80).default('Colombia'),
  phone: optionalText(30),
  email: z.string().email('Correo invalido').optional().or(z.literal('')),
  logo_url: z.string().url('URL invalida').optional().or(z.literal('')),
  description: optionalText(1000),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
})

export const buildingSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  number: z.string().min(1, 'El numero o identificador es obligatorio').max(20),
  description: optionalText(500),
  floors: z.coerce.number().int().min(1, 'Minimo 1 piso').max(100).default(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const apartmentSchema = z.object({
  building_id: z.string().uuid('Selecciona un bloque'),
  number: z.string().min(1, 'El numero es obligatorio').max(20),
  floor: z.coerce.number().int().min(0).max(100).default(1),
  area: z.coerce.number().min(0).max(10000).optional().nullable(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).max(20).optional().nullable(),
  parking_spots: z.coerce.number().int().min(0).max(20).default(0),
  coefficient: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(['OCCUPIED', 'VACANT', 'MAINTENANCE', 'INACTIVE']).default('VACANT'),
  description: optionalText(500),
})

export type CondominiumFormValues = z.infer<typeof condominiumSchema>
export type BuildingFormValues = z.infer<typeof buildingSchema>
export type ApartmentFormValues = z.infer<typeof apartmentSchema>

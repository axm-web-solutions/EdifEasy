import { z } from 'zod'

const money = z.number().min(0, 'No puede ser negativo').max(100_000_000_000).nullable()
const count = z.number().int().min(0).max(50).nullable()

export const propertySchema = z
  .object({
    title: z.string().trim().min(3, 'Escribe un titulo').max(140),
    code: z.string().trim().max(30),
    property_type: z.enum([
      'CASA',
      'APARTAMENTO',
      'APARTAESTUDIO',
      'LOCAL',
      'OFICINA',
      'BODEGA',
      'LOTE',
      'FINCA',
      'OTRO',
    ]),
    operation: z.enum(['RENT', 'SALE', 'BOTH']),
    status: z.enum(['AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'INACTIVE']),
    rent_price: money,
    admin_fee: money,
    sale_price: money,
    address: z.string().trim().max(200),
    neighborhood: z.string().trim().max(100),
    city: z.string().trim().max(100),
    stratum: z.number().int().min(1).max(6).nullable(),
    area_m2: z.number().min(0).max(1_000_000).nullable(),
    bedrooms: count,
    bathrooms: count,
    parking: count,
    floor: z.number().int().min(-5).max(200).nullable(),
    furnished: z.boolean(),
    pets_allowed: z.boolean(),
    description: z.string().trim().max(5000),
    images: z.array(z.string().url()).max(15),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    owner_profile_id: z.string().nullable(),
    owner_name: z.string().trim().max(140),
    owner_phone: z.string().trim().max(30),
    is_published: z.boolean(),
  })
  .refine((v) => v.operation === 'SALE' || (v.rent_price ?? 0) > 0, {
    path: ['rent_price'],
    message: 'Escribe el canon',
  })
  .refine((v) => v.operation === 'RENT' || (v.sale_price ?? 0) > 0, {
    path: ['sale_price'],
    message: 'Escribe el precio de venta',
  })

export type PropertyFormValues = z.infer<typeof propertySchema>

export const leaseSchema = z
  .object({
    property_id: z.string().min(1, 'Elige la propiedad'),
    tenant_profile_id: z.string().nullable(),
    tenant_name: z.string().trim().min(3, 'Escribe el nombre del arrendatario').max(140),
    tenant_document: z.string().trim().max(30),
    tenant_email: z.string().trim().max(140),
    tenant_phone: z.string().trim().max(30),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha de inicio'),
    end_date: z.string().nullable(),
    monthly_rent: z.number().positive('Escribe el canon'),
    admin_fee: z.number().min(0),
    due_day: z.number().int().min(1).max(28),
    deposit: z.number().min(0).nullable(),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'Debe ser despues del inicio',
  })

export type LeaseFormValues = z.infer<typeof leaseSchema>

export const storeSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo letras minusculas, numeros y guiones')
    .min(3, 'Minimo 3 caracteres')
    .max(60),
  description: z.string().trim().max(1000),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(140),
  whatsapp: z.string().trim().max(20),
  hero_image: z.string().trim().max(500),
  hero_video: z.string().trim().max(500),
  tagline: z.string().trim().max(120),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hex, ej. #365959'),
})

export type StoreFormValues = z.infer<typeof storeSchema>

export const wompiAccountSchema = z.object({
  public_key: z
    .string()
    .trim()
    .regex(/^pub_(test|prod)_[A-Za-z0-9]+$/, 'Empieza por pub_test_ o pub_prod_'),
  integrity_secret: z
    .string()
    .trim()
    .regex(/^(test|prod)_integrity_/, 'Empieza por test_integrity_ o prod_integrity_'),
  events_secret: z
    .string()
    .trim()
    .regex(/^(test|prod)_events_/, 'Empieza por test_events_ o prod_events_'),
})

export type WompiAccountFormValues = z.infer<typeof wompiAccountSchema>

export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, '').length >= 7, 'Escribe un telefono valido'),
  email: z.string().trim().max(140),
  message: z.string().trim().max(1000),
  consent: z.boolean().refine((value) => value, 'Debes autorizar el tratamiento de tus datos'),
})

export type LeadFormValues = z.infer<typeof leadSchema>

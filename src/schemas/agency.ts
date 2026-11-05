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
    title_en: z.string().trim().max(140),
    description_en: z.string().trim().max(5000),
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
    lease_use: z.enum(['VIVIENDA', 'COMERCIAL']),
    term_months: z.number().int().min(1, 'Minimo 1 mes').max(120),
    auto_renew: z.boolean(),
    notice_months: z.number().int().min(1).max(12),
    increase_rule: z.enum(['IPC', 'IPC_PLUS', 'FIXED']),
    increase_points: z.number().min(0).max(50),
    late_interest_pct: z.number().min(0).max(5, 'Maximo 5 % mensual').nullable(),
    insurer: z.string().trim().max(120),
    policy_number: z.string().trim().max(60),
    policy_expires_at: z.string().nullable(),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'Debe ser despues del inicio',
  })
  .refine((v) => v.lease_use === 'COMERCIAL' || !v.deposit, {
    path: ['deposit'],
    message: 'En vivienda no se puede pedir deposito (Ley 820, art. 16)',
  })
  .refine((v) => v.lease_use === 'COMERCIAL' || v.increase_rule === 'IPC', {
    path: ['increase_rule'],
    message: 'En vivienda el incremento es hasta el IPC',
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
  tagline_en: z.string().trim().max(120),
  description_en: z.string().trim().max(1000),
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

/** Formulario de interesados de la tienda; los mensajes llegan en el idioma de la tienda. */
export function makeLeadSchema(
  messages: { name: string; phone: string; consent: string } = {
    name: 'Escribe tu nombre',
    phone: 'Escribe un telefono valido',
    consent: 'Debes autorizar el tratamiento de tus datos',
  },
) {
  return z.object({
    name: z.string().trim().min(2, messages.name).max(120),
    phone: z
      .string()
      .trim()
      .refine((value) => value.replace(/\D/g, '').length >= 7, messages.phone),
    email: z.string().trim().max(140),
    message: z.string().trim().max(1000),
    consent: z.boolean().refine((value) => value, messages.consent),
  })
}

export const leadSchema = makeLeadSchema()

export type LeadFormValues = z.infer<typeof leadSchema>

// -------------------------------------------------------- gestion inmobiliaria
const optionalText = (max: number) => z.string().trim().max(max)

export const agreementSchema = z.object({
  property_id: z.string().min(1, 'Elige la propiedad'),
  owner_profile_id: z.string().nullable(),
  owner_name: z.string().trim().min(3, 'Escribe el nombre del propietario').max(140),
  owner_document_type: z.enum(['CC', 'CE', 'NIT', 'PASAPORTE']),
  owner_document: optionalText(30),
  owner_email: optionalText(140),
  owner_phone: optionalText(30),
  commission_pct: z.number().min(0).max(30, 'Maximo 30 %'),
  charges_vat: z.boolean(),
  vat_pct: z.number().min(0).max(30),
  withholding_pct: z.number().min(0).max(20),
  bank_name: optionalText(80),
  account_type: z.enum(['AHORROS', 'CORRIENTE']).nullable(),
  account_number: optionalText(40),
  account_holder: optionalText(140),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  notes: optionalText(1000),
})
export type AgreementFormValues = z.infer<typeof agreementSchema>

export const expenseSchema = z.object({
  property_id: z.string().min(1, 'Elige la propiedad'),
  description: z.string().trim().min(3, 'Describe el gasto').max(300),
  amount: z.number().positive('Escribe el valor'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  approved: z.boolean(),
})
export type ExpenseFormValues = z.infer<typeof expenseSchema>

export const extraChargeSchema = z.object({
  lease_id: z.string().min(1, 'Elige el contrato'),
  concept: z.enum(['UTILITIES', 'LATE_FEE', 'OTHER']),
  amount: z.number().positive('Escribe el valor'),
  description: z.string().trim().min(3, 'Describe el cobro').max(200),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha limite'),
})
export type ExtraChargeFormValues = z.infer<typeof extraChargeSchema>

export const rentIncreaseSchema = z.object({
  index_pct: z.number().min(0, 'No puede ser negativo').max(30, 'Maximo 30 %'),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige desde cuando'),
})
export type RentIncreaseFormValues = z.infer<typeof rentIncreaseSchema>

export const noticeSchema = z.object({
  notice_given_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha del aviso'),
  notice_by: z.enum(['ARRENDADOR', 'ARRENDATARIO']),
})
export type NoticeFormValues = z.infer<typeof noticeSchema>

export const guarantorSchema = z.object({
  name: z.string().trim().min(3, 'Escribe el nombre').max(140),
  document: optionalText(30),
  phone: optionalText(30),
  email: optionalText(140),
})
export type GuarantorFormValues = z.infer<typeof guarantorSchema>

export const signContractSchema = z.object({
  name: z.string().trim().min(3, 'Escribe tu nombre completo').max(140),
  document: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, '').length >= 5, 'Escribe tu numero de documento'),
  signature: z.string().min(30, 'Dibuja tu firma en el recuadro'),
  accept: z.boolean().refine((value) => value, 'Debes aceptar para firmar'),
})
export type SignContractFormValues = z.infer<typeof signContractSchema>

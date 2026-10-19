import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === '' || value.replace(/\D/g, '').length >= 7, 'Numero invalido')

const optionalCount = z.coerce.number().int().min(0).max(99).nullable()

export const listingSchema = z
  .object({
    category: z.enum([
      'PRODUCTS',
      'PROPERTY_RENT',
      'PROPERTY_SALE',
      'FOOD',
      'ACCESSORIES',
      'CLASSES',
      'SERVICES',
      'OTHER',
    ]),
    title: z.string().trim().min(3, 'Escribe un titulo').max(120),
    description: z.string().trim().min(10, 'Describe un poco mas (minimo 10 caracteres)').max(3000),
    price_type: z.enum(['FIXED', 'NEGOTIABLE', 'FREE', 'PER_HOUR', 'PER_MONTH', 'PER_UNIT']),
    price: z.coerce.number().min(0).max(99_999_999_999).nullable(),
    item_condition: z.enum(['NEW', 'USED']).nullable(),
    bedrooms: optionalCount,
    bathrooms: optionalCount,
    area_m2: z.coerce.number().min(0).max(100_000).nullable(),
    parking: z.boolean(),
    modality: z.enum(['IN_PERSON', 'ONLINE', 'BOTH']).nullable(),
    delivery: z.boolean(),
    schedule: z.string().trim().max(80),
    apartment_id: z.string().uuid().nullable(),
    contact_phone: phone,
    contact_whatsapp: phone,
    // Registro de oferentes (Ley 1480, art. 53): solo se piden si faltan en el perfil.
    document_type: z.string(),
    document_number: z.string().trim().max(30),
    accept_rules: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.contact_phone && !values.contact_whatsapp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contact_phone'],
        message: 'Deja un telefono o WhatsApp para que te contacten',
      })
    }
  })

export type ListingFormValues = z.infer<typeof listingSchema>

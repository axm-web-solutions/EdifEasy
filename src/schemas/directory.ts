import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .max(30, 'Maximo 30 caracteres')
  .refine((value) => value === '' || value.replace(/\D/g, '').length >= 3, 'Numero invalido')

/** Contacto del directorio del conjunto (emergencias o servicios). */
export const contactSchema = z
  .object({
    kind: z.enum(['EMERGENCY', 'SERVICE']),
    category: z.string().min(2, 'Selecciona una categoria'),
    name: z.string().trim().min(2, 'Escribe el nombre').max(120),
    phone,
    whatsapp: phone,
    description: z.string().trim().max(500),
    address: z.string().trim().max(200),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.phone && !values.whatsapp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Agrega un telefono o un WhatsApp',
      })
    }
  })

export type ContactFormValues = z.infer<typeof contactSchema>

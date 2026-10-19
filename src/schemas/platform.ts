import { z } from 'zod'
import { EMAIL_SLUG_PATTERN, RESIDENT_EMAIL_DOMAIN } from '@/features/platform/viewmodels/rut.logic'

const count = (label: string, max: number) =>
  z.coerce
    .number({ invalid_type_error: `${label}: escribe un numero` })
    .int(`${label}: sin decimales`)
    .min(0)
    .max(max, `${label}: maximo ${max}`)

/** Alta de un conjunto desde el RUT (super administrador). */
export const provisionSchema = z
  .object({
    name: z.string().trim().min(3, 'Escribe el nombre del conjunto').max(150),
    nit: z
      .string()
      .trim()
      .regex(/^\d{6,12}(-\d)?$/, 'NIT invalido (ej. 900518186-0)'),
    address: z.string().trim().min(3, 'Escribe la direccion').max(200),
    city: z.string().trim().min(2, 'Escribe la ciudad').max(80),
    department: z.string().trim().max(80),
    phone: z.string().trim().max(30),
    email: z.string().trim().email('Correo invalido').or(z.literal('')),
    admin_name: z.string().trim().min(3, 'Escribe el nombre del representante legal').max(150),
    admin_email: z
      .string()
      .trim()
      .email('Correo invalido')
      .refine(
        (value) => !value.toLowerCase().endsWith(`@${RESIDENT_EMAIL_DOMAIN}`),
        `El administrador necesita un correo real, no @${RESIDENT_EMAIL_DOMAIN}`,
      ),
    kind: z.enum(['HOUSES', 'TOWERS']),
    houses: count('Casas', 2000),
    towers: count('Torres', 60),
    floors: count('Pisos', 60),
    units_per_floor: count('Apartamentos por piso', 30),
    email_slug: z
      .string()
      .trim()
      .regex(EMAIL_SLUG_PATTERN, 'Solo letras minusculas y numeros, de 3 a 30'),
  })
  .superRefine((values, ctx) => {
    if (values.kind === 'HOUSES' && values.houses < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['houses'], message: 'Indica cuantas casas hay' })
    }
    if (values.kind === 'TOWERS') {
      for (const key of ['towers', 'floors', 'units_per_floor'] as const) {
        if (values[key] < 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Minimo 1' })
        }
      }
      if (values.towers * values.floors * values.units_per_floor > 3000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['units_per_floor'],
          message: 'Maximo 3000 apartamentos por alta',
        })
      }
    }
  })

export type ProvisionFormValues = z.infer<typeof provisionSchema>

import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))
const optionalUuid = z.string().uuid().optional().nullable().or(z.literal(''))

export const documentSchema = z.object({
  title: z.string().min(3, 'El titulo debe tener al menos 3 caracteres').max(150),
  description: optionalText(1000),
  category_id: optionalUuid,
  building_id: optionalUuid,
  apartment_id: optionalUuid,
  visibility: z.enum(['CONDOMINIUM', 'BUILDING', 'APARTMENT', 'ROLE']).default('CONDOMINIUM'),
  is_restricted: z.boolean().default(false),
})

export type DocumentFormValues = z.infer<typeof documentSchema>

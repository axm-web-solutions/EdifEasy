import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))

export const visitorSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  document_number: optionalText(30),
  phone: optionalText(30),
  type: z.enum(['VISIT', 'DELIVERY', 'PROVIDER', 'OTHER']).default('VISIT'),
  status: z.enum(['EXPECTED', 'INSIDE', 'LEFT', 'CANCELLED']).default('EXPECTED'),
  apartment_id: z.string().uuid('Selecciona un apartamento'),
  company: optionalText(120),
  plate: optionalText(20),
  scheduled_at: z.string().optional().nullable(),
  notes: optionalText(1000),
})

export type VisitorFormValues = z.infer<typeof visitorSchema>
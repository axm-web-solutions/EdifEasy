import { z } from 'zod'

export const GUARD_LOG_CATEGORIES = [
  'TURNO_INICIO',
  'TURNO_FIN',
  'RONDA',
  'NOVEDAD',
  'VISITANTE',
  'PAQUETE',
  'MANTENIMIENTO',
  'SEGURIDAD',
  'OTRO',
] as const

export const logbookEntrySchema = z.object({
  category: z.enum(GUARD_LOG_CATEGORIES, { message: 'Elige el tipo de anotacion' }),
  priority: z.enum(['NORMAL', 'IMPORTANTE', 'URGENTE']),
  description: z.string().trim().min(3, 'Describe lo que paso').max(2000, 'Maximo 2000 caracteres'),
  apartment_id: z.string().uuid().nullable(),
})

export type LogbookEntryFormValues = z.infer<typeof logbookEntrySchema>

export const staffCheckInSchema = z
  .object({
    mode: z.enum(['member', 'external']),
    profile_id: z.string().nullable(),
    name: z.string().trim().max(120),
    role_label: z.string().trim().max(60),
    notes: z.string().trim().max(500),
  })
  .refine((values) => values.mode !== 'member' || Boolean(values.profile_id), {
    path: ['profile_id'],
    message: 'Elige la persona',
  })
  .refine((values) => values.mode !== 'external' || values.name.length >= 3, {
    path: ['name'],
    message: 'Escribe el nombre completo',
  })

export type StaffCheckInFormValues = z.infer<typeof staffCheckInSchema>

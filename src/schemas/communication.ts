import { z } from 'zod'

const optionalUuid = z.string().uuid().optional().nullable().or(z.literal(''))

export const alertSchema = z
  .object({
    title: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(150),
    description: z.string().min(10, 'La descripcion debe tener al menos 10 caracteres').max(2000),
    type: z.enum([
      'EMERGENCY',
      'SECURITY',
      'MAINTENANCE',
      'WATER',
      'ELECTRICITY',
      'GAS',
      'ADMINISTRATION',
      'COMMUNITY',
      'PAYMENT',
      'OTHER',
    ]),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    status: z.enum(['DRAFT', 'ACTIVE', 'RESOLVED', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
    audience: z.enum(['CONDOMINIUM', 'BUILDING', 'APARTMENT', 'ROLE']).default('CONDOMINIUM'),
    building_id: optionalUuid,
    apartment_id: optionalUuid,
    audience_role_id: optionalUuid,
    start_at: z.string().min(1, 'La fecha de inicio es obligatoria'),
    end_at: z.string().optional().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.audience === 'BUILDING' && !values.building_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['building_id'], message: 'Selecciona un bloque' })
    }
    if (values.audience === 'APARTMENT' && !values.apartment_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apartment_id'],
        message: 'Selecciona un apartamento',
      })
    }
    if (values.audience === 'ROLE' && !values.audience_role_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audience_role_id'],
        message: 'Selecciona un rol',
      })
    }
  })

export const announcementSchema = z
  .object({
    title: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(150),
    content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres').max(8000),
    image_url: z.string().url('URL invalida').optional().or(z.literal('')),
    audience: z.enum(['CONDOMINIUM', 'BUILDING', 'APARTMENT', 'ROLE']).default('CONDOMINIUM'),
    building_id: optionalUuid,
    apartment_id: optionalUuid,
    audience_role_id: optionalUuid,
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
    published_at: z.string().min(1, 'La fecha de publicacion es obligatoria'),
    expires_at: z.string().optional().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.audience === 'BUILDING' && !values.building_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['building_id'], message: 'Selecciona un bloque' })
    }
    if (values.audience === 'ROLE' && !values.audience_role_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audience_role_id'],
        message: 'Selecciona un rol',
      })
    }
  })

export const conversationSchema = z.object({
  subject: z.string().min(3, 'El asunto debe tener al menos 3 caracteres').max(150),
  participant_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos un destinatario'),
  message: z.string().min(1, 'Escribe un mensaje').max(4000),
})

export type AlertFormValues = z.infer<typeof alertSchema>
export type AnnouncementFormValues = z.infer<typeof announcementSchema>
export type ConversationFormValues = z.infer<typeof conversationSchema>

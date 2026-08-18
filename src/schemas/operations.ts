import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))
const optionalUuid = z.string().uuid().optional().nullable().or(z.literal(''))

export const requestSchema = z.object({
  title: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(150),
  description: z.string().min(10, 'La descripcion debe tener al menos 10 caracteres').max(4000),
  type: z.enum([
    'MAINTENANCE',
    'SECURITY',
    'ADMINISTRATION',
    'PARKING',
    'NOISE',
    'COMMON_AREAS',
    'SERVICES',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).default('OPEN'),
  apartment_id: optionalUuid,
  building_id: optionalUuid,
  assigned_to: optionalUuid,
})

export const incidentSchema = z.object({
  title: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(150),
  description: z.string().min(10, 'La descripcion debe tener al menos 10 caracteres').max(4000),
  type: z.enum([
    'THEFT',
    'VANDALISM',
    'TRESPASSING',
    'NOISE',
    'FIRE',
    'FLOOD',
    'ACCIDENT',
    'MEDICAL',
    'PARKING',
    'PET',
    'OTHER',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).default('OPEN'),
  location: optionalText(150),
  occurred_at: z.string().min(1, 'La fecha del incidente es obligatoria'),
  apartment_id: optionalUuid,
  building_id: optionalUuid,
  assigned_to: optionalUuid,
  resolution: optionalText(2000),
})

export const fineSchema = z.object({
  apartment_id: z.string().uuid('Selecciona un apartamento'),
  resident_id: optionalUuid,
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').max(200),
  description: optionalText(2000),
  amount: z.coerce.number().min(0, 'El valor no puede ser negativo').max(999_999_999),
  fine_date: z.string().min(1, 'La fecha es obligatoria'),
  due_date: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'APPEALED']).default('PENDING'),
  notes: optionalText(1000),
})

export type RequestFormValues = z.infer<typeof requestSchema>
export type IncidentFormValues = z.infer<typeof incidentSchema>
export type FineFormValues = z.infer<typeof fineSchema>

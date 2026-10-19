import { z } from 'zod'

export const reservationSchema = z.object({
  common_area_id: z.string().uuid('Elige la zona comun'),
  apartment_id: z.string().uuid('Elige el apartamento'),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Elige la hora de inicio'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Elige la hora final'),
  guests: z.coerce.number().int().min(0).max(5000).nullable(),
  notes: z.string().trim().max(500),
})

export type ReservationFormValues = z.infer<typeof reservationSchema>

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora invalida')

export const commonAreaSchema = z
  .object({
    name: z.string().trim().min(2, 'Escribe el nombre').max(80),
    description: z.string().trim().max(500),
    rules: z.string().trim().max(2000),
    price: z.coerce.number().min(0, 'No puede ser negativo').max(50_000_000),
    capacity: z.coerce.number().int().min(1).max(5000).nullable(),
    open_time: time,
    close_time: time,
    max_hours: z.coerce.number().int().min(1, 'Minimo 1 hora').max(24, 'Maximo 24 horas'),
    requires_approval: z.boolean(),
    is_active: z.boolean(),
  })
  .refine((values) => values.close_time.slice(0, 5) > values.open_time.slice(0, 5), {
    path: ['close_time'],
    message: 'El cierre debe ser despues de la apertura',
  })

export type CommonAreaFormValues = z.infer<typeof commonAreaSchema>

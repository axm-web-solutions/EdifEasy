import { z } from 'zod'

export const ALARM_PROVIDERS = [
  'GENERIC',
  'AJAX',
  'HIKVISION',
  'DAHUA',
  'PARADOX',
  'DSC',
  'HONEYWELL',
  'TEXECOM',
  'MONITORING_CENTER',
  'OTHER',
] as const

/** "COMMON" = zona comun (sin unidad). */
export const alarmDeviceSchema = z.object({
  apartment_id: z.string().min(1, 'Elige la casa, el apartamento o la zona comun'),
  name: z.string().trim().min(2, 'Ponle un nombre (ej: Panel sala)').max(80),
  provider: z.enum(ALARM_PROVIDERS),
  location: z.string().trim().max(80),
  notes: z.string().trim().max(300),
  is_active: z.boolean(),
})

export type AlarmDeviceFormValues = z.infer<typeof alarmDeviceSchema>

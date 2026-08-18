import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))

export const residentSchema = z.object({
  apartment_id: z.string().uuid('Selecciona un apartamento'),
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  document_number: optionalText(30),
  relationship: z.enum(['OWNER', 'TENANT', 'FAMILY', 'EMPLOYEE', 'OTHER']).default('FAMILY'),
  birth_date: z.string().optional().nullable(),
  phone: optionalText(30),
  email: z.string().email('Correo invalido').optional().or(z.literal('')),
  emergency_phone: optionalText(30),
  notes: optionalText(500),
  is_active: z.boolean().default(true),
})

export const vehicleSchema = z.object({
  apartment_id: z.string().uuid('Selecciona un apartamento'),
  type: z.enum(['CAR', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'OTHER']).default('CAR'),
  plate: z.string().min(3, 'La placa es obligatoria').max(12),
  brand: optionalText(50),
  model: optionalText(50),
  color: optionalText(30),
  parking_spot: optionalText(20),
  is_active: z.boolean().default(true),
})

export const petSchema = z.object({
  apartment_id: z.string().uuid('Selecciona un apartamento'),
  name: z.string().min(1, 'El nombre es obligatorio').max(60),
  type: z.enum(['DOG', 'CAT', 'BIRD', 'FISH', 'REPTILE', 'OTHER']).default('DOG'),
  breed: optionalText(60),
  color: optionalText(30),
  weight: z.coerce.number().min(0).max(200).optional().nullable(),
  vaccinated: z.boolean().default(false),
  notes: optionalText(300),
  is_active: z.boolean().default(true),
})

export const memberSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio').email('Correo invalido'),
  role_code: z.enum([
    'ADMINISTRATOR',
    'SPOKESPERSON',
    'OWNER',
    'TENANT',
    'SECURITY',
    'SERVICE_STAFF',
  ]),
  position: optionalText(80),
})

export const memberUpdateSchema = z.object({
  role_id: z.string().uuid('Selecciona un rol'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).default('ACTIVE'),
  position: optionalText(80),
})

export const apartmentOwnerSchema = z.object({
  profile_id: z.string().uuid('Selecciona un usuario'),
  ownership_percentage: z.coerce.number().min(0).max(100).default(100),
  is_primary: z.boolean().default(true),
  start_date: z.string().min(1, 'La fecha de inicio es obligatoria'),
  end_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

export const apartmentTenantSchema = z.object({
  profile_id: z.string().uuid('Selecciona un usuario'),
  lease_start: z.string().min(1, 'La fecha de inicio es obligatoria'),
  lease_end: z.string().optional().nullable(),
  monthly_rent: z.coerce.number().min(0).optional().nullable(),
  is_active: z.boolean().default(true),
})


/** Invitacion creada por un administrador para dar de alta a un usuario. */
export const invitationSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio').email('Correo invalido'),
  role_code: z.enum([
    'ADMINISTRATOR',
    'SPOKESPERSON',
    'OWNER',
    'TENANT',
    'SECURITY',
    'SERVICE_STAFF',
  ]),
  position: z.string().max(80).optional().or(z.literal('')),
  apartment_id: z.string().uuid().optional().or(z.literal('')),
})

export type InvitationFormValues = z.infer<typeof invitationSchema>

export type ResidentFormValues = z.infer<typeof residentSchema>
export type VehicleFormValues = z.infer<typeof vehicleSchema>
export type PetFormValues = z.infer<typeof petSchema>
export type MemberFormValues = z.infer<typeof memberSchema>
export type MemberUpdateFormValues = z.infer<typeof memberUpdateSchema>
export type ApartmentOwnerFormValues = z.infer<typeof apartmentOwnerSchema>
export type ApartmentTenantFormValues = z.infer<typeof apartmentTenantSchema>

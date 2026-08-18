import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minuscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayuscula')
  .regex(/[0-9]/, 'Debe incluir al menos un numero')

export const loginSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio').email('Correo electronico invalido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
  remember: z.boolean().optional().default(true),
})

export const SELF_REGISTER_ROLES = ['OWNER', 'TENANT', 'BOTH'] as const
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number]

const registrationVehicleSchema = z.object({
  plate: z.string().trim().min(3, 'Ingresa la placa del vehiculo').max(12),
  type: z.enum(['CAR', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'OTHER']).optional(),
  brand: z.string().trim().max(60).optional().or(z.literal('')),
  model: z.string().trim().max(60).optional().or(z.literal('')),
  color: z.string().trim().max(40).optional().or(z.literal('')),
})

export const registerSchema = z
  .object({
    userType: z.enum(SELF_REGISTER_ROLES, {
      errorMap: () => ({ message: 'Selecciona tu tipo de usuario' }),
    }),
    fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
    email: z.string().min(1, 'El correo es obligatorio').email('Correo electronico invalido'),
    phone: z.string().max(30).optional().or(z.literal('')),
    documentNumber: z.string().max(30).optional().or(z.literal('')),
    condominiumId: z.string().uuid('Selecciona tu condominio'),
    buildingId: z.string().uuid('Selecciona tu edificio'),
    apartmentId: z.string().uuid('Selecciona tu apartamento'),
    note: z.string().max(500).optional().or(z.literal('')),
    vehicles: z.array(registrationVehicleSchema).optional().default([]),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma la contrasena'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Debes aceptar los terminos y condiciones' }),
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio').email('Correo electronico invalido'),
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma la contrasena'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  })

export const profileSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  phone: z.string().max(30).optional().or(z.literal('')),
  document_type: z.string().max(10).optional().or(z.literal('')),
  document_number: z.string().max(30).optional().or(z.literal('')),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
export type ProfileFormValues = z.infer<typeof profileSchema>

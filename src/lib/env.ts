import { z } from 'zod'

/**
 * Validacion de variables de entorno del frontend.
 * Si falta alguna variable obligatoria la app muestra una pantalla de
 * configuracion en lugar de fallar con un error opaco de red.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL debe ser una URL valida'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(
      20,
      'Falta la clave publica: define VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY',
    ),
  VITE_SENTRY_DSN: z.string().optional().default(''),
  VITE_APP_NAME: z.string().optional().default('EdiFeasy'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).optional().default('development'),
})

export type AppEnv = z.infer<typeof envSchema>

/**
 * Clave publica del proyecto. Supabase la llama `anon` en el sistema clasico
 * (JWT `eyJ...`) y `publishable` en el nuevo (`sb_publishable_...`).
 * Ambas se usan igual, asi que aceptamos los dos nombres de variable.
 */
const publicKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: publicKey,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
})

export const envIsValid = parsed.success

export const envErrors: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)

/**
 * Valores efectivos. Cuando la validacion falla se usan placeholders para que
 * el bundle cargue y `<EnvGuard />` pueda renderizar las instrucciones.
 */
export const env: AppEnv = parsed.success
  ? parsed.data
  : {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'missing-anon-key-placeholder',
      VITE_SENTRY_DSN: '',
      VITE_APP_NAME: 'EdiFeasy',
      VITE_APP_ENV: 'development',
    }

export const isProduction = env.VITE_APP_ENV === 'production'

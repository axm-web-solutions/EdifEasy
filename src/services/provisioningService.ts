/**
 * Alta de un conjunto completo (solo SUPER_ADMIN) via la Edge Function
 * `provision-condominium`: crea el conjunto, sus torres o casas, la cuenta del
 * administrador y una cuenta de propietario por unidad.
 */
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'

export interface ProvisionInput {
  condominium: {
    name: string
    nit: string
    address: string
    city: string
    department: string
    phone: string
    email: string
  }
  admin: { full_name: string; email: string }
  layout:
    | { kind: 'HOUSES'; houses: number }
    | { kind: 'TOWERS'; towers: number; floors: number; units_per_floor: number }
  email_slug: string
}

export interface ProvisionResult {
  condominium_id: string
  condominium_name: string
  admin: { email: string; password: string | null; existing: boolean }
  accounts: { unit: string; email: string; password: string | null; existing: boolean }[]
}

export interface ExistingAccountsResult {
  condominium_id: string
  condominium_name: string
  admin: null
  accounts: ProvisionResult['accounts']
}

async function invokeProvision<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(
    'provision-condominium',
    { body },
  )
  if (error) {
    let message =
      'No se pudo conectar con el servicio de alta. Verifica que la Edge Function `provision-condominium` este desplegada.'
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      const parsed = (await context.json().catch(() => null)) as { error?: string } | null
      if (parsed?.error) message = parsed.error
      else if (context.status === 404)
        message =
          'Falta desplegar la Edge Function provision-condominium (supabase functions deploy provision-condominium).'
    }
    throw new AppError(message, { code: 'EDGE_FUNCTION' })
  }
  if (!data || data.error)
    throw new AppError(data?.error ?? 'Respuesta vacia del servicio de alta', { code: 'PROVISION' })
  return data
}

export const provisioningService = {
  /** Cuentas de propietario para las unidades sin propietario de un conjunto ya creado. */
  provisionExisting(condominiumId: string, emailSlug: string): Promise<ExistingAccountsResult> {
    return invokeProvision<ExistingAccountsResult>({
      mode: 'existing',
      condominium_id: condominiumId,
      email_slug: emailSlug,
    })
  },

  provision(input: ProvisionInput): Promise<ProvisionResult> {
    return invokeProvision<ProvisionResult>(input as unknown as Record<string, unknown>)
  },
}

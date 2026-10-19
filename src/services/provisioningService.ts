/**
 * Alta de un conjunto completo (solo SUPER_ADMIN) via la Edge Function
 * `provision-condominium`: crea el conjunto, sus torres o casas, la cuenta del
 * administrador y una cuenta de propietario por unidad.
 */
import { supabase } from '@/lib/supabase'

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

export const provisioningService = {
  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const { data, error } = await supabase.functions.invoke<ProvisionResult & { error?: string }>(
      'provision-condominium',
      { body: input },
    )
    if (error) {
      let message =
        'No se pudo conectar con el servicio de alta. Verifica que la Edge Function `provision-condominium` este desplegada.'
      const context = (error as { context?: unknown }).context
      if (context instanceof Response) {
        const parsed = (await context.json().catch(() => null)) as { error?: string } | null
        if (parsed?.error) message = parsed.error
      }
      throw new Error(message)
    }
    if (!data || data.error) throw new Error(data?.error ?? 'Respuesta vacia del servicio de alta')
    return data
  },
}

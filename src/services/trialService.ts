/**
 * Prueba gratis de 7 dias. La cuenta se crea desde la landing con
 * user_metadata.trial; aqui solo se arranca la prueba (crea el conjunto y deja
 * a la persona como administradora). El RPC es idempotente.
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'

export const trialService = {
  async start(): Promise<string> {
    const { data, error } = await supabase.rpc('start_trial', {})
    if (error) throw toAppError(error)
    return data
  },
}

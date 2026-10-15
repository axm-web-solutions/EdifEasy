import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { PlatformOverview } from '@/types/models'

/** Datos de toda la plataforma. Solo responde a un SUPER_ADMIN (lo valida la base). */
export const platformService = {
  async overview(): Promise<PlatformOverview> {
    const { data, error } = await supabase.rpc('platform_overview')
    if (error) throw toAppError(error)
    return data as unknown as PlatformOverview
  },
}

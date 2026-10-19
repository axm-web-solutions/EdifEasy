import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { ModuleKey } from '@/constants/modules'
import type { RoleCode } from '@/types/database'
import type { RoleModulesMatrix } from '@/types/models'

/** Configuracion de modulos por rol (la escritura solo la permite la base al SUPER_ADMIN). */
export const moduleService = {
  async myDisabled(condominiumId: string): Promise<ModuleKey[]> {
    const { data, error } = await supabase.rpc('my_disabled_modules', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return (data ?? []) as ModuleKey[]
  },

  /** `condominiumId` null = plantilla por defecto. */
  async matrix(condominiumId: string | null): Promise<RoleModulesMatrix> {
    const { data, error } = await supabase.rpc('role_modules_matrix', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return data as unknown as RoleModulesMatrix
  },

  async set(input: {
    condominiumId: string | null
    role: RoleCode
    module: ModuleKey
    enabled: boolean
  }): Promise<void> {
    const { error } = await supabase.rpc('set_role_module', {
      p_condominium: input.condominiumId,
      p_role: input.role,
      p_module: input.module,
      p_enabled: input.enabled,
    })
    if (error) throw toAppError(error)
  },

  /** Borra la configuracion propia del conjunto: vuelve a usar la plantilla. */
  async reset(condominiumId: string): Promise<number> {
    const { data, error } = await supabase.rpc('reset_role_modules', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return data
  },
}

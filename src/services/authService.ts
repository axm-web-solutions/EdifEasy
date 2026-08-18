import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { UserContext } from '@/types/models'
import type { Json, ProfileRow } from '@/types/database'
import type { SelfRegisterRole } from '@/schemas/auth'

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput {
  email: string
  password: string
  fullName: string
  userType: SelfRegisterRole
  phone?: string
  documentNumber?: string
  documentType?: string
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw toAppError(error)
    return data.session
  },

  async signIn({ email, password }: SignInInput): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw toAppError(error)
    if (!data.session) throw toAppError({ message: 'No se pudo iniciar sesion' })

    await authService.recordAudit('LOGIN', data.session.user.id)
    return data.session
  },

  async signUp(input: SignUpInput): Promise<{ user: User | null; needsConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          phone: input.phone ?? null,
          document_number: input.documentNumber ?? null,
          document_type: input.documentType ?? 'CC',
          requested_role: input.userType,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw toAppError(error)
    return { user: data.user, needsConfirmation: !data.session }
  },

  async signOut(): Promise<void> {
    const { data } = await supabase.auth.getUser()
    if (data.user) await authService.recordAudit('LOGOUT', data.user.id)

    const { error } = await supabase.auth.signOut()
    if (error) throw toAppError(error)
  },

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw toAppError(error)
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw toAppError(error)
  },

  /** Perfil + membresias + roles resueltos en PostgreSQL (nunca en el cliente). */
  async getUserContext(): Promise<UserContext> {
    const { data, error } = await supabase.rpc('current_user_context')
    if (error) throw toAppError(error)

    const context = (data ?? {}) as unknown as Partial<UserContext>
    return {
      profile: context.profile ?? null,
      is_super_admin: Boolean(context.is_super_admin),
      memberships: context.memberships ?? [],
      apartment_ids: context.apartment_ids ?? [],
    }
  },

  async updateProfile(
    userId: string,
    values: Partial<Pick<ProfileRow, 'full_name' | 'phone' | 'document_number' | 'document_type' | 'avatar_url'>>,
  ): Promise<ProfileRow> {
    const { data, error } = await supabase
      .from('profiles')
      .update(values)
      .eq('id', userId)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  /**
   * Auditoria de sesion. Se ejecuta best-effort: un fallo aqui nunca debe
   * impedir el login o el logout del usuario.
   */
  async recordAudit(action: 'LOGIN' | 'LOGOUT', userId: string, metadata: Json = {}): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        entity: 'auth',
        entity_id: userId,
        metadata,
        user_agent: navigator.userAgent,
      })
    } catch {
      // silencioso por diseno
    }
  },
}

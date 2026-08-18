import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Json, RegistrationStatus, VehicleType } from '@/types/database'
import type { SelfRegisterRole } from '@/schemas/auth'

export interface RegistrationCondominiumOption {
  id: string
  name: string
  city: string | null
  country: string | null
}

export interface RegistrationBuildingOption {
  id: string
  number: string
  name: string | null
}

/** Apartamento existente. Los ya reclamados se muestran deshabilitados. */
export interface RegistrationApartmentOption {
  id: string
  number: string
  floor: number
  claimed_by_owner: boolean
  claimed_by_tenant: boolean
  has_pending_request: boolean
}

export interface RegistrationVehicleInput {
  plate: string
  type?: VehicleType
  brand?: string
  model?: string
  color?: string
}

export interface RegistrationRequestInput {
  condominiumId: string
  buildingId: string
  apartmentId: string
  userType: SelfRegisterRole
  vehicles: RegistrationVehicleInput[]
  note?: string
}

/** Estado de la solicitud propia (pantalla de espera). */
export interface MyRegistrationRequest {
  id: string
  status: RegistrationStatus
  requested_role: SelfRegisterRole
  condominium_name: string
  building_number: string
  apartment_number: string
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

/** Solicitud vista por el administrador que la revisa. */
export interface RegistrationRequestReview {
  id: string
  status: RegistrationStatus
  requested_role: SelfRegisterRole
  applicant_note: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
  vehicles: RegistrationVehicleInput[]
  profile_id: string
  full_name: string
  email: string
  phone: string | null
  document_number: string | null
  building_id: string
  building_number: string
  apartment_id: string
  apartment_number: string
  reviewer_name: string | null
}

/** Clave con la que se persiste una inscripcion pendiente hasta completarla. */
const PENDING_KEY = 'edifeasy.pendingRegistration'

export const registrationService = {
  /** Condominios ACTIVOS. Es la unica fuente: no se admite texto libre. */
  async catalog(): Promise<RegistrationCondominiumOption[]> {
    const { data, error } = await supabase.rpc('registration_catalog')
    if (error) throw toAppError(error)
    return (data as unknown as RegistrationCondominiumOption[]) ?? []
  },

  /** Edificios ACTIVOS del condominio elegido. */
  async buildings(condominiumId: string): Promise<RegistrationBuildingOption[]> {
    const { data, error } = await supabase.rpc('registration_buildings', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    return (data as unknown as RegistrationBuildingOption[]) ?? []
  },

  /** Apartamentos existentes del edificio elegido, con su estado de ocupacion. */
  async apartments(buildingId: string): Promise<RegistrationApartmentOption[]> {
    const { data, error } = await supabase.rpc('registration_apartments', {
      p_building: buildingId,
    })
    if (error) throw toAppError(error)
    return (data as unknown as RegistrationApartmentOption[]) ?? []
  },

  /**
   * Crea la SOLICITUD de inscripcion. No otorga acceso: queda en estado
   * PENDING hasta que un administrador del condominio la apruebe.
   */
  async request(input: RegistrationRequestInput): Promise<{ ok: boolean; request_id: string }> {
    const { data, error } = await supabase.rpc('complete_self_registration', {
      p_condominium: input.condominiumId,
      p_building: input.buildingId,
      p_apartment: input.apartmentId,
      p_user_type: input.userType,
      p_vehicles: input.vehicles as unknown as Json,
      p_note: input.note ?? null,
    })
    if (error) throw toAppError(error)
    return (data as unknown as { ok: boolean; request_id: string }) ?? { ok: false, request_id: '' }
  },

  /** Estado de mi solicitud, o null si nunca solicite nada. */
  async myRequest(): Promise<MyRegistrationRequest | null> {
    const { data, error } = await supabase.rpc('my_registration_request')
    if (error) throw toAppError(error)
    return (data as unknown as MyRegistrationRequest | null) ?? null
  },

  // -------------------------------------------------------------------------
  // Revision (solo ADMINISTRATOR del condominio)
  // -------------------------------------------------------------------------
  async forReview(
    condominiumId: string,
    status: RegistrationStatus | 'ALL' = 'PENDING',
  ): Promise<RegistrationRequestReview[]> {
    const { data, error } = await supabase.rpc('registration_requests_for_review', {
      p_condominium: condominiumId,
      p_status: status,
    })
    if (error) throw toAppError(error)
    return (data as unknown as RegistrationRequestReview[]) ?? []
  },

  async approve(requestId: string, notes?: string): Promise<void> {
    const { error } = await supabase.rpc('approve_registration_request', {
      p_request: requestId,
      p_notes: notes ?? null,
    })
    if (error) throw toAppError(error)
  },

  async reject(requestId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('reject_registration_request', {
      p_request: requestId,
      p_reason: reason,
    })
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Persistencia local: el usuario elige su apartamento antes de confirmar el
  // correo, asi que guardamos la eleccion hasta que pueda enviar la solicitud.
  // -------------------------------------------------------------------------
  savePending(input: RegistrationRequestInput): void {
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(input))
    } catch {
      // localStorage puede estar bloqueado; se volvera a pedir al entrar.
    }
  },

  loadPending(): RegistrationRequestInput | null {
    try {
      const raw = window.localStorage.getItem(PENDING_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<RegistrationRequestInput>
      if (!parsed.condominiumId || !parsed.buildingId || !parsed.apartmentId) return null
      return {
        condominiumId: parsed.condominiumId,
        buildingId: parsed.buildingId,
        apartmentId: parsed.apartmentId,
        userType: parsed.userType ?? 'OWNER',
        vehicles: parsed.vehicles ?? [],
        note: parsed.note,
      }
    } catch {
      return null
    }
  },

  clearPending(): void {
    try {
      window.localStorage.removeItem(PENDING_KEY)
    } catch {
      // sin efecto
    }
  },
}

/**
 * Tipos de la base de datos EdiFeasy.
 *
 * Refleja 1:1 `supabase/schema.sql`. Se usa como parametro generico del cliente
 * de Supabase (`SupabaseClient<Database, 'tribuia'>`), de modo que selects,
 * inserts, updates y RPC quedan tipados en tiempo de compilacion.
 *
 * Todo el modelo vive en el esquema `tribuia`, no en `public`.
 *
 * Para regenerarlo desde el proyecto real:
 *   npx supabase gen types typescript --project-id <ref> --schema tribuia
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

/** Campos que la base de datos genera automaticamente. */
type Generated = 'id' | 'created_at' | 'updated_at'

/** Insert: todo opcional salvo las columnas obligatorias explicitas. */
type InsertOf<TRow, TRequired extends keyof TRow = never> = Partial<Omit<TRow, Generated>> &
  Pick<TRow, TRequired> & { id?: string; created_at?: string; updated_at?: string }

/** Update: todo opcional. */
type UpdateOf<TRow> = Partial<TRow>

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED'
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type CondominiumStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type BuildingStatus = 'ACTIVE' | 'INACTIVE'
export type ApartmentStatus = 'OCCUPIED' | 'VACANT' | 'MAINTENANCE' | 'INACTIVE'
export type ResidentRelationship = 'OWNER' | 'TENANT' | 'FAMILY' | 'EMPLOYEE' | 'OTHER'
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BICYCLE' | 'TRUCK' | 'OTHER'
export type PetType = 'DOG' | 'CAT' | 'BIRD' | 'FISH' | 'REPTILE' | 'OTHER'
export type AudienceType = 'CONDOMINIUM' | 'BUILDING' | 'APARTMENT' | 'ROLE'
export type AlertType =
  | 'EMERGENCY'
  | 'SECURITY'
  | 'MAINTENANCE'
  | 'WATER'
  | 'ELECTRICITY'
  | 'GAS'
  | 'ADMINISTRATION'
  | 'COMMUNITY'
  | 'PAYMENT'
  | 'OTHER'
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertStatus = 'DRAFT' | 'ACTIVE' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED'
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type NotificationType =
  | 'ALERT'
  | 'ANNOUNCEMENT'
  | 'MESSAGE'
  | 'REQUEST'
  | 'INCIDENT'
  | 'FINE'
  | 'SYSTEM'
export type ConversationType = 'DIRECT' | 'GROUP' | 'SUPPORT'
export type RequestType =
  | 'MAINTENANCE'
  | 'SECURITY'
  | 'ADMINISTRATION'
  | 'PARKING'
  | 'NOISE'
  | 'COMMON_AREAS'
  | 'SERVICES'
  | 'OTHER'
export type RequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type IncidentType =
  | 'THEFT'
  | 'VANDALISM'
  | 'TRESPASSING'
  | 'NOISE'
  | 'FIRE'
  | 'FLOOD'
  | 'ACCIDENT'
  | 'MEDICAL'
  | 'PARKING'
  | 'PET'
  | 'OTHER'
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED'
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'
export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
export type FineStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'APPEALED'
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'MESSAGE_SENT'
  | 'ALERT_CREATED'
  | 'FINE_CREATED'
  | 'EXPENSE_CREATED'

export type MeetingType =
  | 'ASAMBLEA_GENERAL'
  | 'ASAMBLEA_EXTRAORDINARIA'
  | 'CONSEJO'
  | 'COMITE'
  | 'REUNION'
  | 'OTRO'

export type MeetingStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED'

export type ReportType = 'FINANCIERO' | 'OPERATIVO' | 'SEGURIDAD' | 'GESTION' | 'OTRO'

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
export type SelfRegisterRoleCode = 'OWNER' | 'TENANT' | 'BOTH'

export type RoleCode =
  | 'SUPER_ADMIN'
  | 'ADMINISTRATOR'
  | 'SPOKESPERSON'
  | 'OWNER'
  | 'TENANT'
  | 'SECURITY'
  | 'SERVICE_STAFF'

// ---------------------------------------------------------------------------
// ROWS
// ---------------------------------------------------------------------------
export interface ProfileRow {
  id: string
  email: string
  full_name: string
  document_type: string | null
  document_number: string | null
  phone: string | null
  avatar_url: string | null
  status: UserStatus
  metadata: Json
  created_at: string
  updated_at: string
}

export interface RoleRow {
  id: string
  code: RoleCode
  name: string
  description: string | null
  level: number
  is_global: boolean
  created_at: string
  updated_at: string
}

export interface UserRoleRow {
  id: string
  user_id: string
  role_id: string
  created_at: string
  updated_at: string
}

export interface CondominiumRow {
  id: string
  name: string
  nit: string | null
  address: string | null
  city: string | null
  country: string
  phone: string | null
  email: string | null
  logo_url: string | null
  description: string | null
  status: CondominiumStatus
  settings: Json
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CondominiumMemberRow {
  id: string
  condominium_id: string
  user_id: string
  role_id: string
  status: MemberStatus
  position: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export interface BuildingRow {
  id: string
  condominium_id: string
  name: string
  number: string
  description: string | null
  floors: number
  status: BuildingStatus
  created_at: string
  updated_at: string
}

export interface ApartmentRow {
  id: string
  condominium_id: string
  building_id: string
  number: string
  floor: number
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking_spots: number
  coefficient: number | null
  status: ApartmentStatus
  description: string | null
  created_at: string
  updated_at: string
}

export interface ApartmentOwnerRow {
  id: string
  apartment_id: string
  profile_id: string
  ownership_percentage: number
  is_primary: boolean
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ApartmentTenantRow {
  id: string
  apartment_id: string
  profile_id: string
  lease_start: string
  lease_end: string | null
  monthly_rent: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ResidentRow {
  id: string
  condominium_id: string
  apartment_id: string
  profile_id: string | null
  full_name: string
  document_number: string | null
  relationship: ResidentRelationship
  birth_date: string | null
  phone: string | null
  email: string | null
  emergency_phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VehicleRow {
  id: string
  condominium_id: string
  apartment_id: string
  resident_id: string | null
  type: VehicleType
  brand: string | null
  model: string | null
  color: string | null
  plate: string
  parking_spot: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PetRow {
  id: string
  condominium_id: string
  apartment_id: string
  name: string
  type: PetType
  breed: string | null
  color: string | null
  weight: number | null
  vaccinated: boolean
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AlertRow {
  id: string
  condominium_id: string
  building_id: string | null
  apartment_id: string | null
  title: string
  description: string
  type: AlertType
  priority: PriorityLevel
  status: AlertStatus
  audience: AudienceType
  audience_role_id: string | null
  start_at: string
  end_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementRow {
  id: string
  condominium_id: string
  building_id: string | null
  apartment_id: string | null
  title: string
  content: string
  image_url: string | null
  attachments: Json
  audience: AudienceType
  audience_role_id: string | null
  status: AnnouncementStatus
  published_at: string
  expires_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationRow {
  id: string
  condominium_id: string | null
  user_id: string
  title: string
  body: string | null
  type: NotificationType
  priority: PriorityLevel
  entity: string | null
  entity_id: string | null
  link: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface ConversationRow {
  id: string
  condominium_id: string
  subject: string
  type: ConversationType
  last_message_at: string
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConversationParticipantRow {
  id: string
  conversation_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  condominium_id: string | null
  sender_id: string
  body: string
  attachments: Json
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface RequestRow {
  id: string
  condominium_id: string
  building_id: string | null
  apartment_id: string | null
  code: string | null
  title: string
  description: string
  type: RequestType
  priority: PriorityLevel
  status: RequestStatus
  attachments: Json
  created_by: string | null
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface RequestCommentRow {
  id: string
  request_id: string
  author_id: string | null
  body: string
  attachments: Json
  is_internal: boolean
  created_at: string
  updated_at: string
}

export interface IncidentRow {
  id: string
  condominium_id: string
  building_id: string | null
  apartment_id: string | null
  code: string | null
  type: IncidentType
  title: string
  description: string
  location: string | null
  occurred_at: string
  priority: PriorityLevel
  status: IncidentStatus
  evidence: Json
  resolution: string | null
  reported_by: string | null
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseCategoryRow {
  id: string
  condominium_id: string
  name: string
  code: string | null
  color: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseRow {
  id: string
  condominium_id: string
  category_id: string | null
  concept: string
  provider: string | null
  amount: number
  expense_date: string
  invoice_number: string | null
  document_url: string | null
  description: string | null
  status: ExpenseStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseRow {
  id: string
  condominium_id: string
  code: string | null
  provider: string
  purchase_date: string
  total: number
  status: PurchaseStatus
  invoice_number: string | null
  document_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseItemRow {
  id: string
  purchase_id: string
  product: string
  description: string | null
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
  updated_at: string
}

export interface FineRow {
  id: string
  condominium_id: string
  apartment_id: string
  resident_id: string | null
  reason: string
  description: string | null
  amount: number
  fine_date: string
  due_date: string | null
  status: FineStatus
  evidence: Json
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DocumentCategoryRow {
  id: string
  condominium_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  condominium_id: string
  category_id: string | null
  building_id: string | null
  apartment_id: string | null
  title: string
  description: string | null
  bucket: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string | null
  visibility: AudienceType
  is_restricted: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface AuditLogRow {
  id: string
  condominium_id: string | null
  user_id: string | null
  action: AuditAction
  entity: string
  entity_id: string | null
  metadata: Json
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface MeetingRow {
  id: string
  condominium_id: string
  title: string
  meeting_type: MeetingType
  description: string | null
  agenda: Json
  scheduled_at: string
  location: string | null
  status: MeetingStatus
  document_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MeetingSignatureRow {
  id: string
  meeting_id: string
  profile_id: string | null
  full_name: string
  document_type: string | null
  document_number: string | null
  role: string | null
  signature_bucket: string
  signature_path: string
  signed_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReportRow {
  id: string
  condominium_id: string
  title: string
  report_type: ReportType
  description: string | null
  period_from: string | null
  period_to: string | null
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReportImageRow {
  id: string
  report_id: string
  caption: string | null
  bucket: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
}

export interface RegistrationRequestRow {
  id: string
  condominium_id: string
  profile_id: string
  building_id: string
  apartment_id: string
  requested_role: SelfRegisterRoleCode
  vehicles: Json
  status: RegistrationStatus
  applicant_note: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface CondominiumInvitationRow {
  id: string
  condominium_id: string
  email: string
  role_id: string
  position: string | null
  apartment_id: string | null
  status: InvitationStatus
  invited_by: string | null
  accepted_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// DATABASE
// ---------------------------------------------------------------------------
interface TableDef<TRow, TRequired extends keyof TRow = never> {
  Row: TRow
  Insert: InsertOf<TRow, TRequired>
  Update: UpdateOf<TRow>
  Relationships: []
}

export interface Database {
  tribuia: {
    Tables: {
      profiles: TableDef<ProfileRow, 'id' | 'email' | 'full_name'>
      roles: TableDef<RoleRow, 'code' | 'name'>
      user_roles: TableDef<UserRoleRow, 'user_id' | 'role_id'>
      condominiums: TableDef<CondominiumRow, 'name'>
      condominium_members: TableDef<CondominiumMemberRow, 'condominium_id' | 'user_id' | 'role_id'>
      buildings: TableDef<BuildingRow, 'condominium_id' | 'name' | 'number'>
      apartments: TableDef<ApartmentRow, 'condominium_id' | 'building_id' | 'number'>
      apartment_owners: TableDef<ApartmentOwnerRow, 'apartment_id' | 'profile_id'>
      apartment_tenants: TableDef<ApartmentTenantRow, 'apartment_id' | 'profile_id'>
      residents: TableDef<ResidentRow, 'condominium_id' | 'apartment_id' | 'full_name'>
      vehicles: TableDef<VehicleRow, 'condominium_id' | 'apartment_id' | 'plate'>
      pets: TableDef<PetRow, 'condominium_id' | 'apartment_id' | 'name'>
      alerts: TableDef<AlertRow, 'condominium_id' | 'title' | 'description'>
      announcements: TableDef<AnnouncementRow, 'condominium_id' | 'title' | 'content'>
      notifications: TableDef<NotificationRow, 'user_id' | 'title'>
      conversations: TableDef<ConversationRow, 'condominium_id'>
      conversation_participants: TableDef<ConversationParticipantRow, 'conversation_id' | 'user_id'>
      messages: TableDef<MessageRow, 'conversation_id' | 'sender_id' | 'body'>
      requests: TableDef<RequestRow, 'condominium_id' | 'title' | 'description'>
      request_comments: TableDef<RequestCommentRow, 'request_id' | 'body'>
      incidents: TableDef<IncidentRow, 'condominium_id' | 'title' | 'description'>
      expense_categories: TableDef<ExpenseCategoryRow, 'condominium_id' | 'name'>
      expenses: TableDef<ExpenseRow, 'condominium_id' | 'concept'>
      purchases: TableDef<PurchaseRow, 'condominium_id' | 'provider'>
      purchase_items: TableDef<PurchaseItemRow, 'purchase_id' | 'product'>
      fines: TableDef<FineRow, 'condominium_id' | 'apartment_id' | 'reason'>
      document_categories: TableDef<DocumentCategoryRow, 'condominium_id' | 'name'>
      documents: TableDef<
        DocumentRow,
        'condominium_id' | 'title' | 'file_path' | 'file_name'
      >
      audit_logs: TableDef<AuditLogRow, 'action' | 'entity'>
      registration_requests: TableDef<
        RegistrationRequestRow,
        'condominium_id' | 'profile_id' | 'building_id' | 'apartment_id' | 'requested_role'
      >
      condominium_invitations: TableDef<
        CondominiumInvitationRow,
        'condominium_id' | 'email' | 'role_id'
      >
      meetings: TableDef<MeetingRow, 'condominium_id' | 'title'>
      meeting_signatures: TableDef<MeetingSignatureRow, 'meeting_id' | 'full_name'>
      reports: TableDef<ReportRow, 'condominium_id' | 'title'>
      report_images: TableDef<ReportImageRow, 'report_id' | 'file_path' | 'file_name'>
    }
    Views: Record<never, never>
    Functions: {
      is_super_admin: { Args: { p_user?: string }; Returns: boolean }
      is_condominium_admin: { Args: { p_condominium: string }; Returns: boolean }
      user_can_access_condominium: { Args: { p_condominium: string }; Returns: boolean }
      condominium_dashboard_stats: { Args: { p_condominium: string }; Returns: Json }
      resident_dashboard: { Args: { p_condominium: string }; Returns: Json }
      current_user_context: { Args: Record<string, never>; Returns: Json }
      mark_all_notifications_read: { Args: { p_condominium?: string }; Returns: number }
      add_member_by_email: {
        Args: {
          p_condominium: string
          p_email: string
          p_role_code: string
          p_position?: string | null
        }
        Returns: string
      }
      find_profile_by_email: {
        Args: { p_email: string }
        Returns: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          phone: string | null
        }[]
      }
      expenses_monthly_series: {
        Args: { p_condominium: string; p_months?: number }
        Returns: { period: string; total: number }[]
      }
      expenses_by_category: {
        Args: { p_condominium: string }
        Returns: { category: string; color: string; total: number }[]
      }
      global_search: {
        Args: { p_condominium: string; p_term: string }
        Returns: {
          kind: string
          id: string
          title: string
          subtitle: string | null
          created_at: string
        }[]
      }
      registration_catalog: { Args: Record<string, never>; Returns: Json }
      registration_buildings: { Args: { p_condominium: string }; Returns: Json }
      registration_apartments: { Args: { p_building: string }; Returns: Json }
      complete_self_registration: {
        Args: {
          p_condominium: string
          p_building: string
          p_apartment: string
          p_user_type: string
          p_vehicles?: Json
          p_note?: string | null
        }
        Returns: Json
      }
      my_registration_request: { Args: Record<string, never>; Returns: Json }
      registration_requests_for_review: {
        Args: { p_condominium: string; p_status?: string }
        Returns: Json
      }
      approve_registration_request: {
        Args: { p_request: string; p_notes?: string | null }
        Returns: Json
      }
      reject_registration_request: {
        Args: { p_request: string; p_reason: string }
        Returns: Json
      }
      create_invitation: {
        Args: {
          p_condominium: string
          p_email: string
          p_role_code: string
          p_position?: string | null
          p_apartment?: string | null
        }
        Returns: Json
      }
      revoke_invitation: { Args: { p_invitation: string }; Returns: Json }
      invitations_for_condominium: {
        Args: { p_condominium: string; p_status?: string }
        Returns: Json
      }
      claim_my_invitations: { Args: Record<string, never>; Returns: Json }
    }
    Enums: {
      registration_status: RegistrationStatus
      invitation_status: InvitationStatus
      user_status: UserStatus
      member_status: MemberStatus
      condominium_status: CondominiumStatus
      building_status: BuildingStatus
      apartment_status: ApartmentStatus
      resident_relationship: ResidentRelationship
      vehicle_type: VehicleType
      pet_type: PetType
      audience_type: AudienceType
      alert_type: AlertType
      priority_level: PriorityLevel
      alert_status: AlertStatus
      announcement_status: AnnouncementStatus
      notification_type: NotificationType
      conversation_type: ConversationType
      request_type: RequestType
      request_status: RequestStatus
      incident_type: IncidentType
      incident_status: IncidentStatus
      expense_status: ExpenseStatus
      purchase_status: PurchaseStatus
      fine_status: FineStatus
      audit_action: AuditAction
      meeting_type: MeetingType
      meeting_status: MeetingStatus
      report_type: ReportType
    }
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database['tribuia']['Tables']> =
  Database['tribuia']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['tribuia']['Tables']> =
  Database['tribuia']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['tribuia']['Tables']> =
  Database['tribuia']['Tables'][T]['Update']

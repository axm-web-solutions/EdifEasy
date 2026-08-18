/**
 * Modelos de aplicacion: filas de la base de datos enriquecidas con las
 * relaciones que se traen en los `select` de cada servicio.
 */
import type {
  AlertRow,
  AnnouncementRow,
  ApartmentOwnerRow,
  ApartmentRow,
  ApartmentTenantRow,
  BuildingRow,
  CondominiumMemberRow,
  ConversationRow,
  DocumentRow,
  ExpenseRow,
  FineRow,
  IncidentRow,
  MessageRow,
  ProfileRow,
  PurchaseItemRow,
  PurchaseRow,
  RequestCommentRow,
  RequestRow,
  ResidentRow,
  RoleCode,
  RoleRow,
} from './database'

export type ProfileRef = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'avatar_url' | 'phone'>
export type BuildingRef = Pick<BuildingRow, 'id' | 'name' | 'number'>
export type ApartmentRef = Pick<ApartmentRow, 'id' | 'number' | 'floor' | 'building_id'>
export type RoleRef = Pick<RoleRow, 'id' | 'code' | 'name' | 'level'>

export interface ApartmentWithRelations extends ApartmentRow {
  building: BuildingRef | null
}

export interface MemberWithRelations extends CondominiumMemberRow {
  profile: ProfileRef | null
  role: RoleRef | null
}

export interface ResidentWithRelations extends ResidentRow {
  apartment: ApartmentRef | null
}

export interface OwnerWithProfile extends ApartmentOwnerRow {
  profile: ProfileRef | null
  apartment: ApartmentRef | null
}

export interface TenantWithProfile extends ApartmentTenantRow {
  profile: ProfileRef | null
  apartment: ApartmentRef | null
}

export interface AlertWithRelations extends AlertRow {
  author: ProfileRef | null
  building: BuildingRef | null
  apartment: ApartmentRef | null
}

export interface AnnouncementWithRelations extends AnnouncementRow {
  author: ProfileRef | null
}

export interface RequestWithRelations extends RequestRow {
  author: ProfileRef | null
  assignee: ProfileRef | null
  apartment: ApartmentRef | null
  building: BuildingRef | null
}

export interface RequestCommentWithAuthor extends RequestCommentRow {
  author: ProfileRef | null
}

export interface IncidentWithRelations extends IncidentRow {
  reporter: ProfileRef | null
  assignee: ProfileRef | null
  apartment: ApartmentRef | null
}

export interface ExpenseWithRelations extends ExpenseRow {
  category: { id: string; name: string; color: string } | null
  author: ProfileRef | null
}

export interface PurchaseWithRelations extends PurchaseRow {
  items: PurchaseItemRow[]
  author: ProfileRef | null
}

export interface FineWithRelations extends FineRow {
  apartment: ApartmentRef | null
  resident: { id: string; full_name: string } | null
}

export interface DocumentWithRelations extends DocumentRow {
  category: { id: string; name: string } | null
  uploader: ProfileRef | null
}

export interface ConversationWithRelations extends ConversationRow {
  participants: { user_id: string; last_read_at: string | null; profile: ProfileRef | null }[]
  messages: Pick<MessageRow, 'id' | 'body' | 'created_at' | 'sender_id'>[]
}

export interface MessageWithSender extends MessageRow {
  sender: ProfileRef | null
}

// ---------------------------------------------------------------------------
// Contexto de sesion
// ---------------------------------------------------------------------------
export interface Membership {
  id: string
  condominium_id: string
  condominium_name: string
  condominium_status: string
  role_id: string
  role_code: RoleCode
  role_name: string
  role_level: number
  status: string
  position: string | null
}

export interface UserContext {
  profile: ProfileRow | null
  is_super_admin: boolean
  memberships: Membership[]
  apartment_ids: string[]
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------
export interface AdminDashboardStats {
  apartments: number
  occupied_apartments: number
  buildings: number
  residents: number
  owners: number
  tenants: number
  active_alerts: number
  critical_alerts: number
  pending_requests: number
  open_incidents: number
  pending_fines: number
  pending_fines_amount: number
  month_expenses: number
  month_purchases: number
  vehicles: number
  pets: number
  documents: number
}

export interface ResidentApartment {
  id: string
  number: string
  floor: number
  status: string
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  building_id: string
  building_name: string
  building_number: string
}

export interface ResidentDashboardStats {
  apartments: ResidentApartment[]
  active_alerts: number
  announcements: number
  open_requests: number
  pending_fines: number
  pending_fines_amount: number
  unread_messages: number
  documents: number
  residents: number
  vehicles: number
  pets: number
}

// ---------------------------------------------------------------------------
// Listados
// ---------------------------------------------------------------------------
export type SortDirection = 'asc' | 'desc'

export type FilterValue = string | number | boolean | string[] | null | undefined

export interface ListParams {
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortDir?: SortDirection
  filters?: Record<string, FilterValue>
  dateField?: string
  dateFrom?: string | null
  dateTo?: string | null
}

export interface ListResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface SearchResultItem {
  kind: string
  id: string
  title: string
  subtitle: string | null
  created_at: string
}

/**
 * Metadato de un archivo guardado en Supabase Storage.
 * La firma de indice lo hace compatible con las columnas `jsonb`
 * (`attachments`, `evidence`) sin necesidad de conversiones.
 */
export interface AttachmentMeta {
  bucket: string
  path: string
  name: string
  size: number
  mime_type: string | null
  [key: string]: string | number | null | undefined
}

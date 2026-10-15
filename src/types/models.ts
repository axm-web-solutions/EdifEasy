/**
 * Modelos de aplicacion: filas de la base de datos enriquecidas con las
 * relaciones que se traen en los `select` de cada servicio.
 */
import type {
  AdminFeeRow,
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
  PaymentRow,
  PlanPeriod,
  ProfileRow,
  PurchaseItemRow,
  PurchaseRow,
  RequestCommentRow,
  RequestRow,
  ResidentRow,
  RoleCode,
  RoleRow,
  SubscriptionRow,
  VisitorRow,
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

export interface VisitorApartmentRef {
  id: string
  number: string
  floor: string | null
  building_id: string | null
  building: BuildingRef | null
}

export interface VisitorWithRelations extends VisitorRow {
  apartment: VisitorApartmentRef | null
  registeredBy: ProfileRef | null
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

export interface AdminFeeWithRelations extends AdminFeeRow {
  apartment: (ApartmentRef & { building: { id: string; name: string } | null }) | null
}

export interface PaymentWithRelations extends PaymentRow {
  payer: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null
}

/** Respuesta de `subscription_quote`: precio del plan segun el tamano del conjunto. */
export interface SubscriptionQuote {
  apartments_count: number
  unit_price: number
  plans: { period: PlanPeriod; months: number; amount: number }[]
  /** Ultimo periodo pagado (puede estar vencido). */
  current: SubscriptionRow | null
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
  condominium_logo_url: string | null
  condominium_primary_color: string | null
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

/**
 * Filtros de un listado sin paginacion ni orden: con ellos se piden los
 * totales agregados que acompanan a la tabla (resumenes en la base).
 */
export interface SummaryFilters {
  search: string
  filters: Record<string, FilterValue>
  dateFrom: string | null
  dateTo: string | null
}

/** Respuesta de `fines_summary`. */
export interface FinesSummary {
  pending_amount: number
  pending_count: number
  paid_amount: number
  paid_count: number
  appealed_count: number
  total_count: number
}

/** Respuesta de `admin_fees_summary`. `pending_*` incluye las vencidas. */
export interface AdminFeesSummary {
  paid_amount: number
  paid_count: number
  pending_amount: number
  pending_count: number
  /** Pendientes con fecha limite antes de hoy (hora de Colombia). */
  overdue_count: number
  overdue_amount: number
}

/** Respuesta de `expenses_summary`. */
export interface ExpensesSummary {
  total_amount: number
  pending_amount: number
  count: number
}

/** Respuesta de `platform_overview` (solo SUPER_ADMIN). */
export interface PlatformOverview {
  totals: {
    condominiums: number
    active_condominiums: number
    apartments: number
    users: number
    active_subscriptions: number
    expired_or_none: number
  }
  condominiums: PlatformCondominium[]
}

export interface PlatformCondominium {
  id: string
  name: string
  city: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  created_at: string
  apartments: number
  members: number
  owners: number
  admins: { full_name: string; email: string }[]
  plan: { period: PlanPeriod; ends_at: string; active: boolean } | null
  last_payment_at: string | null
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

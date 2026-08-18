-- ============================================================================
-- EdiFeasy :: Esquema completo de base de datos (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- Ejecutar COMPLETO desde: Supabase Dashboard -> SQL Editor -> New query.
-- Es idempotente: puede ejecutarse varias veces sin romper el estado.
--
-- TODO el proyecto vive en el esquema `tribuia` (no en `public`), para poder
-- convivir con otras aplicaciones en la misma base de datos.
--
-- IMPORTANTE: despues de ejecutar este archivo debes exponer el esquema en la
-- API REST: Dashboard -> Settings -> API -> "Exposed schemas" -> agrega `tribuia`.
-- Sin ese paso PostgREST devolvera "The schema must be one of the following".
--
-- Contenido:
--   0. Esquema
--   1. Extensiones
--   2. Tipos ENUM
--   3. Tablas
--   4. Indices
--   5. Funciones auxiliares (incluidas las usadas por RLS)
--   6. Triggers (updated_at, auditoria, totales, codigos, perfiles)
--   7. Row Level Security (habilitacion + politicas)
--   8. Storage (buckets + politicas)
--   9. Realtime (publicacion)
--  10. Datos estructurales (catalogo de roles)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ESQUEMA
-- ----------------------------------------------------------------------------
create schema if not exists tribuia;

grant usage on schema tribuia to postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- ----------------------------------------------------------------------------
-- 2. TIPOS ENUM
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'user_status') then
    create type tribuia.user_status as enum ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'member_status') then
    create type tribuia.member_status as enum ('ACTIVE', 'INACTIVE', 'PENDING');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'condominium_status') then
    create type tribuia.condominium_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'building_status') then
    create type tribuia.building_status as enum ('ACTIVE', 'INACTIVE');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'apartment_status') then
    create type tribuia.apartment_status as enum ('OCCUPIED', 'VACANT', 'MAINTENANCE', 'INACTIVE');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'resident_relationship') then
    create type tribuia.resident_relationship as enum ('OWNER', 'TENANT', 'FAMILY', 'EMPLOYEE', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'vehicle_type') then
    create type tribuia.vehicle_type as enum ('CAR', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'pet_type') then
    create type tribuia.pet_type as enum ('DOG', 'CAT', 'BIRD', 'FISH', 'REPTILE', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'audience_type') then
    create type tribuia.audience_type as enum ('CONDOMINIUM', 'BUILDING', 'APARTMENT', 'ROLE');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'alert_type') then
    create type tribuia.alert_type as enum (
      'EMERGENCY', 'SECURITY', 'MAINTENANCE', 'WATER', 'ELECTRICITY',
      'GAS', 'ADMINISTRATION', 'COMMUNITY', 'PAYMENT', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'priority_level') then
    create type tribuia.priority_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'alert_status') then
    create type tribuia.alert_status as enum ('DRAFT', 'ACTIVE', 'RESOLVED', 'EXPIRED', 'CANCELLED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'announcement_status') then
    create type tribuia.announcement_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'notification_type') then
    create type tribuia.notification_type as enum (
      'ALERT', 'ANNOUNCEMENT', 'MESSAGE', 'REQUEST', 'INCIDENT', 'FINE', 'SYSTEM');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'conversation_type') then
    create type tribuia.conversation_type as enum ('DIRECT', 'GROUP', 'SUPPORT');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'request_type') then
    create type tribuia.request_type as enum (
      'MAINTENANCE', 'SECURITY', 'ADMINISTRATION', 'PARKING',
      'NOISE', 'COMMON_AREAS', 'SERVICES', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'request_status') then
    create type tribuia.request_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'incident_type') then
    create type tribuia.incident_type as enum (
      'THEFT', 'VANDALISM', 'TRESPASSING', 'NOISE', 'FIRE', 'FLOOD',
      'ACCIDENT', 'MEDICAL', 'PARKING', 'PET', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'incident_status') then
    create type tribuia.incident_status as enum ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'expense_status') then
    create type tribuia.expense_status as enum ('PENDING', 'APPROVED', 'PAID', 'REJECTED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'purchase_status') then
    create type tribuia.purchase_status as enum ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'fine_status') then
    create type tribuia.fine_status as enum ('PENDING', 'PAID', 'CANCELLED', 'APPEALED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'audit_action') then
    create type tribuia.audit_action as enum (
      'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD',
      'MESSAGE_SENT', 'ALERT_CREATED', 'FINE_CREATED', 'EXPENSE_CREATED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'meeting_type') then
    create type tribuia.meeting_type as enum (
      'ASAMBLEA_GENERAL', 'ASAMBLEA_EXTRAORDINARIA', 'CONSEJO', 'COMITE', 'REUNION', 'OTRO');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'meeting_status') then
    create type tribuia.meeting_status as enum (
      'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SIGNED');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'report_type') then
    create type tribuia.report_type as enum (
      'FINANCIERO', 'OPERATIVO', 'SEGURIDAD', 'GESTION', 'OTRO');
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 3. TABLAS
-- ----------------------------------------------------------------------------

-- 3.1 Perfiles (1-1 con auth.users) --------------------------------------------
create table if not exists tribuia.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text not null,
  document_type   text,
  document_number text,
  phone           text,
  avatar_url      text,
  status          tribuia.user_status not null default 'ACTIVE',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists profiles_email_key on tribuia.profiles (lower(email));

-- 3.2 Catalogo de roles --------------------------------------------------------
create table if not exists tribuia.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  level       integer not null default 0,
  is_global   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.3 Roles globales de usuario (SUPER_ADMIN) ----------------------------------
create table if not exists tribuia.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references tribuia.profiles (id) on delete cascade,
  role_id    uuid not null references tribuia.roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id)
);

-- 3.4 Condominios --------------------------------------------------------------
create table if not exists tribuia.condominiums (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nit         text,
  address     text,
  city        text,
  country     text not null default 'Colombia',
  phone       text,
  email       text,
  logo_url    text,
  description text,
  status      tribuia.condominium_status not null default 'ACTIVE',
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid references tribuia.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.5 Membresias (multi-tenancy) -----------------------------------------------
create table if not exists tribuia.condominium_members (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  user_id         uuid not null references tribuia.profiles (id) on delete cascade,
  role_id         uuid not null references tribuia.roles (id) on delete restrict,
  status          tribuia.member_status not null default 'ACTIVE',
  position        text,
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (condominium_id, user_id, role_id)
);

-- 3.6 Bloques ------------------------------------------------------------------
create table if not exists tribuia.buildings (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  name           text not null,
  number         text not null,
  description    text,
  floors         integer not null default 1,
  status         tribuia.building_status not null default 'ACTIVE',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (condominium_id, number)
);

-- 3.7 Apartamentos -------------------------------------------------------------
create table if not exists tribuia.apartments (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  building_id    uuid not null references tribuia.buildings (id) on delete cascade,
  number         text not null,
  floor          integer not null default 1,
  area           numeric(10, 2),
  bedrooms       integer,
  bathrooms      integer,
  parking_spots  integer not null default 0,
  coefficient    numeric(8, 5),
  status         tribuia.apartment_status not null default 'VACANT',
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (building_id, number)
);

-- 3.8 Propietarios --------------------------------------------------------------
create table if not exists tribuia.apartment_owners (
  id                   uuid primary key default gen_random_uuid(),
  apartment_id         uuid not null references tribuia.apartments (id) on delete cascade,
  profile_id           uuid not null references tribuia.profiles (id) on delete cascade,
  ownership_percentage numeric(5, 2) not null default 100,
  is_primary           boolean not null default true,
  start_date           date not null default current_date,
  end_date             date,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (apartment_id, profile_id)
);

-- 3.9 Arrendatarios -------------------------------------------------------------
create table if not exists tribuia.apartment_tenants (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references tribuia.apartments (id) on delete cascade,
  profile_id   uuid not null references tribuia.profiles (id) on delete cascade,
  lease_start  date not null default current_date,
  lease_end    date,
  monthly_rent numeric(14, 2),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (apartment_id, profile_id)
);

-- 3.10 Residentes ---------------------------------------------------------------
create table if not exists tribuia.residents (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  profile_id      uuid references tribuia.profiles (id) on delete set null,
  full_name       text not null,
  document_number text,
  relationship    tribuia.resident_relationship not null default 'FAMILY',
  birth_date      date,
  phone           text,
  email           text,
  emergency_phone text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (apartment_id, profile_id)
);

-- 3.11 Vehiculos ----------------------------------------------------------------
create table if not exists tribuia.vehicles (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  resident_id    uuid references tribuia.residents (id) on delete set null,
  type           tribuia.vehicle_type not null default 'CAR',
  brand          text,
  model          text,
  color          text,
  plate          text not null,
  parking_spot   text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.12 Mascotas -----------------------------------------------------------------
create table if not exists tribuia.pets (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  name           text not null,
  type           tribuia.pet_type not null default 'DOG',
  breed          text,
  color          text,
  weight         numeric(6, 2),
  vaccinated     boolean not null default false,
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.13 Alertas ------------------------------------------------------------------
create table if not exists tribuia.alerts (
  id               uuid primary key default gen_random_uuid(),
  condominium_id   uuid not null references tribuia.condominiums (id) on delete cascade,
  building_id      uuid references tribuia.buildings (id) on delete cascade,
  apartment_id     uuid references tribuia.apartments (id) on delete cascade,
  title            text not null,
  description      text not null,
  type             tribuia.alert_type not null default 'OTHER',
  priority         tribuia.priority_level not null default 'MEDIUM',
  status           tribuia.alert_status not null default 'ACTIVE',
  audience         tribuia.audience_type not null default 'CONDOMINIUM',
  audience_role_id uuid references tribuia.roles (id) on delete set null,
  start_at         timestamptz not null default now(),
  end_at           timestamptz,
  created_by       uuid references tribuia.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 3.14 Comunicados ---------------------------------------------------------------
create table if not exists tribuia.announcements (
  id               uuid primary key default gen_random_uuid(),
  condominium_id   uuid not null references tribuia.condominiums (id) on delete cascade,
  building_id      uuid references tribuia.buildings (id) on delete cascade,
  apartment_id     uuid references tribuia.apartments (id) on delete cascade,
  title            text not null,
  content          text not null,
  image_url        text,
  attachments      jsonb not null default '[]'::jsonb,
  audience         tribuia.audience_type not null default 'CONDOMINIUM',
  audience_role_id uuid references tribuia.roles (id) on delete set null,
  status           tribuia.announcement_status not null default 'PUBLISHED',
  published_at     timestamptz not null default now(),
  expires_at       timestamptz,
  created_by       uuid references tribuia.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 3.15 Notificaciones -------------------------------------------------------------
create table if not exists tribuia.notifications (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid references tribuia.condominiums (id) on delete cascade,
  user_id        uuid not null references tribuia.profiles (id) on delete cascade,
  title          text not null,
  body           text,
  type           tribuia.notification_type not null default 'SYSTEM',
  priority       tribuia.priority_level not null default 'MEDIUM',
  entity         text,
  entity_id      uuid,
  link           text,
  is_read        boolean not null default false,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- 3.16 Conversaciones -------------------------------------------------------------
create table if not exists tribuia.conversations (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  subject         text not null default 'Conversacion',
  type            tribuia.conversation_type not null default 'DIRECT',
  last_message_at timestamptz not null default now(),
  is_archived     boolean not null default false,
  created_by      uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists tribuia.conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references tribuia.conversations (id) on delete cascade,
  user_id         uuid not null references tribuia.profiles (id) on delete cascade,
  last_read_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists tribuia.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references tribuia.conversations (id) on delete cascade,
  condominium_id  uuid references tribuia.condominiums (id) on delete cascade,
  sender_id       uuid not null references tribuia.profiles (id) on delete cascade,
  body            text not null,
  attachments     jsonb not null default '[]'::jsonb,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3.17 Solicitudes -----------------------------------------------------------------
create table if not exists tribuia.requests (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  building_id    uuid references tribuia.buildings (id) on delete set null,
  apartment_id   uuid references tribuia.apartments (id) on delete set null,
  code           text,
  title          text not null,
  description    text not null,
  type           tribuia.request_type not null default 'OTHER',
  priority       tribuia.priority_level not null default 'MEDIUM',
  status         tribuia.request_status not null default 'OPEN',
  attachments    jsonb not null default '[]'::jsonb,
  created_by     uuid references tribuia.profiles (id) on delete set null,
  assigned_to    uuid references tribuia.profiles (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists tribuia.request_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references tribuia.requests (id) on delete cascade,
  author_id   uuid references tribuia.profiles (id) on delete set null,
  body        text not null,
  attachments jsonb not null default '[]'::jsonb,
  is_internal boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.18 Incidentes -------------------------------------------------------------------
create table if not exists tribuia.incidents (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  building_id    uuid references tribuia.buildings (id) on delete set null,
  apartment_id   uuid references tribuia.apartments (id) on delete set null,
  code           text,
  type           tribuia.incident_type not null default 'OTHER',
  title          text not null,
  description    text not null,
  location       text,
  occurred_at    timestamptz not null default now(),
  priority       tribuia.priority_level not null default 'MEDIUM',
  status         tribuia.incident_status not null default 'OPEN',
  evidence       jsonb not null default '[]'::jsonb,
  resolution     text,
  reported_by    uuid references tribuia.profiles (id) on delete set null,
  assigned_to    uuid references tribuia.profiles (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.19 Gastos ------------------------------------------------------------------------
create table if not exists tribuia.expense_categories (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  name           text not null,
  code           text,
  color          text not null default '#2559eb',
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (condominium_id, name)
);

create table if not exists tribuia.expenses (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  category_id    uuid references tribuia.expense_categories (id) on delete set null,
  concept        text not null,
  provider       text,
  amount         numeric(14, 2) not null default 0,
  expense_date   date not null default current_date,
  invoice_number text,
  document_url   text,
  description    text,
  status         tribuia.expense_status not null default 'PENDING',
  created_by     uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.20 Compras ------------------------------------------------------------------------
create table if not exists tribuia.purchases (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  code           text,
  provider       text not null,
  purchase_date  date not null default current_date,
  total          numeric(14, 2) not null default 0,
  status         tribuia.purchase_status not null default 'DRAFT',
  invoice_number text,
  document_url   text,
  notes          text,
  created_by     uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists tribuia.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references tribuia.purchases (id) on delete cascade,
  product     text not null,
  description text,
  quantity    numeric(12, 2) not null default 1,
  unit_price  numeric(14, 2) not null default 0,
  subtotal    numeric(16, 2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.21 Multas --------------------------------------------------------------------------
create table if not exists tribuia.fines (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  resident_id    uuid references tribuia.residents (id) on delete set null,
  reason         text not null,
  description    text,
  amount         numeric(14, 2) not null default 0,
  fine_date      date not null default current_date,
  due_date       date,
  status         tribuia.fine_status not null default 'PENDING',
  evidence       jsonb not null default '[]'::jsonb,
  notes          text,
  created_by     uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.22 Documentos ------------------------------------------------------------------------
create table if not exists tribuia.document_categories (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  name           text not null,
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (condominium_id, name)
);

create table if not exists tribuia.documents (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  category_id    uuid references tribuia.document_categories (id) on delete set null,
  building_id    uuid references tribuia.buildings (id) on delete cascade,
  apartment_id   uuid references tribuia.apartments (id) on delete cascade,
  title          text not null,
  description    text,
  bucket         text not null default 'documents',
  file_path      text not null,
  file_name      text not null,
  file_size      bigint not null default 0,
  mime_type      text,
  visibility     tribuia.audience_type not null default 'CONDOMINIUM',
  is_restricted  boolean not null default false,
  uploaded_by    uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.23 Auditoria ---------------------------------------------------------------------------
create table if not exists tribuia.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid references tribuia.condominiums (id) on delete cascade,
  user_id        uuid references tribuia.profiles (id) on delete set null,
  action         tribuia.audit_action not null,
  entity         text not null,
  entity_id      uuid,
  metadata       jsonb not null default '{}'::jsonb,
  ip_address     inet,
  user_agent     text,
  created_at     timestamptz not null default now()
);

-- 3.24 Actas / reuniones -------------------------------------------------------------------
-- Asambleas, consejos y reuniones con su acta (documento opcional ya firmado)
-- y el estado del ciclo de vida (borrador -> programada -> en curso -> firmada).
create table if not exists tribuia.meetings (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  title          text not null,
  meeting_type   tribuia.meeting_type not null default 'ASAMBLEA_GENERAL',
  description    text,
  agenda         jsonb not null default '[]'::jsonb,
  scheduled_at   timestamptz not null default now(),
  location       text,
  status         tribuia.meeting_status not null default 'DRAFT',
  document_id    uuid references tribuia.documents (id) on delete set null,
  created_by     uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.25 Firmas de actas ---------------------------------------------------------------------
-- Cada firma guarda la imagen (bucket `signatures`) y mantiene trazabilidad de
-- quien firmo, cuando y con que documento. `profile_id` puede ser null cuando el
-- firmante no tiene cuenta de usuario (asistente externo), por eso se guardan
-- full_name y document_number desnormalizados.
create table if not exists tribuia.meeting_signatures (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references tribuia.meetings (id) on delete cascade,
  profile_id       uuid references tribuia.profiles (id) on delete set null,
  full_name        text not null,
  document_type    text,
  document_number  text,
  role             text,
  signature_bucket text not null default 'signatures',
  signature_path   text not null,
  signed_at        timestamptz not null default now(),
  created_by       uuid references tribuia.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 3.26 Reportes persistidos ----------------------------------------------------------------
-- contenedor de un reporte generado/agendado (financiero, operativo, seguridad, etc.)
create table if not exists tribuia.reports (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  title          text not null,
  report_type    tribuia.report_type not null default 'GESTION',
  description    text,
  period_from    date,
  period_to      date,
  status         text not null default 'DRAFT',
  created_by     uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3.27 Imagenes de reportes ----------------------------------------------------------------
-- Evidencias graficas adjuntas a un reporte; se muestran en el modulo de reportes.
create table if not exists tribuia.report_images (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references tribuia.reports (id) on delete cascade,
  caption        text,
  bucket         text not null default 'report-images',
  file_path      text not null,
  file_name      text not null,
  file_size      bigint not null default 0,
  mime_type      text,
  uploaded_by    uuid references tribuia.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3.24 RECONCILIACION DE CONSTRAINTS
-- ----------------------------------------------------------------------------
-- `create table if not exists` no modifica tablas que ya existen, asi que los
-- constraints agregados al esquema despues del primer despliegue no llegan a la
-- base. Este bloque los reconcilia para que re-ejecutar este archivo deje la
-- base siempre alineada con el modelo.
do $reconcile$
declare
  v_dupes integer := 0;
begin
  -- Deduplicar primero. Si el constraint ya existe no puede haber duplicados,
  -- asi que esta sentencia no borra nada y es segura de repetir.
  with ranked as (
    select id,
           row_number() over (
             partition by apartment_id, profile_id order by created_at, id
           ) as rn
    from tribuia.residents
    where profile_id is not null
  )
  delete from tribuia.residents r
  using ranked
  where r.id = ranked.id and ranked.rn > 1;

  get diagnostics v_dupes = row_count;

  alter table tribuia.residents
    add constraint residents_apartment_id_profile_id_key unique (apartment_id, profile_id);

  raise notice 'residents: constraint unique(apartment_id, profile_id) agregado. Duplicados eliminados: %', v_dupes;
exception
  -- Ya existia: es el caso normal en una base creada desde cero.
  when duplicate_table or duplicate_object then
    raise notice 'residents: el constraint unique(apartment_id, profile_id) ya existia.';
end
$reconcile$;

-- ----------------------------------------------------------------------------
-- 4. INDICES
-- ----------------------------------------------------------------------------
create index if not exists idx_user_roles_user on tribuia.user_roles (user_id);
create index if not exists idx_members_condominium on tribuia.condominium_members (condominium_id);
create index if not exists idx_members_user on tribuia.condominium_members (user_id);
create index if not exists idx_members_role on tribuia.condominium_members (role_id);
create index if not exists idx_buildings_condominium on tribuia.buildings (condominium_id);
create index if not exists idx_apartments_condominium on tribuia.apartments (condominium_id);
create index if not exists idx_apartments_building on tribuia.apartments (building_id);
create index if not exists idx_apartment_owners_apartment on tribuia.apartment_owners (apartment_id);
create index if not exists idx_apartment_owners_profile on tribuia.apartment_owners (profile_id);
create index if not exists idx_apartment_tenants_apartment on tribuia.apartment_tenants (apartment_id);
create index if not exists idx_apartment_tenants_profile on tribuia.apartment_tenants (profile_id);
create index if not exists idx_residents_apartment on tribuia.residents (apartment_id);
create index if not exists idx_residents_condominium on tribuia.residents (condominium_id);
create index if not exists idx_residents_profile on tribuia.residents (profile_id);
create index if not exists idx_vehicles_apartment on tribuia.vehicles (apartment_id);
create index if not exists idx_vehicles_condominium on tribuia.vehicles (condominium_id);
create unique index if not exists idx_vehicles_plate on tribuia.vehicles (condominium_id, upper(plate));
create index if not exists idx_pets_apartment on tribuia.pets (apartment_id);
create index if not exists idx_pets_condominium on tribuia.pets (condominium_id);
create index if not exists idx_alerts_condominium on tribuia.alerts (condominium_id, status, priority);
create index if not exists idx_alerts_created_at on tribuia.alerts (created_at desc);
create index if not exists idx_announcements_condominium on tribuia.announcements (condominium_id, status);
create index if not exists idx_notifications_user on tribuia.notifications (user_id, is_read, created_at desc);
create index if not exists idx_conversations_condominium on tribuia.conversations (condominium_id, last_message_at desc);
create index if not exists idx_participants_user on tribuia.conversation_participants (user_id);
create index if not exists idx_participants_conversation on tribuia.conversation_participants (conversation_id);
create index if not exists idx_messages_conversation on tribuia.messages (conversation_id, created_at);
create index if not exists idx_requests_condominium on tribuia.requests (condominium_id, status);
create index if not exists idx_requests_apartment on tribuia.requests (apartment_id);
create index if not exists idx_requests_created_by on tribuia.requests (created_by);
create index if not exists idx_request_comments_request on tribuia.request_comments (request_id, created_at);
create index if not exists idx_incidents_condominium on tribuia.incidents (condominium_id, status);
create index if not exists idx_incidents_apartment on tribuia.incidents (apartment_id);
create index if not exists idx_expense_categories_condominium on tribuia.expense_categories (condominium_id);
create index if not exists idx_expenses_condominium on tribuia.expenses (condominium_id, expense_date desc);
create index if not exists idx_expenses_category on tribuia.expenses (category_id);
create index if not exists idx_purchases_condominium on tribuia.purchases (condominium_id, purchase_date desc);
create index if not exists idx_purchase_items_purchase on tribuia.purchase_items (purchase_id);
create index if not exists idx_fines_condominium on tribuia.fines (condominium_id, status);
create index if not exists idx_fines_apartment on tribuia.fines (apartment_id);
create index if not exists idx_document_categories_condominium on tribuia.document_categories (condominium_id);
create index if not exists idx_documents_condominium on tribuia.documents (condominium_id);
create index if not exists idx_documents_apartment on tribuia.documents (apartment_id);
create index if not exists idx_audit_condominium on tribuia.audit_logs (condominium_id, created_at desc);
create index if not exists idx_audit_entity on tribuia.audit_logs (entity, entity_id);
create index if not exists idx_audit_user on tribuia.audit_logs (user_id, created_at desc);

-- Indices de trazabilidad: folios consecutivos unicos por negocio.
-- `code` se genera por trigger con nextval(), por lo que un indice parcial
-- (solo filas con codigo) garantiza que no existan duplicados en el folio.
create unique index if not exists idx_requests_code_unique on tribuia.requests (code) where code is not null;
create unique index if not exists idx_incidents_code_unique on tribuia.incidents (code) where code is not null;
create unique index if not exists idx_purchases_code_unique on tribuia.purchases (code) where code is not null;

create index if not exists idx_meetings_condominium on tribuia.meetings (condominium_id, scheduled_at desc);
create index if not exists idx_meetings_status on tribuia.meetings (status);
create index if not exists idx_meeting_signatures_meeting on tribuia.meeting_signatures (meeting_id);
create index if not exists idx_meeting_signatures_profile on tribuia.meeting_signatures (profile_id);
-- Un miembro firma una sola vez por acta (por id de perfil o por documento).
create unique index if not exists uq_meeting_signatures_profile
  on tribuia.meeting_signatures (meeting_id, profile_id) where profile_id is not null;
create unique index if not exists uq_meeting_signatures_document
  on tribuia.meeting_signatures (meeting_id, lower(trim(document_number))) where document_number is not null;
create index if not exists idx_reports_condominium on tribuia.reports (condominium_id, created_at desc);
create index if not exists idx_reports_status on tribuia.reports (status);
create index if not exists idx_report_images_report on tribuia.report_images (report_id);

-- ----------------------------------------------------------------------------
-- 5. FUNCIONES AUXILIARES
-- ----------------------------------------------------------------------------
-- Todas las funciones consultadas por RLS son SECURITY DEFINER para evitar
-- recursion infinita entre politicas y para poder resolver membresias.

create or replace function tribuia.is_super_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (
    select 1
    from tribuia.user_roles ur
    join tribuia.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.code = 'SUPER_ADMIN'
  );
$$;

create or replace function tribuia.user_condominium_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select distinct m.condominium_id
  from tribuia.condominium_members m
  where m.user_id = p_user and m.status = 'ACTIVE';
$$;

create or replace function tribuia.user_can_access_condominium(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p_condominium is not null and (
    tribuia.is_super_admin(p_user)
    or exists (
      select 1 from tribuia.condominium_members m
      where m.condominium_id = p_condominium
        and m.user_id = p_user
        and m.status = 'ACTIVE'
    )
  );
$$;

-- Alias semantico solicitado en la especificacion
create or replace function tribuia.is_condominium_member(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.user_can_access_condominium(p_condominium, p_user);
$$;

create or replace function tribuia.has_role(
  p_condominium uuid,
  p_codes text[],
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.is_super_admin(p_user)
    or exists (
      select 1
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id
      where m.condominium_id = p_condominium
        and m.user_id = p_user
        and m.status = 'ACTIVE'
        and r.code = any (p_codes)
    );
$$;

create or replace function tribuia.user_has_role_id(
  p_condominium uuid,
  p_role uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p_role is not null and exists (
    select 1 from tribuia.condominium_members m
    where m.condominium_id = p_condominium
      and m.user_id = p_user
      and m.role_id = p_role
      and m.status = 'ACTIVE'
  );
$$;

create or replace function tribuia.is_condominium_admin(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR'], p_user);
$$;

create or replace function tribuia.user_owns_apartment(
  p_apartment uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (
    select 1 from tribuia.apartment_owners ao
    where ao.apartment_id = p_apartment
      and ao.profile_id = p_user
      and ao.is_active
  );
$$;

create or replace function tribuia.user_is_tenant(
  p_apartment uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (
    select 1 from tribuia.apartment_tenants at
    where at.apartment_id = p_apartment
      and at.profile_id = p_user
      and at.is_active
  );
$$;

create or replace function tribuia.user_apartment_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select apartment_id from tribuia.apartment_owners where profile_id = p_user and is_active
  union
  select apartment_id from tribuia.apartment_tenants where profile_id = p_user and is_active
  union
  select apartment_id from tribuia.residents where profile_id = p_user and is_active;
$$;

create or replace function tribuia.user_building_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select distinct a.building_id
  from tribuia.apartments a
  where a.id in (select tribuia.user_apartment_ids(p_user));
$$;

create or replace function tribuia.user_can_access_apartment(
  p_apartment uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p_apartment is not null and (
    tribuia.is_super_admin(p_user)
    or exists (
      select 1 from tribuia.apartments a
      where a.id = p_apartment
        and tribuia.has_role(
              a.condominium_id,
              array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'],
              p_user)
    )
    or p_apartment in (select tribuia.user_apartment_ids(p_user))
  );
$$;

create or replace function tribuia.apartment_condominium(p_apartment uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select a.condominium_id from tribuia.apartments a where a.id = p_apartment;
$$;

-- Finanzas: quien puede VER y quien puede GESTIONAR
create or replace function tribuia.can_view_finance(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER'], p_user);
$$;

create or replace function tribuia.can_manage_finance(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR'], p_user);
$$;

create or replace function tribuia.shares_condominium(
  p_target uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p_target = p_user
    or tribuia.is_super_admin(p_user)
    or exists (
      select 1
      from tribuia.condominium_members a
      join tribuia.condominium_members b on a.condominium_id = b.condominium_id
      where a.user_id = p_user and b.user_id = p_target
        and a.status = 'ACTIVE' and b.status = 'ACTIVE'
    );
$$;

create or replace function tribuia.is_conversation_participant(
  p_conversation uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (
    select 1 from tribuia.conversation_participants cp
    where cp.conversation_id = p_conversation and cp.user_id = p_user
  );
$$;

create or replace function tribuia.conversation_condominium(p_conversation uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select c.condominium_id from tribuia.conversations c where c.id = p_conversation;
$$;

create or replace function tribuia.request_condominium(p_request uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select r.condominium_id from tribuia.requests r where r.id = p_request;
$$;

create or replace function tribuia.request_owner(p_request uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select r.created_by from tribuia.requests r where r.id = p_request;
$$;

create or replace function tribuia.request_apartment(p_request uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select r.apartment_id from tribuia.requests r where r.id = p_request;
$$;

create or replace function tribuia.purchase_condominium(p_purchase uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p.condominium_id from tribuia.purchases p where p.id = p_purchase;
$$;

create or replace function tribuia.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- Estadisticas del dashboard administrativo (una sola consulta)
create or replace function tribuia.condominium_dashboard_stats(p_condominium uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = tribuia, public, pg_temp
as $$
declare
  result jsonb;
begin
  if not tribuia.user_can_access_condominium(p_condominium) then
    raise exception 'No autorizado para consultar este condominio';
  end if;

  select jsonb_build_object(
    'apartments', (select count(*) from tribuia.apartments where condominium_id = p_condominium),
    'occupied_apartments', (select count(*) from tribuia.apartments where condominium_id = p_condominium and status = 'OCCUPIED'),
    'buildings', (select count(*) from tribuia.buildings where condominium_id = p_condominium),
    'residents', (select count(*) from tribuia.residents where condominium_id = p_condominium and is_active),
    'owners', (select count(distinct ao.profile_id) from tribuia.apartment_owners ao join tribuia.apartments a on a.id = ao.apartment_id where a.condominium_id = p_condominium and ao.is_active),
    'tenants', (select count(distinct t.profile_id) from tribuia.apartment_tenants t join tribuia.apartments a on a.id = t.apartment_id where a.condominium_id = p_condominium and t.is_active),
    'active_alerts', (select count(*) from tribuia.alerts where condominium_id = p_condominium and status = 'ACTIVE'),
    'critical_alerts', (select count(*) from tribuia.alerts where condominium_id = p_condominium and status = 'ACTIVE' and priority = 'CRITICAL'),
    'pending_requests', (select count(*) from tribuia.requests where condominium_id = p_condominium and status in ('OPEN', 'IN_PROGRESS')),
    'open_incidents', (select count(*) from tribuia.incidents where condominium_id = p_condominium and status in ('OPEN', 'INVESTIGATING')),
    'pending_fines', (select count(*) from tribuia.fines where condominium_id = p_condominium and status = 'PENDING'),
    'pending_fines_amount', (select coalesce(sum(amount), 0) from tribuia.fines where condominium_id = p_condominium and status = 'PENDING'),
    'month_expenses', (select coalesce(sum(amount), 0) from tribuia.expenses where condominium_id = p_condominium and expense_date >= date_trunc('month', current_date)),
    'month_purchases', (select coalesce(sum(total), 0) from tribuia.purchases where condominium_id = p_condominium and purchase_date >= date_trunc('month', current_date)),
    'vehicles', (select count(*) from tribuia.vehicles where condominium_id = p_condominium and is_active),
    'pets', (select count(*) from tribuia.pets where condominium_id = p_condominium and is_active),
    'documents', (select count(*) from tribuia.documents where condominium_id = p_condominium)
  ) into result;

  return result;
end;
$$;

create or replace function tribuia.expenses_monthly_series(p_condominium uuid, p_months integer default 6)
returns table (period text, total numeric)
language sql
stable
security invoker
set search_path = tribuia, public, pg_temp
as $$
  select to_char(date_trunc('month', e.expense_date), 'YYYY-MM') as period,
         coalesce(sum(e.amount), 0) as total
  from tribuia.expenses e
  where e.condominium_id = p_condominium
    and e.expense_date >= date_trunc('month', current_date) - make_interval(months => greatest(p_months, 1) - 1)
  group by 1
  order by 1;
$$;

create or replace function tribuia.expenses_by_category(p_condominium uuid)
returns table (category text, color text, total numeric)
language sql
stable
security invoker
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(c.name, 'Sin categoria') as category,
         coalesce(c.color, '#94a3b8') as color,
         coalesce(sum(e.amount), 0) as total
  from tribuia.expenses e
  left join tribuia.expense_categories c on c.id = e.category_id
  where e.condominium_id = p_condominium
  group by 1, 2
  order by 3 desc;
$$;

create or replace function tribuia.global_search(p_condominium uuid, p_term text)
returns table (
  kind text,
  id uuid,
  title text,
  subtitle text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = tribuia, public, pg_temp
as $$
  with term as (select '%' || lower(coalesce(p_term, '')) || '%' as q)
  (select 'apartment', a.id, 'Apto ' || a.number, b.name, a.created_at
     from tribuia.apartments a
     join tribuia.buildings b on b.id = a.building_id, term
    where a.condominium_id = p_condominium and lower(a.number) like term.q limit 8)
  union all
  (select 'building', b.id, b.name, 'Bloque ' || b.number, b.created_at
     from tribuia.buildings b, term
    where b.condominium_id = p_condominium and (lower(b.name) like term.q or lower(b.number) like term.q) limit 8)
  union all
  (select 'resident', r.id, r.full_name, coalesce(r.document_number, r.email), r.created_at
     from tribuia.residents r, term
    where r.condominium_id = p_condominium
      and (lower(r.full_name) like term.q or lower(coalesce(r.document_number, '')) like term.q) limit 8)
  union all
  (select 'request', rq.id, rq.title, coalesce(rq.code, rq.type::text), rq.created_at
     from tribuia.requests rq, term
    where rq.condominium_id = p_condominium
      and (lower(rq.title) like term.q or lower(coalesce(rq.code, '')) like term.q) limit 8)
  union all
  (select 'incident', i.id, i.title, coalesce(i.code, i.type::text), i.created_at
     from tribuia.incidents i, term
    where i.condominium_id = p_condominium
      and (lower(i.title) like term.q or lower(coalesce(i.code, '')) like term.q) limit 8)
  union all
  (select 'fine', f.id, f.reason, 'Multa', f.created_at
     from tribuia.fines f, term
    where f.condominium_id = p_condominium and lower(f.reason) like term.q limit 8)
  union all
  (select 'document', d.id, d.title, d.file_name, d.created_at
     from tribuia.documents d, term
    where d.condominium_id = p_condominium and lower(d.title) like term.q limit 8)
  union all
  (select 'alert', al.id, al.title, al.type::text, al.created_at
     from tribuia.alerts al, term
    where al.condominium_id = p_condominium and lower(al.title) like term.q limit 8);
$$;

-- 5.11 Integridad de referencia multi-tenant (trazabilidad) ------------------
-- Impide que una fila apunte a un <building_id> o <apartment_id> que no
-- pertenezca al <condominium_id> de la misma fila. Las FK simples solo validan
-- existencia; sin esta regla un edificio/apartamento de otro condominio podria
-- quedar atribuido a la fila y romper la trazabilidad de los datos. Funciona
-- con columnas opcionales (null = no se valida) y es compatible con el
-- ON DELETE SET NULL (no pierde el contexto de condominio al borrar la
-- referencia).
create or replace function tribuia.tg_assert_tenant_reference()
returns trigger
language plpgsql
as $$
declare
  v_row      jsonb;
  v_condo    uuid;
  v_building uuid;
  v_apart    uuid;
begin
  v_row := to_jsonb(new);

  if v_row ? 'condominium_id' then
    v_condo := (v_row->>'condominium_id')::uuid;
  end if;
  if v_condo is null then
    return new;
  end if;

  if v_row ? 'building_id' then
    v_building := (v_row->>'building_id')::uuid;
    if v_building is not null and not exists (
      select 1 from tribuia.buildings b
      where b.id = v_building and b.condominium_id = v_condo
    ) then
      raise exception 'El bloque % no pertenece al condominio %', v_building, v_condo
        using errcode = '23503';
    end if;
  end if;

  if v_row ? 'apartment_id' then
    v_apart := (v_row->>'apartment_id')::uuid;

    if v_apart is not null and not exists (
      select 1 from tribuia.apartments a
      where a.id = v_apart and a.condominium_id = v_condo
    ) then
      raise exception 'El apartamento % no pertenece al condominio %', v_apart, v_condo
        using errcode = '23503';
    end if;

    if v_building is not null and v_apart is not null and not exists (
      select 1 from tribuia.apartments a
      where a.id = v_apart and a.building_id = v_building
    ) then
      raise exception 'El apartamento % no pertenece al bloque %', v_apart, v_building
        using errcode = '23503';
    end if;
  end if;

  if v_row ? 'document_id' then
    if (v_row->>'document_id') is not null and not exists (
      select 1 from tribuia.documents d
      where d.id = (v_row->>'document_id')::uuid and d.condominium_id = v_condo
    ) then
      raise exception 'El documento % no pertenece al condominio %', (v_row->>'document_id')::uuid, v_condo
        using errcode = '23503';
    end if;
  end if;

  if v_row ? 'report_id' then
    if (v_row->>'report_id') is not null and not exists (
      select 1 from tribuia.reports r
      where r.id = (v_row->>'report_id')::uuid and r.condominium_id = v_condo
    ) then
      raise exception 'El reporte % no pertenece al condominio %', (v_row->>'report_id')::uuid, v_condo
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'apartments', 'residents', 'vehicles', 'pets', 'alerts', 'announcements',
    'documents', 'requests', 'incidents', 'fines', 'meetings', 'report_images'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_tenant_ref on tribuia.%1$I', t);
    execute format(
      'create trigger trg_%1$s_tenant_ref before insert or update on tribuia.%1$I
       for each row execute function tribuia.tg_assert_tenant_reference()', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS
-- ----------------------------------------------------------------------------

-- 6.1 updated_at ---------------------------------------------------------------
create or replace function tribuia.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'roles', 'user_roles', 'condominiums', 'condominium_members',
    'buildings', 'apartments', 'apartment_owners', 'apartment_tenants', 'residents',
    'vehicles', 'pets', 'alerts', 'announcements', 'conversations',
    'conversation_participants', 'messages', 'requests', 'request_comments',
    'incidents', 'expense_categories', 'expenses', 'purchases', 'purchase_items',
    'fines', 'document_categories', 'documents', 'meetings', 'meeting_signatures',
    'reports'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on tribuia.%1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on tribuia.%1$I
       for each row execute function tribuia.set_updated_at()', t);
  end loop;
end
$$;

-- 6.2 Perfil automatico al registrar usuario en auth ---------------------------
-- El autoregistro solo permite OWNER o TENANT: los demas roles (ADMINISTRATOR,
-- SPOKESPERSON, SECURITY, SERVICE_STAFF, SUPER_ADMIN) solo pueden asignarse por
-- un administrador mediante `add_member_by_email` o la Edge Function
-- `invite-member`. El rol solicitado queda en `profiles.metadata.requested_role`.
create or replace function tribuia.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_requested_role text;
begin
  v_requested_role := nullif(new.raw_user_meta_data ->> 'requested_role', '');

  if v_requested_role is not null and v_requested_role not in ('OWNER', 'TENANT', 'BOTH') then
    raise exception 'Autoregistro no permitido para el rol %. Solo propietarios y arrendatarios pueden crear su cuenta por este medio.', v_requested_role
      using errcode = '42501';
  end if;

  insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type, avatar_url, metadata)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'document_number',
    coalesce(new.raw_user_meta_data ->> 'document_type', 'CC'),
    new.raw_user_meta_data ->> 'avatar_url',
    jsonb_build_object('requested_role', v_requested_role)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), tribuia.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function tribuia.handle_new_user();

-- 6.3 Auditoria generica --------------------------------------------------------
create or replace function tribuia.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row     jsonb;
  v_action  tribuia.audit_action;
  v_condo   uuid;
  v_entity  uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := 'DELETE';
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    v_action := 'UPDATE';
  else
    v_row := to_jsonb(new);
    v_action := coalesce(nullif(tg_argv[0], '')::tribuia.audit_action, 'CREATE');
  end if;

  v_condo := tribuia.safe_uuid(v_row ->> 'condominium_id');
  v_entity := tribuia.safe_uuid(v_row ->> 'id');

  insert into tribuia.audit_logs (user_id, condominium_id, action, entity, entity_id, metadata)
  values (auth.uid(), v_condo, v_action, tg_table_name, v_entity,
          jsonb_build_object('op', tg_op, 'record', v_row));

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('alerts', 'ALERT_CREATED'),
      ('fines', 'FINE_CREATED'),
      ('expenses', 'EXPENSE_CREATED'),
      ('announcements', 'CREATE'),
      ('requests', 'CREATE'),
      ('incidents', 'CREATE'),
      ('purchases', 'CREATE'),
      ('documents', 'UPLOAD'),
      ('condominiums', 'CREATE'),
      ('buildings', 'CREATE'),
      ('apartments', 'CREATE'),
      ('condominium_members', 'CREATE'),
      ('user_roles', 'CREATE'),
      ('apartment_owners', 'CREATE'),
      ('apartment_tenants', 'CREATE'),
      ('residents', 'CREATE'),
      ('vehicles', 'CREATE'),
      ('pets', 'CREATE'),
      ('request_comments', 'CREATE'),
      ('expense_categories', 'CREATE'),
      ('purchase_items', 'CREATE'),
      ('document_categories', 'CREATE'),
      ('meetings', 'CREATE'),
      ('meeting_signatures', 'CREATE'),
      ('reports', 'CREATE'),
      ('report_images', 'CREATE')
    ) as t(tbl, act)
  loop
    execute format('drop trigger if exists trg_audit_%1$s on tribuia.%1$I', spec.tbl);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on tribuia.%1$I
       for each row execute function tribuia.fn_audit(%2$L)', spec.tbl, spec.act);
  end loop;
end
$$;

-- 6.4 Totales de compras --------------------------------------------------------
create or replace function tribuia.recalc_purchase_total()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_purchase uuid := coalesce(new.purchase_id, old.purchase_id);
begin
  update tribuia.purchases p
     set total = coalesce((select sum(i.subtotal) from tribuia.purchase_items i where i.purchase_id = v_purchase), 0)
   where p.id = v_purchase;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_items_total on tribuia.purchase_items;
create trigger trg_purchase_items_total
  after insert or update or delete on tribuia.purchase_items
  for each row execute function tribuia.recalc_purchase_total();

-- 6.5 Codigos consecutivos ------------------------------------------------------
create sequence if not exists tribuia.request_code_seq;
create sequence if not exists tribuia.incident_code_seq;
create sequence if not exists tribuia.purchase_code_seq;

create or replace function tribuia.fn_generate_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := tg_argv[0] || '-' || lpad(nextval(tg_argv[1])::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_code on tribuia.requests;
create trigger trg_requests_code before insert on tribuia.requests
  for each row execute function tribuia.fn_generate_code('SOL', 'tribuia.request_code_seq');

drop trigger if exists trg_incidents_code on tribuia.incidents;
create trigger trg_incidents_code before insert on tribuia.incidents
  for each row execute function tribuia.fn_generate_code('INC', 'tribuia.incident_code_seq');

drop trigger if exists trg_purchases_code on tribuia.purchases;
create trigger trg_purchases_code before insert on tribuia.purchases
  for each row execute function tribuia.fn_generate_code('COM', 'tribuia.purchase_code_seq');

-- 6.6 Mensajes: heredar condominio y refrescar conversacion ---------------------
create or replace function tribuia.fn_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  update tribuia.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create or replace function tribuia.fn_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.condominium_id is null then
    new.condominium_id := tribuia.conversation_condominium(new.conversation_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_before_insert on tribuia.messages;
create trigger trg_messages_before_insert before insert on tribuia.messages
  for each row execute function tribuia.fn_message_before_insert();

drop trigger if exists trg_messages_after_insert on tribuia.messages;
create trigger trg_messages_after_insert after insert on tribuia.messages
  for each row execute function tribuia.fn_message_after_insert();

-- 6.7 Notificaciones automaticas de alertas -------------------------------------
create or replace function tribuia.fn_alert_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;

  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select new.condominium_id,
         m.user_id,
         new.title,
         left(new.description, 240),
         'ALERT',
         new.priority,
         'alerts',
         new.id,
         '/alerts'
  from tribuia.condominium_members m
  where m.condominium_id = new.condominium_id
    and m.status = 'ACTIVE'
    and (
      new.audience = 'CONDOMINIUM'
      or (new.audience = 'ROLE' and m.role_id = new.audience_role_id)
      or (new.audience = 'BUILDING' and (
            tribuia.has_role(new.condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'], m.user_id)
            or new.building_id in (select tribuia.user_building_ids(m.user_id))))
      or (new.audience = 'APARTMENT' and (
            tribuia.has_role(new.condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'], m.user_id)
            or new.apartment_id in (select tribuia.user_apartment_ids(m.user_id))))
    );

  return new;
end;
$$;

drop trigger if exists trg_alerts_notify on tribuia.alerts;
create trigger trg_alerts_notify after insert on tribuia.alerts
  for each row execute function tribuia.fn_alert_notify();

-- 6.8 Notificaciones automaticas de comunicados ---------------------------------
create or replace function tribuia.fn_announcement_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status <> 'PUBLISHED' then
    return new;
  end if;

  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select new.condominium_id, m.user_id, new.title, left(new.content, 240),
         'ANNOUNCEMENT', 'LOW', 'announcements', new.id, '/announcements'
  from tribuia.condominium_members m
  where m.condominium_id = new.condominium_id
    and m.status = 'ACTIVE'
    and (new.audience <> 'ROLE' or m.role_id = new.audience_role_id);

  return new;
end;
$$;

drop trigger if exists trg_announcements_notify on tribuia.announcements;
create trigger trg_announcements_notify after insert on tribuia.announcements
  for each row execute function tribuia.fn_announcement_notify();

-- 6.9 Notificacion de multa al propietario/arrendatario -------------------------
create or replace function tribuia.fn_fine_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select new.condominium_id, p.profile_id,
         'Nueva multa registrada', new.reason, 'FINE', 'HIGH', 'fines', new.id, '/fines'
  from (
    select profile_id from tribuia.apartment_owners where apartment_id = new.apartment_id and is_active
    union
    select profile_id from tribuia.apartment_tenants where apartment_id = new.apartment_id and is_active
  ) p
  where p.profile_id is not null;
  return new;
end;
$$;

drop trigger if exists trg_fines_notify on tribuia.fines;
create trigger trg_fines_notify after insert on tribuia.fines
  for each row execute function tribuia.fn_fine_notify();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'roles', 'user_roles', 'condominiums', 'condominium_members',
    'buildings', 'apartments', 'apartment_owners', 'apartment_tenants', 'residents',
    'vehicles', 'pets', 'alerts', 'announcements', 'notifications', 'conversations',
    'conversation_participants', 'messages', 'requests', 'request_comments',
    'incidents', 'expense_categories', 'expenses', 'purchases', 'purchase_items',
    'fines', 'document_categories', 'documents', 'audit_logs', 'meetings',
    'meeting_signatures', 'reports', 'report_images'
  ]
  loop
    execute format('alter table tribuia.%I enable row level security', t);
  end loop;
end
$$;

-- NOTA: se usa ENABLE y no FORCE ROW LEVEL SECURITY a proposito.
-- Los roles `anon` y `authenticated` (los unicos que expone la API) siempre
-- estan sujetos a RLS. FORCE ademas someteria al propietario de las tablas,
-- lo que romperia los triggers SECURITY DEFINER (notificaciones, auditoria)
-- y la ejecucion del seed desde el SQL Editor.

-- Limpieza de politicas previas (permite re-ejecutar el script) -----------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'tribuia'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end
$$;

-- 7.1 profiles ------------------------------------------------------------------
create policy profiles_select on tribuia.profiles for select to authenticated
  using (id = auth.uid() or tribuia.shares_condominium(id));

create policy profiles_insert on tribuia.profiles for insert to authenticated
  with check (id = auth.uid() or tribuia.is_super_admin());

create policy profiles_update on tribuia.profiles for update to authenticated
  using (id = auth.uid() or tribuia.is_super_admin())
  with check (id = auth.uid() or tribuia.is_super_admin());

create policy profiles_delete on tribuia.profiles for delete to authenticated
  using (tribuia.is_super_admin());

-- 7.2 roles ---------------------------------------------------------------------
create policy roles_select on tribuia.roles for select to authenticated using (true);
create policy roles_write on tribuia.roles for all to authenticated
  using (tribuia.is_super_admin()) with check (tribuia.is_super_admin());

-- 7.3 user_roles ----------------------------------------------------------------
create policy user_roles_select on tribuia.user_roles for select to authenticated
  using (user_id = auth.uid() or tribuia.is_super_admin());
create policy user_roles_write on tribuia.user_roles for all to authenticated
  using (tribuia.is_super_admin()) with check (tribuia.is_super_admin());

-- 7.4 condominiums ---------------------------------------------------------------
create policy condominiums_select on tribuia.condominiums for select to authenticated
  using (tribuia.user_can_access_condominium(id));

create policy condominiums_insert on tribuia.condominiums for insert to authenticated
  with check (tribuia.is_super_admin());

create policy condominiums_update on tribuia.condominiums for update to authenticated
  using (tribuia.is_condominium_admin(id))
  with check (tribuia.is_condominium_admin(id));

create policy condominiums_delete on tribuia.condominiums for delete to authenticated
  using (tribuia.is_super_admin());

-- 7.5 condominium_members ---------------------------------------------------------
create policy members_select on tribuia.condominium_members for select to authenticated
  using (user_id = auth.uid() or tribuia.user_can_access_condominium(condominium_id));

create policy members_insert on tribuia.condominium_members for insert to authenticated
  with check (tribuia.is_condominium_admin(condominium_id));

create policy members_update on tribuia.condominium_members for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

create policy members_delete on tribuia.condominium_members for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.6 buildings --------------------------------------------------------------------
create policy buildings_select on tribuia.buildings for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));
create policy buildings_write on tribuia.buildings for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- 7.7 apartments -------------------------------------------------------------------
create policy apartments_select on tribuia.apartments for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));
create policy apartments_write on tribuia.apartments for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- 7.8 apartment_owners --------------------------------------------------------------
create policy apartment_owners_select on tribuia.apartment_owners for select to authenticated
  using (profile_id = auth.uid() or tribuia.user_can_access_apartment(apartment_id));
create policy apartment_owners_write on tribuia.apartment_owners for all to authenticated
  using (tribuia.is_condominium_admin(tribuia.apartment_condominium(apartment_id)))
  with check (tribuia.is_condominium_admin(tribuia.apartment_condominium(apartment_id)));

-- 7.9 apartment_tenants -------------------------------------------------------------
create policy apartment_tenants_select on tribuia.apartment_tenants for select to authenticated
  using (profile_id = auth.uid() or tribuia.user_can_access_apartment(apartment_id));
create policy apartment_tenants_write on tribuia.apartment_tenants for all to authenticated
  using (tribuia.is_condominium_admin(tribuia.apartment_condominium(apartment_id)))
  with check (tribuia.is_condominium_admin(tribuia.apartment_condominium(apartment_id)));

-- 7.10 residents ---------------------------------------------------------------------
-- SECURITY puede consultar residentes (necesario para su funcion), no puede editar.
create policy residents_select on tribuia.residents for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy residents_write on tribuia.residents for all to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
  )
  with check (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
  );

-- 7.11 vehicles ------------------------------------------------------------------------
create policy vehicles_select on tribuia.vehicles for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy vehicles_write on tribuia.vehicles for all to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  )
  with check (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  );

-- 7.12 pets -----------------------------------------------------------------------------
create policy pets_select on tribuia.pets for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy pets_write on tribuia.pets for all to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  )
  with check (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  );

-- 7.13 alerts ----------------------------------------------------------------------------
create policy alerts_select on tribuia.alerts for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or audience = 'CONDOMINIUM'
      or (audience = 'BUILDING' and building_id in (select tribuia.user_building_ids()))
      or (audience = 'APARTMENT' and apartment_id in (select tribuia.user_apartment_ids()))
      or (audience = 'ROLE' and tribuia.user_has_role_id(condominium_id, audience_role_id))
    )
  );

create policy alerts_insert on tribuia.alerts for insert to authenticated
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY']));

create policy alerts_update on tribuia.alerts for update to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']) or created_by = auth.uid())
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']) or created_by = auth.uid());

create policy alerts_delete on tribuia.alerts for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.14 announcements -----------------------------------------------------------------------
create policy announcements_select on tribuia.announcements for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
      or (
        status = 'PUBLISHED'
        and (
          audience = 'CONDOMINIUM'
          or (audience = 'BUILDING' and building_id in (select tribuia.user_building_ids()))
          or (audience = 'APARTMENT' and apartment_id in (select tribuia.user_apartment_ids()))
          or (audience = 'ROLE' and tribuia.user_has_role_id(condominium_id, audience_role_id))
        )
      )
    )
  );

create policy announcements_insert on tribuia.announcements for insert to authenticated
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));

create policy announcements_update on tribuia.announcements for update to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));

create policy announcements_delete on tribuia.announcements for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.15 notifications -------------------------------------------------------------------------
create policy notifications_select on tribuia.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_insert on tribuia.notifications for insert to authenticated
  with check (user_id = auth.uid() or tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));
create policy notifications_update on tribuia.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on tribuia.notifications for delete to authenticated
  using (user_id = auth.uid());

-- 7.16 conversations / participants / messages -------------------------------------------------
-- `created_by` se incluye para que el INSERT ... RETURNING funcione: al crear la
-- conversacion el autor todavia no figura en conversation_participants.
create policy conversations_select on tribuia.conversations for select to authenticated
  using (
    created_by = auth.uid()
    or tribuia.is_conversation_participant(id)
    or tribuia.is_condominium_admin(condominium_id)
  );
create policy conversations_insert on tribuia.conversations for insert to authenticated
  with check (tribuia.user_can_access_condominium(condominium_id));
create policy conversations_update on tribuia.conversations for update to authenticated
  using (tribuia.is_conversation_participant(id) or tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_conversation_participant(id) or tribuia.is_condominium_admin(condominium_id));
create policy conversations_delete on tribuia.conversations for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

create policy participants_select on tribuia.conversation_participants for select to authenticated
  using (user_id = auth.uid() or tribuia.is_conversation_participant(conversation_id));
create policy participants_insert on tribuia.conversation_participants for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(tribuia.conversation_condominium(conversation_id))
  );
create policy participants_update on tribuia.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy participants_delete on tribuia.conversation_participants for delete to authenticated
  using (user_id = auth.uid() or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id)));

create policy messages_select on tribuia.messages for select to authenticated
  using (tribuia.is_conversation_participant(conversation_id) or tribuia.is_condominium_admin(condominium_id));
create policy messages_insert on tribuia.messages for insert to authenticated
  with check (sender_id = auth.uid() and tribuia.is_conversation_participant(conversation_id));
create policy messages_update on tribuia.messages for update to authenticated
  using (sender_id = auth.uid() or tribuia.is_conversation_participant(conversation_id))
  with check (sender_id = auth.uid() or tribuia.is_conversation_participant(conversation_id));
create policy messages_delete on tribuia.messages for delete to authenticated
  using (sender_id = auth.uid() or tribuia.is_condominium_admin(condominium_id));

-- 7.17 requests -----------------------------------------------------------------------------------
create policy requests_select on tribuia.requests for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF', 'SECURITY'])
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy requests_insert on tribuia.requests for insert to authenticated
  with check (tribuia.user_can_access_condominium(condominium_id) and created_by = auth.uid());
create policy requests_update on tribuia.requests for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );
create policy requests_delete on tribuia.requests for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

create policy request_comments_select on tribuia.request_comments for select to authenticated
  using (
    tribuia.has_role(tribuia.request_condominium(request_id), array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF'])
    or tribuia.request_owner(request_id) = auth.uid()
    or tribuia.request_apartment(request_id) in (select tribuia.user_apartment_ids())
  );
create policy request_comments_insert on tribuia.request_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      tribuia.has_role(tribuia.request_condominium(request_id), array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF'])
      or tribuia.request_owner(request_id) = auth.uid()
      or tribuia.request_apartment(request_id) in (select tribuia.user_apartment_ids())
    )
  );
create policy request_comments_update on tribuia.request_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy request_comments_delete on tribuia.request_comments for delete to authenticated
  using (author_id = auth.uid() or tribuia.is_condominium_admin(tribuia.request_condominium(request_id)));

-- 7.18 incidents ----------------------------------------------------------------------------------
create policy incidents_select on tribuia.incidents for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'])
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy incidents_insert on tribuia.incidents for insert to authenticated
  with check (tribuia.user_can_access_condominium(condominium_id));
create policy incidents_update on tribuia.incidents for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
    or reported_by = auth.uid()
    or assigned_to = auth.uid()
  );
create policy incidents_delete on tribuia.incidents for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.19 finanzas: expense_categories / expenses -----------------------------------------------------
create policy expense_categories_select on tribuia.expense_categories for select to authenticated
  using (tribuia.can_view_finance(condominium_id));
create policy expense_categories_write on tribuia.expense_categories for all to authenticated
  using (tribuia.can_manage_finance(condominium_id))
  with check (tribuia.can_manage_finance(condominium_id));

create policy expenses_select on tribuia.expenses for select to authenticated
  using (tribuia.can_view_finance(condominium_id));
create policy expenses_write on tribuia.expenses for all to authenticated
  using (tribuia.can_manage_finance(condominium_id))
  with check (tribuia.can_manage_finance(condominium_id));

-- 7.20 purchases -------------------------------------------------------------------------------------
create policy purchases_select on tribuia.purchases for select to authenticated
  using (tribuia.can_view_finance(condominium_id));
create policy purchases_write on tribuia.purchases for all to authenticated
  using (tribuia.can_manage_finance(condominium_id))
  with check (tribuia.can_manage_finance(condominium_id));

create policy purchase_items_select on tribuia.purchase_items for select to authenticated
  using (tribuia.can_view_finance(tribuia.purchase_condominium(purchase_id)));
create policy purchase_items_write on tribuia.purchase_items for all to authenticated
  using (tribuia.can_manage_finance(tribuia.purchase_condominium(purchase_id)))
  with check (tribuia.can_manage_finance(tribuia.purchase_condominium(purchase_id)));

-- 7.21 fines ------------------------------------------------------------------------------------------
create policy fines_select on tribuia.fines for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy fines_write on tribuia.fines for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- 7.22 documents ---------------------------------------------------------------------------------------
create policy document_categories_select on tribuia.document_categories for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));
create policy document_categories_write on tribuia.document_categories for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

create policy documents_select on tribuia.documents for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
      or (
        not is_restricted
        and (
          visibility = 'CONDOMINIUM'
          or (visibility = 'BUILDING' and building_id in (select tribuia.user_building_ids()))
          or (visibility = 'APARTMENT' and apartment_id in (select tribuia.user_apartment_ids()))
        )
      )
    )
  );
create policy documents_insert on tribuia.documents for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and uploaded_by = auth.uid()
  );
create policy documents_update on tribuia.documents for update to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));
create policy documents_delete on tribuia.documents for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.23 audit_logs -----------------------------------------------------------------------------------------
create policy audit_logs_select on tribuia.audit_logs for select to authenticated
  using (user_id = auth.uid() or tribuia.is_condominium_admin(condominium_id) or tribuia.is_super_admin());
create policy audit_logs_insert on tribuia.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

-- 7.24 meetings (actas) ------------------------------------------------------------------------------------
-- Cualquier miembro puede ver el acta; crear/editar la gestiona la administracion.
create policy meetings_select on tribuia.meetings for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));
create policy meetings_insert on tribuia.meetings for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and created_by = auth.uid()
  );
create policy meetings_update on tribuia.meetings for update to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));
create policy meetings_delete on tribuia.meetings for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.25 meeting_signatures ----------------------------------------------------------------------------------
-- El firmante ve y puede borrar su propia firma; la administracion gestiona todo.
create policy meeting_signatures_select on tribuia.meeting_signatures for select to authenticated
  using (
    profile_id = auth.uid()
    or tribuia.has_role(
         (select m.condominium_id from tribuia.meetings m where m.id = meeting_id),
         array['ADMINISTRATOR', 'SPOKESPERSON'])
  );
create policy meeting_signatures_insert on tribuia.meeting_signatures for insert to authenticated
  with check (
    profile_id = auth.uid()
    or tribuia.has_role(
         (select m.condominium_id from tribuia.meetings m where m.id = meeting_id),
         array['ADMINISTRATOR', 'SPOKESPERSON'])
  );
create policy meeting_signatures_update on tribuia.meeting_signatures for update to authenticated
  using (
    profile_id = auth.uid()
    or tribuia.has_role(
         (select m.condominium_id from tribuia.meetings m where m.id = meeting_id),
         array['ADMINISTRATOR', 'SPOKESPERSON'])
  )
  with check (
    profile_id = auth.uid()
    or tribuia.has_role(
         (select m.condominium_id from tribuia.meetings m where m.id = meeting_id),
         array['ADMINISTRATOR', 'SPOKESPERSON'])
  );
create policy meeting_signatures_delete on tribuia.meeting_signatures for delete to authenticated
  using (
    profile_id = auth.uid()
    or tribuia.has_role(
         (select m.condominium_id from tribuia.meetings m where m.id = meeting_id),
         array['ADMINISTRATOR', 'SPOKESPERSON'])
  );

-- 7.26 reports ----------------------------------------------------------------------------------------------
create policy reports_select on tribuia.reports for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));
create policy reports_insert on tribuia.reports for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and created_by = auth.uid()
  );
create policy reports_update on tribuia.reports for update to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));
create policy reports_delete on tribuia.reports for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- 7.27 report_images ----------------------------------------------------------------------------------------
create policy report_images_select on tribuia.report_images for select to authenticated
  using (tribuia.user_can_access_condominium((select r.condominium_id from tribuia.reports r where r.id = report_id)));
create policy report_images_insert on tribuia.report_images for insert to authenticated
  with check (
    tribuia.has_role(
      (select r.condominium_id from tribuia.reports r where r.id = report_id),
      array['ADMINISTRATOR', 'SPOKESPERSON'])
  );
create policy report_images_update on tribuia.report_images for update to authenticated
  using (tribuia.has_role(
      (select r.condominium_id from tribuia.reports r where r.id = report_id),
      array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (tribuia.has_role(
      (select r.condominium_id from tribuia.reports r where r.id = report_id),
      array['ADMINISTRATOR', 'SPOKESPERSON']));
create policy report_images_delete on tribuia.report_images for delete to authenticated
  using (tribuia.is_condominium_admin(
      (select r.condominium_id from tribuia.reports r where r.id = report_id)));

-- ----------------------------------------------------------------------------
-- 8. STORAGE (buckets + politicas)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 26214400, null),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('incident-evidence', 'incident-evidence', false, 26214400, null),
  ('invoices', 'invoices', false, 26214400, null),
  ('announcements', 'announcements', false, 26214400, null),
  ('signatures', 'signatures', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('report-images', 'report-images', false, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convencion de rutas: <condominium_id>/<entidad>/<archivo>
-- (excepto `avatars`, donde la ruta es <user_id>/<archivo>)
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'edifeasy_%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;

  execute $pol$
    create policy edifeasy_tenant_read on storage.objects for select to authenticated
    using (
      bucket_id in ('documents', 'incident-evidence', 'invoices', 'announcements',
                    'signatures', 'report-images')
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_tenant_write on storage.objects for insert to authenticated
    with check (
      bucket_id in ('documents', 'incident-evidence', 'invoices', 'announcements',
                    'signatures', 'report-images')
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_tenant_update on storage.objects for update to authenticated
    using (
      bucket_id in ('documents', 'incident-evidence', 'invoices', 'announcements',
                    'signatures', 'report-images')
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                          array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;

  execute $pol$
    create policy edifeasy_tenant_delete on storage.objects for delete to authenticated
    using (
      bucket_id in ('documents', 'incident-evidence', 'invoices', 'announcements',
                    'signatures', 'report-images')
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                          array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;

  execute $pol$
    create policy edifeasy_avatar_read on storage.objects for select to public
    using (bucket_id = 'avatars')
  $pol$;

  execute $pol$
    create policy edifeasy_avatar_write on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;

  execute $pol$
    create policy edifeasy_avatar_update on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;

  execute $pol$
    create policy edifeasy_avatar_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

-- ----------------------------------------------------------------------------
-- 9. REALTIME
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['alerts', 'notifications', 'messages', 'conversations',
                           'requests', 'incidents', 'announcements']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'tribuia' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table tribuia.%I', t);
    end if;
    execute format('alter table tribuia.%I replica identity full', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 10. DATOS ESTRUCTURALES (catalogo de roles)
-- ----------------------------------------------------------------------------
insert into tribuia.roles (code, name, description, level, is_global) values
  ('SUPER_ADMIN',   'Super Administrador', 'Acceso total a la plataforma y a todos los condominios', 100, true),
  ('ADMINISTRATOR', 'Administrador',       'Administra un condominio especifico',                     80, false),
  ('SPOKESPERSON',  'Vocero',              'Consulta informacion y publica alertas y comunicados',     60, false),
  ('OWNER',         'Propietario',         'Propietario de uno o mas apartamentos',                    40, false),
  ('TENANT',        'Arrendatario',        'Arrendatario de un apartamento',                           30, false),
  ('SECURITY',      'Celaduria',           'Personal de seguridad: residentes, visitantes, incidentes',20, false),
  ('SERVICE_STAFF', 'Personal de Servicios','Personal operativo: tareas, mantenimientos, solicitudes', 10, false)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      level = excluded.level,
      is_global = excluded.is_global;

-- ----------------------------------------------------------------------------
-- 10b. RPC DE APOYO A LA APLICACION
-- ----------------------------------------------------------------------------

-- Busca un perfil por email exacto. Solo administradores / super admin.
-- Divulgacion controlada: exige el email completo (no permite enumeracion).
create or replace function tribuia.find_profile_by_email(p_email text)
returns table (id uuid, email text, full_name text, avatar_url text, phone text)
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p.id, p.email, p.full_name, p.avatar_url, p.phone
  from tribuia.profiles p
  where lower(p.email) = lower(trim(coalesce(p_email, '')))
    and (
      tribuia.is_super_admin()
      or exists (
        select 1
        from tribuia.condominium_members m
        join tribuia.roles r on r.id = m.role_id
        where m.user_id = auth.uid() and m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR'
      )
    );
$$;

-- Vincula un usuario ya registrado a un condominio con un rol determinado.
create or replace function tribuia.add_member_by_email(
  p_condominium uuid,
  p_email text,
  p_role_code text,
  p_position text default null
)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user uuid;
  v_role uuid;
  v_id   uuid;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para gestionar usuarios en este condominio'
      using errcode = '42501';
  end if;

  select id into v_user from tribuia.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No existe un usuario registrado con el correo %', p_email
      using errcode = 'P0002';
  end if;

  select id into v_role from tribuia.roles where code = p_role_code;
  if v_role is null then
    raise exception 'Rol invalido: %', p_role_code using errcode = '22023';
  end if;

  insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position)
  values (p_condominium, v_user, v_role, 'ACTIVE', p_position)
  on conflict (condominium_id, user_id, role_id)
    do update set status = 'ACTIVE', position = excluded.position
  returning id into v_id;

  return v_id;
end;
$$;

-- Marca todas las notificaciones del usuario como leidas.
create or replace function tribuia.mark_all_notifications_read(p_condominium uuid default null)
returns integer
language plpgsql
security invoker
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  update tribuia.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid()
     and not is_read
     and (p_condominium is null or condominium_id = p_condominium);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Contexto del usuario autenticado: perfil + membresias + roles.
create or replace function tribuia.current_user_context()
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) from tribuia.profiles p where p.id = auth.uid()
    ),
    'is_super_admin', tribuia.is_super_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'condominium_id', m.condominium_id,
        'condominium_name', c.name,
        'condominium_status', c.status,
        'role_id', m.role_id,
        'role_code', r.code,
        'role_name', r.name,
        'role_level', r.level,
        'status', m.status,
        'position', m.position
      ) order by r.level desc, c.name)
      from tribuia.condominium_members m
      join tribuia.condominiums c on c.id = m.condominium_id
      join tribuia.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.status = 'ACTIVE'
    ), '[]'::jsonb),
    'apartment_ids', coalesce((
      select jsonb_agg(x) from (select tribuia.user_apartment_ids() as x) s
      where x is not null
    ), '[]'::jsonb)
  );
$$;

-- Resumen del apartamento del residente (dashboard de residente).
create or replace function tribuia.resident_dashboard(p_condominium uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = tribuia, public, pg_temp
as $$
declare
  result jsonb;
begin
  if not tribuia.user_can_access_condominium(p_condominium) then
    raise exception 'No autorizado para consultar este condominio';
  end if;

  select jsonb_build_object(
    'apartments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'number', a.number, 'floor', a.floor, 'status', a.status,
        'area', a.area, 'bedrooms', a.bedrooms, 'bathrooms', a.bathrooms,
        'building_id', b.id, 'building_name', b.name, 'building_number', b.number
      ) order by a.number)
      from tribuia.apartments a
      join tribuia.buildings b on b.id = a.building_id
      where a.condominium_id = p_condominium
        and a.id in (select tribuia.user_apartment_ids())
    ), '[]'::jsonb),
    'active_alerts', (select count(*) from tribuia.alerts where condominium_id = p_condominium and status = 'ACTIVE'),
    'announcements', (select count(*) from tribuia.announcements where condominium_id = p_condominium and status = 'PUBLISHED'),
    'open_requests', (select count(*) from tribuia.requests where condominium_id = p_condominium and status in ('OPEN', 'IN_PROGRESS')),
    'pending_fines', (select count(*) from tribuia.fines where condominium_id = p_condominium and status = 'PENDING'),
    'pending_fines_amount', (select coalesce(sum(amount), 0) from tribuia.fines where condominium_id = p_condominium and status = 'PENDING'),
    'unread_messages', (
      select count(*)
      from tribuia.messages m
      join tribuia.conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
      where m.condominium_id = p_condominium
        and m.sender_id <> auth.uid()
        and (cp.last_read_at is null or m.created_at > cp.last_read_at)
    ),
    'documents', (select count(*) from tribuia.documents where condominium_id = p_condominium),
    'residents', (select count(*) from tribuia.residents where condominium_id = p_condominium and is_active),
    'vehicles', (select count(*) from tribuia.vehicles where condominium_id = p_condominium and is_active),
    'pets', (select count(*) from tribuia.pets where condominium_id = p_condominium and is_active)
  ) into result;

  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. PERMISOS
-- ----------------------------------------------------------------------------
grant usage on schema tribuia to anon, authenticated;
grant execute on all functions in schema tribuia to anon;
grant select, insert, update, delete on all tables in schema tribuia to authenticated;
grant usage, select on all sequences in schema tribuia to authenticated;
grant execute on all functions in schema tribuia to authenticated;

alter default privileges in schema tribuia
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema tribuia
  grant usage, select on sequences to authenticated;
alter default privileges in schema tribuia
  grant execute on functions to authenticated;
alter default privileges in schema tribuia
  grant execute on functions to anon;

-- ----------------------------------------------------------------------------
-- 12. AUTOREGISTRO CON APROBACION DEL ADMINISTRADOR
-- ----------------------------------------------------------------------------
-- Un usuario puede crear su cuenta y SOLICITAR su inscripcion eligiendo
-- condominio, edificio y apartamento de catalogos de solo-lectura. La solicitud
-- queda en estado PENDING y no otorga ningun acceso: es el ADMINISTRATOR del
-- condominio quien la aprueba o la rechaza.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- B. Solicitudes de inscripcion
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tribuia' and t.typname = 'registration_status'
  ) then
    create type tribuia.registration_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  end if;
end
$$;

create table if not exists tribuia.registration_requests (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  profile_id     uuid not null references tribuia.profiles (id) on delete cascade,
  building_id    uuid not null references tribuia.buildings (id) on delete cascade,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  requested_role text not null check (requested_role in ('OWNER', 'TENANT', 'BOTH')),
  vehicles       jsonb not null default '[]'::jsonb,
  status         tribuia.registration_status not null default 'PENDING',
  applicant_note text,
  review_notes   text,
  reviewed_by    uuid references tribuia.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_registration_requests_condominium
  on tribuia.registration_requests (condominium_id, status, created_at desc);
create index if not exists idx_registration_requests_profile
  on tribuia.registration_requests (profile_id, created_at desc);
create index if not exists idx_registration_requests_apartment
  on tribuia.registration_requests (apartment_id);

-- Una sola solicitud PENDING por usuario y condominio.
create unique index if not exists uq_registration_requests_pending
  on tribuia.registration_requests (profile_id, condominium_id)
  where status = 'PENDING';

drop trigger if exists trg_registration_requests_updated_at on tribuia.registration_requests;
create trigger trg_registration_requests_updated_at
  before update on tribuia.registration_requests
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_audit_registration_requests on tribuia.registration_requests;
create trigger trg_audit_registration_requests
  after insert or update or delete on tribuia.registration_requests
  for each row execute function tribuia.fn_audit('CREATE');

alter table tribuia.registration_requests enable row level security;

drop policy if exists registration_requests_select on tribuia.registration_requests;
create policy registration_requests_select on tribuia.registration_requests
  for select to authenticated
  using (profile_id = auth.uid() or tribuia.is_condominium_admin(condominium_id));

drop policy if exists registration_requests_insert on tribuia.registration_requests;
create policy registration_requests_insert on tribuia.registration_requests
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'PENDING');

drop policy if exists registration_requests_update on tribuia.registration_requests;
create policy registration_requests_update on tribuia.registration_requests
  for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

drop policy if exists registration_requests_delete on tribuia.registration_requests;
create policy registration_requests_delete on tribuia.registration_requests
  for delete to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or (profile_id = auth.uid() and status = 'PENDING')
  );

-- ----------------------------------------------------------------------------
-- C. Catalogos de solo-lectura para la pantalla de registro
-- ----------------------------------------------------------------------------
-- Solo devuelven registros que YA EXISTEN. El usuario nunca escribe texto libre
-- para identificar su condominio, edificio o apartamento.
-- ----------------------------------------------------------------------------
create or replace function tribuia.registration_catalog()
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'city', c.city,
      'country', c.country
    ) order by c.name)
    from tribuia.condominiums c
    where c.status = 'ACTIVE'
  ), '[]'::jsonb);
$$;

create or replace function tribuia.registration_buildings(p_condominium uuid)
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'number', b.number,
    'name', b.name
  ) order by b.number), '[]'::jsonb)
  from tribuia.buildings b
  where b.condominium_id = p_condominium and b.status = 'ACTIVE';
$$;

-- Apartamentos de un edificio, marcando los que ya estan reclamados para que la
-- interfaz los deshabilite en lugar de dejar que el usuario los elija.
create or replace function tribuia.registration_apartments(p_building uuid)
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'number', a.number,
    'floor', a.floor,
    'claimed_by_owner', exists (
      select 1 from tribuia.apartment_owners ao
      where ao.apartment_id = a.id and ao.is_active
    ),
    'claimed_by_tenant', exists (
      select 1 from tribuia.apartment_tenants t
      where t.apartment_id = a.id and t.is_active
    ),
    'has_pending_request', exists (
      select 1 from tribuia.registration_requests r
      where r.apartment_id = a.id and r.status = 'PENDING'
    )
  ) order by a.number), '[]'::jsonb)
  from tribuia.apartments a
  where a.building_id = p_building
    and a.status <> 'INACTIVE';
$$;

-- ----------------------------------------------------------------------------
-- D. Solicitar la inscripcion (NO otorga acceso)
-- ----------------------------------------------------------------------------
-- La firma anterior recibia numeros de texto; ahora recibe los UUID elegidos de
-- los catalogos, lo que garantiza que solo se puedan seleccionar registros
-- existentes. Se elimina la version antigua.
-- ----------------------------------------------------------------------------
drop function if exists tribuia.complete_self_registration(uuid, text, text, text, jsonb);

create or replace function tribuia.complete_self_registration(
  p_condominium uuid,
  p_building uuid,
  p_apartment uuid,
  p_user_type text,
  p_vehicles jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_request uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para solicitar tu inscripcion' using errcode = '42501';
  end if;

  -- Reconstruir el perfil si falta.
  --
  -- tribuia.profiles se llena con el trigger on_auth_user_created, asi que una
  -- cuenta creada ANTES de instalar ese trigger existe en auth.users y no aqui.
  -- Sin esta reconstruccion, el insert de mas abajo muere con
  -- 23503 registration_requests_profile_id_fkey y el usuario solo ve un error
  -- de clave ajena que no puede resolver.
  insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type, metadata)
  select u.id,
         u.email,
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
         u.raw_user_meta_data ->> 'phone',
         u.raw_user_meta_data ->> 'document_number',
         coalesce(u.raw_user_meta_data ->> 'document_type', 'CC'),
         jsonb_build_object('requested_role', nullif(u.raw_user_meta_data ->> 'requested_role', ''))
  from auth.users u
  where u.id = v_user and u.email is not null
  -- Sin objetivo: cubre tanto el id repetido como el indice unico de email.
  on conflict do nothing;

  if not exists (select 1 from tribuia.profiles p where p.id = v_user) then
    raise exception 'Tu perfil no existe en la base de datos y no se pudo crear. Contacta a la administracion.'
      using errcode = 'P0001';
  end if;

  if p_user_type not in ('OWNER', 'TENANT', 'BOTH') then
    raise exception 'Solo puedes registrarte como propietario o arrendatario' using errcode = '22023';
  end if;

  if not exists (
    select 1 from tribuia.condominiums c
    where c.id = p_condominium and c.status = 'ACTIVE'
  ) then
    raise exception 'El condominio no existe o esta inactivo' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from tribuia.buildings b
    where b.id = p_building and b.condominium_id = p_condominium and b.status = 'ACTIVE'
  ) then
    raise exception 'El edificio seleccionado no pertenece a ese condominio' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from tribuia.apartments a
    where a.id = p_apartment and a.building_id = p_building
  ) then
    raise exception 'El apartamento seleccionado no pertenece a ese edificio' using errcode = 'P0002';
  end if;

  -- Ya es miembro activo: no hay nada que solicitar.
  if exists (
    select 1 from tribuia.condominium_members m
    where m.condominium_id = p_condominium and m.user_id = v_user and m.status = 'ACTIVE'
  ) then
    raise exception 'Ya tienes acceso activo a este condominio' using errcode = 'P0001';
  end if;

  -- El apartamento ya esta asignado a otra persona.
  if p_user_type in ('OWNER', 'BOTH') and exists (
    select 1 from tribuia.apartment_owners ao
    where ao.apartment_id = p_apartment and ao.profile_id <> v_user and ao.is_active
  ) then
    raise exception 'Ese apartamento ya tiene un propietario registrado. Contacta a la administracion.'
      using errcode = 'P0001';
  end if;

  if p_user_type in ('TENANT', 'BOTH') and exists (
    select 1 from tribuia.apartment_tenants t
    where t.apartment_id = p_apartment and t.profile_id <> v_user and t.is_active
  ) then
    raise exception 'Ese apartamento ya tiene un arrendatario registrado. Contacta a la administracion.'
      using errcode = 'P0001';
  end if;

  -- Otra persona ya solicito ese mismo apartamento y espera aprobacion.
  if exists (
    select 1 from tribuia.registration_requests r
    where r.apartment_id = p_apartment
      and r.status = 'PENDING'
      and r.profile_id <> v_user
  ) then
    raise exception 'Ese apartamento tiene una solicitud pendiente de aprobacion' using errcode = 'P0001';
  end if;

  -- Reenviar la solicitud actualiza la existente en lugar de duplicarla.
  insert into tribuia.registration_requests
    (condominium_id, profile_id, building_id, apartment_id, requested_role, vehicles, applicant_note, status)
  values
    (p_condominium, v_user, p_building, p_apartment, p_user_type,
     coalesce(p_vehicles, '[]'::jsonb), nullif(trim(coalesce(p_note, '')), ''), 'PENDING')
  on conflict (profile_id, condominium_id) where status = 'PENDING'
    do update set building_id     = excluded.building_id,
                  apartment_id    = excluded.apartment_id,
                  requested_role  = excluded.requested_role,
                  vehicles        = excluded.vehicles,
                  applicant_note  = excluded.applicant_note,
                  updated_at      = now()
  returning id into v_request;

  -- Avisar a los administradores del condominio.
  insert into tribuia.notifications
    (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select p_condominium,
         m.user_id,
         'Nueva solicitud de inscripcion',
         coalesce(p.full_name, 'Un usuario') || ' solicita acceso como ' ||
           case p_user_type when 'OWNER' then 'propietario'
                            when 'TENANT' then 'arrendatario'
                            else 'propietario y arrendatario' end,
         'SYSTEM',
         'HIGH',
         'registration_requests',
         v_request,
         '/approvals'
  from tribuia.condominium_members m
  join tribuia.roles r on r.id = m.role_id
  cross join (select full_name from tribuia.profiles where id = v_user) p
  where m.condominium_id = p_condominium
    and m.status = 'ACTIVE'
    and r.code = 'ADMINISTRATOR';

  return jsonb_build_object('ok', true, 'status', 'PENDING', 'request_id', v_request);
end;
$$;

-- Estado de mi propia solicitud (para la pantalla de espera).
create or replace function tribuia.my_registration_request()
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'requested_role', r.requested_role,
      'condominium_name', c.name,
      'building_number', b.number,
      'apartment_number', a.number,
      'review_notes', r.review_notes,
      'created_at', r.created_at,
      'reviewed_at', r.reviewed_at
    )
    from tribuia.registration_requests r
    join tribuia.condominiums c on c.id = r.condominium_id
    join tribuia.buildings b on b.id = r.building_id
    join tribuia.apartments a on a.id = r.apartment_id
    where r.profile_id = auth.uid()
    order by r.created_at desc
    limit 1
  ), 'null'::jsonb);
$$;

-- ----------------------------------------------------------------------------
-- E. Revision por el administrador
-- ----------------------------------------------------------------------------
-- Listado para el administrador. Es SECURITY DEFINER porque el solicitante aun
-- no es miembro activo y por tanto las politicas de `profiles` no permitirian
-- ver su nombre ni su correo.
-- ----------------------------------------------------------------------------
create or replace function tribuia.registration_requests_for_review(
  p_condominium uuid,
  p_status text default 'PENDING'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para revisar solicitudes de este condominio'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by item ->> 'created_at' desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'requested_role', r.requested_role,
      'applicant_note', r.applicant_note,
      'review_notes', r.review_notes,
      'created_at', r.created_at,
      'reviewed_at', r.reviewed_at,
      'vehicles', r.vehicles,
      'profile_id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'document_number', p.document_number,
      'building_id', b.id,
      'building_number', b.number,
      'apartment_id', a.id,
      'apartment_number', a.number,
      'reviewer_name', rev.full_name
    ) as item
    from tribuia.registration_requests r
    join tribuia.profiles p on p.id = r.profile_id
    join tribuia.buildings b on b.id = r.building_id
    join tribuia.apartments a on a.id = r.apartment_id
    left join tribuia.profiles rev on rev.id = r.reviewed_by
    where r.condominium_id = p_condominium
      and (p_status = 'ALL' or r.status::text = p_status)
  ) s;

  return v_result;
end;
$$;

create or replace function tribuia.approve_registration_request(
  p_request uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_req         tribuia.registration_requests;
  v_role_owner  uuid;
  v_role_tenant uuid;
  v_vehicle     jsonb;
  v_plate       text;
begin
  select * into v_req from tribuia.registration_requests where id = p_request;
  if v_req.id is null then
    raise exception 'La solicitud no existe' using errcode = 'P0002';
  end if;

  if not tribuia.is_condominium_admin(v_req.condominium_id) then
    raise exception 'No tienes permisos para aprobar solicitudes de este condominio'
      using errcode = '42501';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception 'Esta solicitud ya fue revisada (estado actual: %)', v_req.status
      using errcode = 'P0001';
  end if;

  select id into v_role_owner from tribuia.roles where code = 'OWNER';
  select id into v_role_tenant from tribuia.roles where code = 'TENANT';

  -- Membresia(s) activas.
  if v_req.requested_role in ('OWNER', 'BOTH') then
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
    values (v_req.condominium_id, v_req.profile_id, v_role_owner, 'ACTIVE')
    on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';
  end if;

  if v_req.requested_role in ('TENANT', 'BOTH') then
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
    values (v_req.condominium_id, v_req.profile_id, v_role_tenant, 'ACTIVE')
    on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';
  end if;

  -- Vinculo con el apartamento.
  if v_req.requested_role in ('OWNER', 'BOTH') then
    insert into tribuia.apartment_owners
      (apartment_id, profile_id, ownership_percentage, is_primary, is_active)
    values (v_req.apartment_id, v_req.profile_id, 100, true, true)
    on conflict (apartment_id, profile_id) do update set is_active = true;
  end if;

  if v_req.requested_role in ('TENANT', 'BOTH') then
    insert into tribuia.apartment_tenants (apartment_id, profile_id, is_active)
    values (v_req.apartment_id, v_req.profile_id, true)
    on conflict (apartment_id, profile_id) do update set is_active = true;
  end if;

  -- Residente del apartamento.
  insert into tribuia.residents
    (condominium_id, apartment_id, profile_id, full_name, document_number,
     relationship, phone, email, is_active)
  select v_req.condominium_id, v_req.apartment_id, p.id, p.full_name, p.document_number,
         case when v_req.requested_role = 'TENANT'
              then 'TENANT'::tribuia.resident_relationship
              else 'OWNER'::tribuia.resident_relationship end,
         p.phone, p.email, true
  from tribuia.profiles p
  where p.id = v_req.profile_id
  on conflict (apartment_id, profile_id) do update set is_active = true;

  -- Vehiculos declarados en la solicitud.
  for v_vehicle in select * from jsonb_array_elements(v_req.vehicles) loop
    v_plate := upper(regexp_replace(coalesce(v_vehicle ->> 'plate', ''), '\s', '', 'g'));
    if v_plate <> '' then
      insert into tribuia.vehicles
        (condominium_id, apartment_id, type, brand, model, color, plate, is_active)
      values (
        v_req.condominium_id,
        v_req.apartment_id,
        coalesce(nullif(v_vehicle ->> 'type', ''), 'CAR')::tribuia.vehicle_type,
        nullif(v_vehicle ->> 'brand', ''),
        nullif(v_vehicle ->> 'model', ''),
        nullif(v_vehicle ->> 'color', ''),
        v_plate,
        true
      )
      on conflict do nothing;
    end if;
  end loop;

  update tribuia.apartments
     set status = 'OCCUPIED'
   where id = v_req.apartment_id and status = 'VACANT';

  update tribuia.registration_requests
     set status = 'APPROVED',
         review_notes = nullif(trim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request;

  insert into tribuia.notifications
    (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  values (
    v_req.condominium_id,
    v_req.profile_id,
    'Tu inscripcion fue aprobada',
    'Ya tienes acceso al condominio. Vuelve a iniciar sesion para entrar.',
    'SYSTEM',
    'HIGH',
    'registration_requests',
    p_request,
    '/dashboard'
  );

  return jsonb_build_object('ok', true, 'status', 'APPROVED');
end;
$$;

create or replace function tribuia.reject_registration_request(
  p_request uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_req tribuia.registration_requests;
begin
  select * into v_req from tribuia.registration_requests where id = p_request;
  if v_req.id is null then
    raise exception 'La solicitud no existe' using errcode = 'P0002';
  end if;

  if not tribuia.is_condominium_admin(v_req.condominium_id) then
    raise exception 'No tienes permisos para revisar solicitudes de este condominio'
      using errcode = '42501';
  end if;

  if v_req.status <> 'PENDING' then
    raise exception 'Esta solicitud ya fue revisada (estado actual: %)', v_req.status
      using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Debes indicar el motivo del rechazo' using errcode = '22023';
  end if;

  update tribuia.registration_requests
     set status = 'REJECTED',
         review_notes = trim(p_reason),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request;

  insert into tribuia.notifications
    (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  values (
    v_req.condominium_id,
    v_req.profile_id,
    'Tu solicitud de inscripcion fue rechazada',
    trim(p_reason),
    'SYSTEM',
    'HIGH',
    'registration_requests',
    p_request,
    '/sin-condominio'
  );

  return jsonb_build_object('ok', true, 'status', 'REJECTED');
end;
$$;

-- ----------------------------------------------------------------------------
-- F. Permisos
-- ----------------------------------------------------------------------------
-- Los catalogos se consultan SIN sesion (rol anon) desde /register.
grant execute on function tribuia.registration_catalog() to anon, authenticated;
grant execute on function tribuia.registration_buildings(uuid) to anon, authenticated;
grant execute on function tribuia.registration_apartments(uuid) to anon, authenticated;

-- El resto exige sesion; la propia funcion valida el rol.
grant execute on function tribuia.complete_self_registration(uuid, uuid, uuid, text, jsonb, text)
  to authenticated;
grant execute on function tribuia.my_registration_request() to authenticated;
grant execute on function tribuia.registration_requests_for_review(uuid, text) to authenticated;
grant execute on function tribuia.approve_registration_request(uuid, text) to authenticated;
grant execute on function tribuia.reject_registration_request(uuid, text) to authenticated;

grant select, insert, update, delete on tribuia.registration_requests to authenticated;

-- ----------------------------------------------------------------------------
-- 13. INVITACIONES (el administrador da de alta a los usuarios)
-- ----------------------------------------------------------------------------
-- Un SUPER_ADMIN o el ADMINISTRATOR de un condominio invita por correo con un
-- rol concreto. Cuando esa persona inicia sesion, `claim_my_invitations()` le
-- crea la membresia ACTIVA: la invitacion es la autorizacion, asi que no pasa
-- por la cola de aprobacion del autoregistro.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- A. Tabla de invitaciones
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tribuia' and t.typname = 'invitation_status'
  ) then
    create type tribuia.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
  end if;
end
$$;

create table if not exists tribuia.condominium_invitations (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  email          text not null,
  role_id        uuid not null references tribuia.roles (id) on delete restrict,
  position       text,
  apartment_id   uuid references tribuia.apartments (id) on delete set null,
  status         tribuia.invitation_status not null default 'PENDING',
  invited_by     uuid references tribuia.profiles (id) on delete set null,
  accepted_by    uuid references tribuia.profiles (id) on delete set null,
  accepted_at    timestamptz,
  expires_at     timestamptz not null default now() + interval '30 days',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_invitations_condominium
  on tribuia.condominium_invitations (condominium_id, status, created_at desc);
create index if not exists idx_invitations_email
  on tribuia.condominium_invitations (lower(email), status);

-- Una sola invitacion PENDING por correo y condominio.
-- `create_invitation` guarda el correo ya normalizado a minusculas, por eso el
-- indice va sobre columnas simples: asi el ON CONFLICT no tiene que inferir una
-- expresion, que es una fuente habitual de errores en tiempo de ejecucion.
create unique index if not exists uq_invitations_pending
  on tribuia.condominium_invitations (condominium_id, email)
  where status = 'PENDING';

drop trigger if exists trg_invitations_updated_at on tribuia.condominium_invitations;
create trigger trg_invitations_updated_at
  before update on tribuia.condominium_invitations
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_audit_invitations on tribuia.condominium_invitations;
create trigger trg_audit_invitations
  after insert or update or delete on tribuia.condominium_invitations
  for each row execute function tribuia.fn_audit('CREATE');

alter table tribuia.condominium_invitations enable row level security;

-- El invitado puede ver la suya (por correo) antes de tener membresia.
drop policy if exists invitations_select on tribuia.condominium_invitations;
create policy invitations_select on tribuia.condominium_invitations
  for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or lower(email) = lower(coalesce(
      (select p.email from tribuia.profiles p where p.id = auth.uid()), ''))
  );

drop policy if exists invitations_write on tribuia.condominium_invitations;
create policy invitations_write on tribuia.condominium_invitations
  for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- ----------------------------------------------------------------------------
-- B. Crear y revocar invitaciones
-- ----------------------------------------------------------------------------
create or replace function tribuia.create_invitation(
  p_condominium uuid,
  p_email text,
  p_role_code text,
  p_position text default null,
  p_apartment uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_role       uuid;
  v_email      text := lower(trim(coalesce(p_email, '')));
  v_invitation uuid;
  v_existing   uuid;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para invitar usuarios a este condominio'
      using errcode = '42501';
  end if;

  if v_email = '' or v_email not like '%@%.%' then
    raise exception 'Correo electronico invalido' using errcode = '22023';
  end if;

  if p_role_code = 'SUPER_ADMIN' then
    raise exception 'SUPER_ADMIN es un rol global y no se asigna por invitacion'
      using errcode = '22023';
  end if;

  select id into v_role from tribuia.roles where code = p_role_code;
  if v_role is null then
    raise exception 'Rol invalido: %', p_role_code using errcode = '22023';
  end if;

  if p_apartment is not null and not exists (
    select 1 from tribuia.apartments a
    where a.id = p_apartment and a.condominium_id = p_condominium
  ) then
    raise exception 'El apartamento no pertenece a este condominio' using errcode = 'P0002';
  end if;

  -- Si el usuario ya existe y ya es miembro activo, no hay nada que invitar.
  select p.id into v_existing from tribuia.profiles p where lower(p.email) = v_email;
  if v_existing is not null and exists (
    select 1 from tribuia.condominium_members m
    where m.condominium_id = p_condominium
      and m.user_id = v_existing
      and m.role_id = v_role
      and m.status = 'ACTIVE'
  ) then
    raise exception 'Ese usuario ya tiene ese rol activo en el condominio' using errcode = 'P0001';
  end if;

  insert into tribuia.condominium_invitations
    (condominium_id, email, role_id, position, apartment_id, invited_by, status)
  values (p_condominium, v_email, v_role, nullif(trim(coalesce(p_position, '')), ''),
          p_apartment, auth.uid(), 'PENDING')
  on conflict (condominium_id, email) where status = 'PENDING'
    do update set role_id      = excluded.role_id,
                  position     = excluded.position,
                  apartment_id = excluded.apartment_id,
                  expires_at   = now() + interval '30 days',
                  updated_at   = now()
  returning id into v_invitation;

  return jsonb_build_object(
    'ok', true,
    'invitation_id', v_invitation,
    'email', v_email,
    'user_exists', v_existing is not null
  );
end;
$$;

create or replace function tribuia.revoke_invitation(p_invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_condominium uuid;
  v_status      tribuia.invitation_status;
begin
  select condominium_id, status into v_condominium, v_status
  from tribuia.condominium_invitations where id = p_invitation;

  if v_condominium is null then
    raise exception 'La invitacion no existe' using errcode = 'P0002';
  end if;

  if not tribuia.is_condominium_admin(v_condominium) then
    raise exception 'No tienes permisos sobre esta invitacion' using errcode = '42501';
  end if;

  if v_status <> 'PENDING' then
    raise exception 'Solo se pueden revocar invitaciones pendientes' using errcode = 'P0001';
  end if;

  update tribuia.condominium_invitations set status = 'REVOKED' where id = p_invitation;
  return jsonb_build_object('ok', true);
end;
$$;

-- Listado para el administrador. SECURITY DEFINER porque el invitado puede no
-- tener aun cuenta ni compartir condominio (las politicas de `profiles` no
-- permitirian resolver su nombre).
create or replace function tribuia.invitations_for_condominium(
  p_condominium uuid,
  p_status text default 'PENDING'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para ver las invitaciones de este condominio'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by item ->> 'created_at' desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', i.id,
      'email', i.email,
      'status', i.status,
      'position', i.position,
      'role_code', r.code,
      'role_name', r.name,
      'apartment_id', a.id,
      'apartment_number', a.number,
      'building_number', b.number,
      'invited_by_name', inv.full_name,
      'accepted_by_name', acc.full_name,
      'accepted_at', i.accepted_at,
      'expires_at', i.expires_at,
      'created_at', i.created_at,
      'user_exists', exists (
        select 1 from tribuia.profiles p where lower(p.email) = lower(i.email)
      )
    ) as item
    from tribuia.condominium_invitations i
    join tribuia.roles r on r.id = i.role_id
    left join tribuia.apartments a on a.id = i.apartment_id
    left join tribuia.buildings b on b.id = a.building_id
    left join tribuia.profiles inv on inv.id = i.invited_by
    left join tribuia.profiles acc on acc.id = i.accepted_by
    where i.condominium_id = p_condominium
      and (p_status = 'ALL' or i.status::text = p_status)
  ) s;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- C. Reclamar mis invitaciones
-- ----------------------------------------------------------------------------
-- La llama el frontend al iniciar sesion. Convierte cada invitacion PENDING que
-- coincida con el correo del usuario en una membresia ACTIVA. No requiere
-- aprobacion posterior: la invitacion la creo un administrador.
-- ----------------------------------------------------------------------------
create or replace function tribuia.claim_my_invitations()
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_email   text;
  v_inv     record;
  v_claimed integer := 0;
  v_role    text;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion' using errcode = '42501';
  end if;

  select lower(email) into v_email from tribuia.profiles where id = v_user;
  if v_email is null then
    return jsonb_build_object('ok', true, 'claimed', 0);
  end if;

  -- Marcar como vencidas las que pasaron su fecha.
  update tribuia.condominium_invitations
     set status = 'EXPIRED'
   where lower(email) = v_email and status = 'PENDING' and expires_at < now();

  for v_inv in
    select i.*, r.code as role_code
    from tribuia.condominium_invitations i
    join tribuia.roles r on r.id = i.role_id
    where lower(i.email) = v_email and i.status = 'PENDING'
  loop
    v_role := v_inv.role_code;

    insert into tribuia.condominium_members
      (condominium_id, user_id, role_id, status, position)
    values (v_inv.condominium_id, v_user, v_inv.role_id, 'ACTIVE', v_inv.position)
    on conflict (condominium_id, user_id, role_id)
      do update set status = 'ACTIVE', position = excluded.position;

    -- Si la invitacion trae apartamento, se crea el vinculo correspondiente.
    if v_inv.apartment_id is not null then
      if v_role = 'OWNER' then
        insert into tribuia.apartment_owners
          (apartment_id, profile_id, ownership_percentage, is_primary, is_active)
        values (v_inv.apartment_id, v_user, 100, true, true)
        on conflict (apartment_id, profile_id) do update set is_active = true;
      elsif v_role = 'TENANT' then
        insert into tribuia.apartment_tenants (apartment_id, profile_id, is_active)
        values (v_inv.apartment_id, v_user, true)
        on conflict (apartment_id, profile_id) do update set is_active = true;
      end if;

      if v_role in ('OWNER', 'TENANT') then
        insert into tribuia.residents
          (condominium_id, apartment_id, profile_id, full_name, document_number,
           relationship, phone, email, is_active)
        select v_inv.condominium_id, v_inv.apartment_id, p.id, p.full_name, p.document_number,
               case when v_role = 'TENANT'
                    then 'TENANT'::tribuia.resident_relationship
                    else 'OWNER'::tribuia.resident_relationship end,
               p.phone, p.email, true
        from tribuia.profiles p
        where p.id = v_user
        on conflict (apartment_id, profile_id) do update set is_active = true;

        update tribuia.apartments
           set status = 'OCCUPIED'
         where id = v_inv.apartment_id and status = 'VACANT';
      end if;
    end if;

    update tribuia.condominium_invitations
       set status = 'ACCEPTED', accepted_by = v_user, accepted_at = now()
     where id = v_inv.id;

    -- Si tenia una solicitud de autoregistro pendiente para ese condominio,
    -- deja de tener sentido: la invitacion ya le dio acceso.
    update tribuia.registration_requests
       set status = 'CANCELLED',
           review_notes = 'Acceso concedido por invitacion del administrador',
           reviewed_at = now()
     where profile_id = v_user
       and condominium_id = v_inv.condominium_id
       and status = 'PENDING';

    v_claimed := v_claimed + 1;
  end loop;

  return jsonb_build_object('ok', true, 'claimed', v_claimed);
end;
$$;

-- ----------------------------------------------------------------------------
-- D. Permisos
-- ----------------------------------------------------------------------------
grant execute on function tribuia.create_invitation(uuid, text, text, text, uuid) to authenticated;
grant execute on function tribuia.revoke_invitation(uuid) to authenticated;
grant execute on function tribuia.invitations_for_condominium(uuid, text) to authenticated;
grant execute on function tribuia.claim_my_invitations() to authenticated;

grant select, insert, update, delete on tribuia.condominium_invitations to authenticated;

-- ----------------------------------------------------------------------------
-- Refresca el cache de esquema de PostgREST.
-- Sin esto, las funciones recien creadas pueden seguir respondiendo PGRST202
-- ("Falta una funcion en la base de datos") hasta que la API se reinicie sola.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================

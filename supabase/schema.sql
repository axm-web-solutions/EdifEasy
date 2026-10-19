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
--  16. Endurecimiento y rendimiento (RPC, InitPlan en politicas, indices)
--
-- El bloque 16 replica `supabase/patches/11-endurecimiento-y-rendimiento.sql`.
-- Se mantienen sincronizados a proposito: este archivo debe dejar la base en el
-- estado final aunque se ejecute solo.
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
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'visitor_type') then
    create type tribuia.visitor_type as enum ('VISIT', 'DELIVERY', 'PROVIDER', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'visitor_status') then
    create type tribuia.visitor_status as enum ('EXPECTED', 'INSIDE', 'LEFT', 'CANCELLED');
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

-- 3.13 Visitantes -----------------------------------------------------------------
-- Registro de personas externas (visitas, domicilios, proveedores) ligadas
-- siempre a un apartamento. El estado sigue el ciclo
-- EXPECTED (programado) -> INSIDE (entro) -> LEFT (salio), o CANCELLED.
create table if not exists tribuia.visitors (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  full_name       text not null,
  document_number text,
  phone           text,
  type            tribuia.visitor_type not null default 'VISIT',
  status          tribuia.visitor_status not null default 'EXPECTED',
  plate           text,
  company         text,
  scheduled_at    timestamptz,
  entry_at        timestamptz,
  exit_at         timestamptz,
  notes           text,
  registered_by   uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3.14 Alertas ------------------------------------------------------------------
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

-- 3.28 Modulos por rol (migracion 20261018000000_modulos_por_rol) ---------------
-- Una fila por (conjunto, rol, modulo). condominium_id null = PLANTILLA por
-- defecto. Resolucion: coalesce(fila del conjunto, fila de la plantilla, true).
-- Sin filas = todo habilitado. Se escribe solo via set_role_module /
-- reset_role_modules (seccion 17). La funcion module_enabled esta en 5.12.
create table if not exists tribuia.role_modules (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid references tribuia.condominiums (id) on delete cascade,
  role_code      text not null,
  module         text not null,
  enabled        boolean not null,
  updated_by     uuid references tribuia.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  constraint role_modules_scope_key unique nulls not distinct (condominium_id, role_code, module),
  constraint role_modules_role_code_check check (role_code in (
    'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT', 'SECURITY', 'SERVICE_STAFF'
  )),
  constraint role_modules_module_check check (module in (
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
    'marketplace', 'reservations'
  ))
);

comment on table tribuia.role_modules is
  'Modulos habilitados por rol. condominium_id null = plantilla por defecto. Sin fila = habilitado. Solo se escribe via set_role_module / reset_role_modules.';

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
create index if not exists idx_visitors_condominium on tribuia.visitors (condominium_id, status, scheduled_at desc);
create index if not exists idx_visitors_apartment on tribuia.visitors (apartment_id);
create index if not exists idx_visitors_scheduled_at on tribuia.visitors (scheduled_at desc);
create index if not exists idx_visitors_created_at on tribuia.visitors (created_at desc);
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

-- role_modules: el indice unico (condominium_id, role_code, module) resuelve las
-- busquedas por conjunto y por plantilla y cubre la FK de condominium_id.
-- Ruta rapida de module_enabled: solo indexa las filas deshabilitadas.
create index if not exists idx_role_modules_disabled
  on tribuia.role_modules (module, condominium_id) where not enabled;
create index if not exists idx_role_modules_updated_by
  on tribuia.role_modules (updated_by);

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

create or replace function tribuia.meeting_condominium(p_meeting uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select m.condominium_id from tribuia.meetings m where m.id = p_meeting;
$$;

create or replace function tribuia.conversation_creator(p_conversation uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select c.created_by from tribuia.conversations c where c.id = p_conversation;
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
    'documents', 'requests', 'incidents', 'fines', 'meetings', 'report_images',
    'visitors'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_tenant_ref on tribuia.%1$I', t);
    execute format(
      'create trigger trg_%1$s_tenant_ref before insert or update on tribuia.%1$I
       for each row execute function tribuia.tg_assert_tenant_reference()', t);
  end loop;
end
$$;

-- 5.12 Modulos por rol (migracion 20261018000000_modulos_por_rol) ------------
-- Catalogos (orden de presentacion de la matriz; deben coincidir con los checks
-- de tribuia.role_modules), module_enabled (RPC, resumenes) y
-- module_blocked_condominiums (politicas de la seccion 7). Las RPC de configuracion estan en la seccion 17.
create or replace function tribuia.role_module_roles()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT', 'SECURITY', 'SERVICE_STAFF']::text[];
$$;

create or replace function tribuia.role_module_codes()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array[
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
    'marketplace', 'reservations'
  ]::text[];
$$;

-- true si: no hay conjunto o usuario (service role), es SUPER_ADMIN, no tiene
-- membresia activa en el conjunto (decide la politica existente) o ALGUNO de
-- sus roles activos tiene el modulo habilitado, con
--   enabled = coalesce(fila del conjunto, fila de la plantilla, true).
-- Rendimiento: se evalua por fila. Ruta rapida: si no hay ninguna fila
-- `enabled = false` del modulo en el conjunto ni en la plantilla, una sola
-- sonda al indice parcial idx_role_modules_disabled y devuelve true.
create or replace function tribuia.module_enabled(
  p_condominium uuid,
  p_module      text,
  p_user        uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_enabled boolean;
begin
  -- Ruta rapida: sin conjunto, sin usuario (service role) o sin ninguna fila
  -- deshabilitada para el modulo (ni en el conjunto ni en la plantilla).
  if p_condominium is null
     or p_user is null
     or not exists (
       select 1
         from tribuia.role_modules rm
        where rm.module = p_module
          and not rm.enabled
          and (rm.condominium_id = p_condominium or rm.condominium_id is null)
     ) then
    return true;
  end if;

  if tribuia.is_super_admin(p_user) then
    return true;
  end if;

  -- Basta con que UNO de sus roles activos en el conjunto lo tenga habilitado.
  -- Sin membresias activas bool_or da null -> true (decide la politica).
  select bool_or(coalesce(rc.enabled, rt.enabled, true))
    into v_enabled
    from tribuia.condominium_members m
    join tribuia.roles r on r.id = m.role_id
    left join tribuia.role_modules rc
           on rc.condominium_id = p_condominium
          and rc.role_code = r.code
          and rc.module = p_module
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = p_module
   where m.condominium_id = p_condominium
     and m.user_id = p_user
     and m.status = 'ACTIVE';

  return coalesce(v_enabled, true);
end;
$$;

-- Version de conjunto de module_enabled para las politicas RLS: condominios
-- donde el modulo esta BLOQUEADO para el usuario (tiene membresias activas y
-- ninguno de sus roles lo tiene habilitado). Para cualquier condominio c:
--   module_enabled(c, m, u)  <=>  c not in (select module_blocked_condominiums(m, u))
-- Las politicas usan `<condominio> not in (select ...)`: PostgreSQL la resuelve
-- como subplan hasheado UNA vez por consulta y por fila solo hace una prueba de
-- pertenencia. Llamar a module_enabled por fila multiplicaba por ~40 el costo de
-- un count(*) (count=exact de PostgREST) sobre todo el conjunto.
-- Sin filas deshabilitadas para el modulo, SUPER_ADMIN o usuario null: vacio.
create or replace function tribuia.module_blocked_condominiums(
  p_module text,
  p_user   uuid default auth.uid()
)
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select m.condominium_id
    from tribuia.condominium_members m
    join tribuia.roles r on r.id = m.role_id
    left join tribuia.role_modules rc
           on rc.condominium_id = m.condominium_id
          and rc.role_code = r.code
          and rc.module = p_module
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = p_module
   where m.user_id = p_user
     and m.status = 'ACTIVE'
     and exists (select 1 from tribuia.role_modules d where d.module = p_module and not d.enabled)
     and not tribuia.is_super_admin(p_user)
   group by m.condominium_id
  having not bool_or(coalesce(rc.enabled, rt.enabled, true));
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
    'vehicles', 'pets', 'visitors', 'alerts', 'announcements', 'conversations',
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

  if v_condo is not null and not exists (select 1 from tribuia.condominiums c where c.id = v_condo) then
    v_condo := null;
  end if;

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
    'vehicles', 'pets', 'visitors', 'alerts', 'announcements', 'notifications', 'conversations',
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
-- Modulos por rol (seccion 17): todas las politicas de los modulos terminan en
-- `and <condominio> not in (select tribuia.module_blocked_condominiums('<modulo>'))`
-- (equivale a module_enabled, pero se evalua una vez por consulta; residents
-- agrupa residents, vehicles y pets).
create policy residents_select on tribuia.residents for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );
create policy residents_write on tribuia.residents for all to authenticated
  using (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  )
  with check (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );

-- 7.11 vehicles ------------------------------------------------------------------------
create policy vehicles_select on tribuia.vehicles for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );
create policy vehicles_write on tribuia.vehicles for all to authenticated
  using (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  )
  with check (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );

-- 7.12 pets -----------------------------------------------------------------------------
create policy pets_select on tribuia.pets for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );
create policy pets_write on tribuia.pets for all to authenticated
  using (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  )
  with check (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('residents'))
  );

-- 7.13 visitors ------------------------------------------------------------------
-- Celaduria puede ver todos los visitantes del condominio y registrar/actualizar
-- el ciclo de entrada/salida. Los residentes (propietario/arrendatario) solo ven
-- y gestionan los visitantes de sus propios apartamentos.
create policy visitors_select on tribuia.visitors for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('visitors'))
  );
create policy visitors_write on tribuia.visitors for all to authenticated
  using (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.has_role(condominium_id, array['SECURITY'])
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('visitors'))
  )
  with check (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.has_role(condominium_id, array['SECURITY'])
      or tribuia.user_owns_apartment(apartment_id)
      or tribuia.user_is_tenant(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('visitors'))
  );

-- 7.14 alerts ----------------------------------------------------------------------------
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
    and condominium_id not in (select tribuia.module_blocked_condominiums('alerts'))
  );

create policy alerts_insert on tribuia.alerts for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('alerts'))
  );

create policy alerts_update on tribuia.alerts for update to authenticated
  using (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']) or created_by = auth.uid())
    and condominium_id not in (select tribuia.module_blocked_condominiums('alerts'))
  )
  with check (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']) or created_by = auth.uid())
    and condominium_id not in (select tribuia.module_blocked_condominiums('alerts'))
  );

create policy alerts_delete on tribuia.alerts for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('alerts')));

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
    and condominium_id not in (select tribuia.module_blocked_condominiums('announcements'))
  );

create policy announcements_insert on tribuia.announcements for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('announcements'))
  );

create policy announcements_update on tribuia.announcements for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('announcements'))
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('announcements'))
  );

create policy announcements_delete on tribuia.announcements for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('announcements')));

-- 7.15 notifications -------------------------------------------------------------------------
create policy notifications_select on tribuia.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_insert on tribuia.notifications for insert to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and (condominium_id is null or tribuia.user_can_access_condominium(condominium_id))
    )
    or (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
      and tribuia.user_can_access_condominium(condominium_id, user_id)
    )
  );
create policy notifications_update on tribuia.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on tribuia.notifications for delete to authenticated
  using (user_id = auth.uid());

-- 7.16 conversations / participants / messages -------------------------------------------------
-- `created_by` se incluye para que el INSERT ... RETURNING funcione: al crear la
-- conversacion el autor todavia no figura en conversation_participants.
-- Modulo 'messages': conversations, conversation_participants y messages (los
-- participantes toman el condominio de la conversacion).
create policy conversations_select on tribuia.conversations for select to authenticated
  using (
    (
      created_by = auth.uid()
      or tribuia.is_conversation_participant(id)
      or tribuia.is_condominium_admin(condominium_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy conversations_insert on tribuia.conversations for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy conversations_update on tribuia.conversations for update to authenticated
  using (
    (tribuia.is_conversation_participant(id) or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  )
  with check (
    (tribuia.is_conversation_participant(id) or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy conversations_delete on tribuia.conversations for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('messages')));

create policy participants_select on tribuia.conversation_participants for select to authenticated
  using (
    (
      user_id = (select auth.uid())
      or tribuia.is_conversation_participant(conversation_id)
      or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id))
    )
    and tribuia.conversation_condominium(conversation_id) not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy participants_insert on tribuia.conversation_participants for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(tribuia.conversation_condominium(conversation_id))
    and tribuia.user_can_access_condominium(tribuia.conversation_condominium(conversation_id), user_id)
    and (
      tribuia.conversation_creator(conversation_id) = (select auth.uid())
      or tribuia.is_conversation_participant(conversation_id)
      or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id))
    )
    and tribuia.conversation_condominium(conversation_id) not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy participants_update on tribuia.conversation_participants for update to authenticated
  using (
    user_id = auth.uid()
    and tribuia.conversation_condominium(conversation_id) not in (select tribuia.module_blocked_condominiums('messages'))
  )
  with check (
    user_id = auth.uid()
    and tribuia.conversation_condominium(conversation_id) not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy participants_delete on tribuia.conversation_participants for delete to authenticated
  using (
    (user_id = auth.uid() or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id)))
    and tribuia.conversation_condominium(conversation_id) not in (select tribuia.module_blocked_condominiums('messages'))
  );

create policy messages_select on tribuia.messages for select to authenticated
  using (
    (tribuia.is_conversation_participant(conversation_id) or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy messages_insert on tribuia.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and tribuia.is_conversation_participant(conversation_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy messages_update on tribuia.messages for update to authenticated
  using (
    sender_id = (select auth.uid())
    and tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  )
  with check (
    sender_id = (select auth.uid())
    and tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );
create policy messages_delete on tribuia.messages for delete to authenticated
  using (
    (sender_id = auth.uid() or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('messages'))
  );

-- 7.17 requests -----------------------------------------------------------------------------------
-- Modulo 'requests': requests y request_comments (condominio de la solicitud).
create policy requests_select on tribuia.requests for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF', 'SECURITY'])
      or created_by = auth.uid()
      or assigned_to = auth.uid()
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy requests_insert on tribuia.requests for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(condominium_id)
    and created_by = auth.uid()
    and condominium_id not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy requests_update on tribuia.requests for update to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
      or (
        tribuia.user_can_access_condominium(condominium_id)
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
      )
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('requests'))
  )
  with check (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
      or (
        tribuia.user_can_access_condominium(condominium_id)
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
      )
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy requests_delete on tribuia.requests for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('requests')));

create policy request_comments_select on tribuia.request_comments for select to authenticated
  using (
    (
      tribuia.has_role(tribuia.request_condominium(request_id), array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF'])
      or tribuia.request_owner(request_id) = auth.uid()
      or tribuia.request_apartment(request_id) in (select tribuia.user_apartment_ids())
    )
    and tribuia.request_condominium(request_id) not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy request_comments_insert on tribuia.request_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      tribuia.has_role(tribuia.request_condominium(request_id), array['ADMINISTRATOR', 'SPOKESPERSON', 'SERVICE_STAFF'])
      or tribuia.request_owner(request_id) = auth.uid()
      or tribuia.request_apartment(request_id) in (select tribuia.user_apartment_ids())
    )
    and tribuia.request_condominium(request_id) not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy request_comments_update on tribuia.request_comments for update to authenticated
  using (
    author_id = auth.uid()
    and tribuia.request_condominium(request_id) not in (select tribuia.module_blocked_condominiums('requests'))
  )
  with check (
    author_id = auth.uid()
    and tribuia.request_condominium(request_id) not in (select tribuia.module_blocked_condominiums('requests'))
  );
create policy request_comments_delete on tribuia.request_comments for delete to authenticated
  using (
    (author_id = auth.uid() or tribuia.is_condominium_admin(tribuia.request_condominium(request_id)))
    and tribuia.request_condominium(request_id) not in (select tribuia.module_blocked_condominiums('requests'))
  );

-- 7.18 incidents ----------------------------------------------------------------------------------
create policy incidents_select on tribuia.incidents for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF'])
      or reported_by = auth.uid()
      or assigned_to = auth.uid()
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('incidents'))
  );
create policy incidents_insert on tribuia.incidents for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('incidents'))
  );
create policy incidents_update on tribuia.incidents for update to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
      or (
        tribuia.user_can_access_condominium(condominium_id)
        and (reported_by = (select auth.uid()) or assigned_to = (select auth.uid()))
      )
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('incidents'))
  )
  with check (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
      or (
        tribuia.user_can_access_condominium(condominium_id)
        and (reported_by = (select auth.uid()) or assigned_to = (select auth.uid()))
      )
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('incidents'))
  );
create policy incidents_delete on tribuia.incidents for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('incidents')));

-- 7.19 finanzas: expense_categories / expenses -----------------------------------------------------
-- Modulo 'expenses': expenses y expense_categories.
create policy expense_categories_select on tribuia.expense_categories for select to authenticated
  using (tribuia.can_view_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')));
create policy expense_categories_write on tribuia.expense_categories for all to authenticated
  using (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')))
  with check (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')));

create policy expenses_select on tribuia.expenses for select to authenticated
  using (tribuia.can_view_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')));
create policy expenses_write on tribuia.expenses for all to authenticated
  using (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')))
  with check (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('expenses')));

-- 7.20 purchases -------------------------------------------------------------------------------------
-- Modulo 'purchases': purchases y purchase_items (condominio de la compra).
create policy purchases_select on tribuia.purchases for select to authenticated
  using (tribuia.can_view_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('purchases')));
create policy purchases_write on tribuia.purchases for all to authenticated
  using (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('purchases')))
  with check (tribuia.can_manage_finance(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('purchases')));

create policy purchase_items_select on tribuia.purchase_items for select to authenticated
  using (
    tribuia.can_view_finance(tribuia.purchase_condominium(purchase_id))
    and tribuia.purchase_condominium(purchase_id) not in (select tribuia.module_blocked_condominiums('purchases'))
  );
create policy purchase_items_write on tribuia.purchase_items for all to authenticated
  using (
    tribuia.can_manage_finance(tribuia.purchase_condominium(purchase_id))
    and tribuia.purchase_condominium(purchase_id) not in (select tribuia.module_blocked_condominiums('purchases'))
  )
  with check (
    tribuia.can_manage_finance(tribuia.purchase_condominium(purchase_id))
    and tribuia.purchase_condominium(purchase_id) not in (select tribuia.module_blocked_condominiums('purchases'))
  );

-- 7.21 fines ------------------------------------------------------------------------------------------
create policy fines_select on tribuia.fines for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('fines'))
  );
create policy fines_write on tribuia.fines for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('fines')))
  with check (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('fines')));

-- 7.22 documents ---------------------------------------------------------------------------------------
-- Modulo 'documents': documents y document_categories.
create policy document_categories_select on tribuia.document_categories for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('documents')));
create policy document_categories_write on tribuia.document_categories for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('documents')))
  with check (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('documents')));

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
    and condominium_id not in (select tribuia.module_blocked_condominiums('documents'))
  );
create policy documents_insert on tribuia.documents for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and uploaded_by = auth.uid()
    and condominium_id not in (select tribuia.module_blocked_condominiums('documents'))
  );
create policy documents_update on tribuia.documents for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('documents'))
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('documents'))
  );
create policy documents_delete on tribuia.documents for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('documents')));

-- 7.23 audit_logs -----------------------------------------------------------------------------------------
create policy audit_logs_select on tribuia.audit_logs for select to authenticated
  using (user_id = auth.uid() or tribuia.is_condominium_admin(condominium_id) or tribuia.is_super_admin());
create policy audit_logs_insert on tribuia.audit_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (condominium_id is null or tribuia.user_can_access_condominium(condominium_id))
  );

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
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
  );
create policy meeting_signatures_update on tribuia.meeting_signatures for update to authenticated
  using (
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
  )
  with check (
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
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
                           'requests', 'incidents', 'announcements', 'visitors']
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
        'condominium_logo_url', c.logo_url,
        'condominium_primary_color', c.settings->>'primaryColor',
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

drop trigger if exists trg_registration_requests_tenant_ref on tribuia.registration_requests;
create trigger trg_registration_requests_tenant_ref before insert or update on tribuia.registration_requests
  for each row execute function tribuia.tg_assert_tenant_reference();

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

drop trigger if exists trg_condominium_invitations_tenant_ref on tribuia.condominium_invitations;
create trigger trg_condominium_invitations_tenant_ref before insert or update on tribuia.condominium_invitations
  for each row execute function tribuia.tg_assert_tenant_reference();

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

-- ============================================================================
-- PAGOS CON WOMPI (parche 09): cuotas de administracion y planes del sistema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. TIPOS ENUM
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'payment_kind') then
    create type tribuia.payment_kind as enum ('ADMIN_FEE', 'SUBSCRIPTION');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'payment_status') then
    create type tribuia.payment_status as enum ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'plan_period') then
    create type tribuia.plan_period as enum ('MONTHLY', 'SEMIANNUAL', 'ANNUAL');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'admin_fee_status') then
    create type tribuia.admin_fee_status as enum ('PENDING', 'PAID', 'CANCELLED');
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- B. TABLAS
-- ----------------------------------------------------------------------------

-- Cuotas de administracion: una por apartamento y por mes.
create table if not exists tribuia.admin_fees (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  period          date not null,               -- primer dia del mes cobrado
  amount          numeric(14, 2) not null check (amount > 0),
  due_date        date not null,
  status          tribuia.admin_fee_status not null default 'PENDING',
  paid_at         timestamptz,
  payment_method  text,                        -- WOMPI, CASH, TRANSFER...
  notes           text,
  created_by      uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (apartment_id, period)
);

create index if not exists idx_admin_fees_condominium on tribuia.admin_fees (condominium_id, period desc, status);
create index if not exists idx_admin_fees_apartment on tribuia.admin_fees (apartment_id, period desc);

-- Intentos de pago (cada clic en "Pagar" crea uno con su referencia unica).
create table if not exists tribuia.payments (
  id                    uuid primary key default gen_random_uuid(),
  condominium_id        uuid not null references tribuia.condominiums (id) on delete cascade,
  kind                  tribuia.payment_kind not null,
  reference             text not null unique,
  amount                numeric(14, 2) not null check (amount > 0),
  currency              text not null default 'COP',
  status                tribuia.payment_status not null default 'PENDING',
  payer_id              uuid references tribuia.profiles (id) on delete set null,
  admin_fee_id          uuid references tribuia.admin_fees (id),
  plan_period           tribuia.plan_period,
  apartments_count      integer,
  unit_price            numeric(14, 2),
  wompi_transaction_id  text,
  payment_method        text,
  status_message        text,
  paid_at               timestamptz,
  raw                   jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    (kind = 'ADMIN_FEE' and admin_fee_id is not null)
    or (kind = 'SUBSCRIPTION' and plan_period is not null)
  )
);

create index if not exists idx_payments_condominium on tribuia.payments (condominium_id, kind, created_at desc);
create index if not exists idx_payments_payer on tribuia.payments (payer_id, created_at desc);
create index if not exists idx_payments_admin_fee on tribuia.payments (admin_fee_id);

alter table tribuia.admin_fees
  add column if not exists payment_id uuid references tribuia.payments (id) on delete set null;

-- Periodos pagados del plan del sistema.
create table if not exists tribuia.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  condominium_id    uuid not null references tribuia.condominiums (id) on delete cascade,
  plan_period       tribuia.plan_period not null,
  apartments_count  integer not null,
  unit_price        numeric(14, 2) not null,
  amount            numeric(14, 2) not null,
  starts_at         date not null,
  ends_at           date not null,
  payment_id        uuid references tribuia.payments (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_subscriptions_condominium on tribuia.subscriptions (condominium_id, ends_at desc);

drop trigger if exists trg_admin_fees_updated_at on tribuia.admin_fees;
create trigger trg_admin_fees_updated_at
  before update on tribuia.admin_fees
  for each row execute function tribuia.set_updated_at();

-- Integridad de referencias multi-tenant (apartamento del mismo condominio).
drop trigger if exists trg_admin_fees_tenant_ref on tribuia.admin_fees;
create trigger trg_admin_fees_tenant_ref before insert or update on tribuia.admin_fees
  for each row execute function tribuia.tg_assert_tenant_reference();

drop trigger if exists trg_payments_updated_at on tribuia.payments;
create trigger trg_payments_updated_at
  before update on tribuia.payments
  for each row execute function tribuia.set_updated_at();

-- ----------------------------------------------------------------------------
-- C. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table tribuia.admin_fees enable row level security;
alter table tribuia.payments enable row level security;
alter table tribuia.subscriptions enable row level security;

drop policy if exists admin_fees_select on tribuia.admin_fees;
drop policy if exists admin_fees_write on tribuia.admin_fees;
drop policy if exists payments_select on tribuia.payments;
drop policy if exists subscriptions_select on tribuia.subscriptions;

-- Administracion ve todas las cuotas; cada propietario solo las suyas.
-- Modulos por rol (seccion 17): ambas politicas exigen el modulo 'admin_fees'.
create policy admin_fees_select on tribuia.admin_fees for select to authenticated
  using (
    (
      tribuia.is_condominium_admin(condominium_id)
      or tribuia.user_owns_apartment(apartment_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('admin_fees'))
  );

-- Solo administracion crea/edita cuotas (p. ej. registrar un pago en efectivo).
-- Los pagos en linea los marca `apply_payment_result` desde la Edge Function.
create policy admin_fees_write on tribuia.admin_fees for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('admin_fees')))
  with check (tribuia.is_condominium_admin(condominium_id) and condominium_id not in (select tribuia.module_blocked_condominiums('admin_fees')));

-- Pagos: quien paga ve los suyos; administracion ve los del conjunto.
-- Sin politicas de escritura: solo la service role (Edge Function) escribe.
create policy payments_select on tribuia.payments for select to authenticated
  using (
    payer_id = auth.uid()
    or tribuia.is_condominium_admin(condominium_id)
  );

create policy subscriptions_select on tribuia.subscriptions for select to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

grant select, insert, update, delete on tribuia.admin_fees to authenticated;
grant select on tribuia.payments to authenticated;
grant select on tribuia.subscriptions to authenticated;
grant all on tribuia.admin_fees, tribuia.payments, tribuia.subscriptions to service_role;

-- ----------------------------------------------------------------------------
-- D. FUNCIONES
-- ----------------------------------------------------------------------------

-- Precio del plan. Unica fuente de verdad: la usa la pantalla de planes para
-- mostrar valores y la Edge Function para cobrar (nunca se confia en el cliente).
create or replace function tribuia.subscription_quote(p_condominium uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count  integer;
  v_unit   numeric;
  v_active jsonb;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  select count(*) into v_count from tribuia.apartments where condominium_id = p_condominium;
  v_unit := case when v_count < 80 then 4500 else 4000 end;

  select to_jsonb(s) into v_active
    from tribuia.subscriptions s
   where s.condominium_id = p_condominium
   order by s.ends_at desc
   limit 1;

  return jsonb_build_object(
    'apartments_count', v_count,
    'unit_price', v_unit,
    'plans', jsonb_build_array(
      jsonb_build_object('period', 'MONTHLY',    'months', 1,  'amount', v_count * v_unit * 1),
      jsonb_build_object('period', 'SEMIANNUAL', 'months', 6,  'amount', v_count * v_unit * 6),
      jsonb_build_object('period', 'ANNUAL',     'months', 12, 'amount', v_count * v_unit * 12)
    ),
    'current', v_active
  );
end;
$$;

-- Genera la cuota del mes para cada apartamento con propietario activo.
-- Las que ya existen para ese mes no se duplican. Guarda el valor como
-- predeterminado del conjunto (settings.adminFeeAmount).
create or replace function tribuia.generate_admin_fees(
  p_condominium uuid,
  p_period date,
  p_amount numeric,
  p_due_date date
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_count  integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;
  -- SECURITY DEFINER no pasa por RLS: control explicito de modulos por rol.
  if not tribuia.module_enabled(p_condominium, 'admin_fees') then
    raise exception 'El modulo de cuotas de administracion no esta habilitado para tu rol'
      using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El valor de la cuota debe ser mayor a cero';
  end if;
  if p_due_date < v_period then
    raise exception 'La fecha limite no puede ser anterior al mes que se cobra';
  end if;

  insert into tribuia.admin_fees (condominium_id, apartment_id, period, amount, due_date, created_by)
  select p_condominium, a.id, v_period, p_amount, p_due_date, auth.uid()
    from tribuia.apartments a
   where a.condominium_id = p_condominium
     and exists (
       select 1 from tribuia.apartment_owners o
        where o.apartment_id = a.id and o.is_active
     )
  on conflict (apartment_id, period) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums
     set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('adminFeeAmount', p_amount)
   where id = p_condominium;

  return v_count;
end;
$$;

-- Aplica el resultado de una transaccion de Wompi. Idempotente: un pago ya
-- aprobado no se vuelve a procesar. Verifica que el monto cobrado coincida con
-- el registrado. Solo la invoca la service role (Edge Functions).
create or replace function tribuia.apply_payment_result(
  p_reference       text,
  p_transaction_id  text,
  p_status          text,
  p_amount_in_cents bigint,
  p_currency        text,
  p_method          text,
  p_message         text,
  p_payload         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_payment tribuia.payments%rowtype;
  v_status  tribuia.payment_status;
  v_start   date;
  v_months  integer;
begin
  select * into v_payment from tribuia.payments where reference = p_reference for update;
  if not found then
    raise exception 'Pago no encontrado: %', p_reference;
  end if;

  if v_payment.status = 'APPROVED' then
    return jsonb_build_object('id', v_payment.id, 'status', v_payment.status, 'kind', v_payment.kind);
  end if;

  v_status := case p_status
    when 'APPROVED' then 'APPROVED'
    when 'DECLINED' then 'DECLINED'
    when 'VOIDED'   then 'VOIDED'
    when 'ERROR'    then 'ERROR'
    else 'PENDING'
  end::tribuia.payment_status;

  -- Proteccion contra montos manipulados: lo cobrado debe ser lo registrado.
  if v_status = 'APPROVED'
     and (p_amount_in_cents <> round(v_payment.amount * 100) or coalesce(p_currency, 'COP') <> v_payment.currency) then
    v_status := 'ERROR';
    p_message := 'El monto cobrado no coincide con el valor del pago';
  end if;

  update tribuia.payments
     set status = v_status,
         wompi_transaction_id = coalesce(p_transaction_id, wompi_transaction_id),
         payment_method = coalesce(p_method, payment_method),
         status_message = p_message,
         paid_at = case when v_status = 'APPROVED' then now() else paid_at end,
         raw = coalesce(p_payload, '{}'::jsonb)
   where id = v_payment.id;

  if v_status = 'APPROVED' then
    if v_payment.kind = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    else
      -- El nuevo periodo empieza hoy o cuando termine el plan vigente.
      select greatest(current_date, coalesce(max(ends_at), current_date)) into v_start
        from tribuia.subscriptions where condominium_id = v_payment.condominium_id;

      v_months := case v_payment.plan_period
        when 'MONTHLY' then 1 when 'SEMIANNUAL' then 6 else 12 end;

      insert into tribuia.subscriptions
        (condominium_id, plan_period, apartments_count, unit_price, amount, starts_at, ends_at, payment_id)
      values
        (v_payment.condominium_id, v_payment.plan_period, v_payment.apartments_count,
         v_payment.unit_price, v_payment.amount, v_start,
         (v_start + make_interval(months => v_months))::date, v_payment.id);
    end if;
  end if;

  return jsonb_build_object('id', v_payment.id, 'status', v_status, 'kind', v_payment.kind);
end;
$$;

revoke all on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) to service_role;
grant execute on function tribuia.subscription_quote(uuid) to authenticated, service_role;
grant execute on function tribuia.generate_admin_fees(uuid, date, numeric, date) to authenticated;

-- ============================================================================
-- PAGO DE MULTAS CON WOMPI (parche 10)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ENUM
-- ----------------------------------------------------------------------------
alter type tribuia.payment_kind add value if not exists 'FINE';

-- ----------------------------------------------------------------------------
-- B. PAGOS: referencia a la multa
-- ----------------------------------------------------------------------------
alter table tribuia.payments
  add column if not exists fine_id uuid references tribuia.fines (id);

create index if not exists idx_payments_fine on tribuia.payments (fine_id);

-- payments.admin_fee_id / fine_id eran ON DELETE SET NULL, lo que choca con
-- payments_target_check y abortaba el borrado del conjunto (y de bloques,
-- apartamentos, cuotas o multas con intentos de pago). Con NO ACTION la
-- verificacion ocurre al final de la sentencia: borrar el condominio completo
-- (que borra tambien sus pagos) funciona, y borrar una cuota o multa con pagos
-- se rechaza con un error de FK claro (se debe anular, no borrar).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payments_admin_fee_id_fkey' and conrelid = 'tribuia.payments'::regclass
      and confdeltype <> 'a'
  ) then
    alter table tribuia.payments drop constraint payments_admin_fee_id_fkey;
    alter table tribuia.payments add constraint payments_admin_fee_id_fkey
      foreign key (admin_fee_id) references tribuia.admin_fees (id);
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'payments_fine_id_fkey' and conrelid = 'tribuia.payments'::regclass
      and confdeltype <> 'a'
  ) then
    alter table tribuia.payments drop constraint payments_fine_id_fkey;
    alter table tribuia.payments add constraint payments_fine_id_fkey
      foreign key (fine_id) references tribuia.fines (id);
  end if;
end
$$;

-- Cada tipo de pago apunta a lo que paga. Se compara `kind::text` porque el
-- valor 'FINE' recien agregado no puede usarse como literal en esta transaccion.
alter table tribuia.payments drop constraint if exists payments_check;
alter table tribuia.payments drop constraint if exists payments_target_check;
alter table tribuia.payments add constraint payments_target_check check (
  (kind::text = 'ADMIN_FEE' and admin_fee_id is not null)
  or (kind::text = 'SUBSCRIPTION' and plan_period is not null)
  or (kind::text = 'FINE' and fine_id is not null)
);

-- ----------------------------------------------------------------------------
-- C. MULTAS: datos del pago
-- ----------------------------------------------------------------------------
alter table tribuia.fines add column if not exists paid_at timestamptz;
alter table tribuia.fines add column if not exists payment_method text;
alter table tribuia.fines
  add column if not exists payment_id uuid references tribuia.payments (id) on delete set null;

-- ----------------------------------------------------------------------------
-- D. APLICAR RESULTADO (reemplaza la version del parche 09)
-- ----------------------------------------------------------------------------
-- Aplica el resultado de una transaccion de Wompi. Idempotente: un pago ya
-- aprobado no se vuelve a procesar. Verifica que el monto cobrado coincida con
-- el registrado. Solo la invoca la service role (Edge Functions).
create or replace function tribuia.apply_payment_result(
  p_reference       text,
  p_transaction_id  text,
  p_status          text,
  p_amount_in_cents bigint,
  p_currency        text,
  p_method          text,
  p_message         text,
  p_payload         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_payment tribuia.payments%rowtype;
  v_status  tribuia.payment_status;
  v_start   date;
  v_months  integer;
begin
  select * into v_payment from tribuia.payments where reference = p_reference for update;
  if not found then
    raise exception 'Pago no encontrado: %', p_reference;
  end if;

  if v_payment.status = 'APPROVED' then
    return jsonb_build_object('id', v_payment.id, 'status', v_payment.status, 'kind', v_payment.kind);
  end if;

  v_status := case p_status
    when 'APPROVED' then 'APPROVED'
    when 'DECLINED' then 'DECLINED'
    when 'VOIDED'   then 'VOIDED'
    when 'ERROR'    then 'ERROR'
    else 'PENDING'
  end::tribuia.payment_status;

  -- Proteccion contra montos manipulados: lo cobrado debe ser lo registrado.
  if v_status = 'APPROVED'
     and (p_amount_in_cents <> round(v_payment.amount * 100) or coalesce(p_currency, 'COP') <> v_payment.currency) then
    v_status := 'ERROR';
    p_message := 'El monto cobrado no coincide con el valor del pago';
  end if;

  update tribuia.payments
     set status = v_status,
         wompi_transaction_id = coalesce(p_transaction_id, wompi_transaction_id),
         payment_method = coalesce(p_method, payment_method),
         status_message = p_message,
         paid_at = case when v_status = 'APPROVED' then now() else paid_at end,
         raw = coalesce(p_payload, '{}'::jsonb)
   where id = v_payment.id;

  if v_status = 'APPROVED' then
    -- Se compara como texto: 'FINE' se agrega al enum en este mismo script.
    if v_payment.kind::text = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    elsif v_payment.kind::text = 'FINE' then
      update tribuia.fines
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.fine_id;
    else
      -- El nuevo periodo empieza hoy o cuando termine el plan vigente.
      select greatest(current_date, coalesce(max(ends_at), current_date)) into v_start
        from tribuia.subscriptions where condominium_id = v_payment.condominium_id;

      v_months := case v_payment.plan_period
        when 'MONTHLY' then 1 when 'SEMIANNUAL' then 6 else 12 end;

      insert into tribuia.subscriptions
        (condominium_id, plan_period, apartments_count, unit_price, amount, starts_at, ends_at, payment_id)
      values
        (v_payment.condominium_id, v_payment.plan_period, v_payment.apartments_count,
         v_payment.unit_price, v_payment.amount, v_start,
         (v_start + make_interval(months => v_months))::date, v_payment.id);
    end if;
  end if;

  return jsonb_build_object('id', v_payment.id, 'status', v_status, 'kind', v_payment.kind);
end;
$$;

revoke all on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) to service_role;

-- ============================================================================
-- UBICACION DEL CONDOMINIO Y LUGARES CERCANOS GUARDADOS
-- (migracion 20261014100000_ubicacion_condominios)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. COORDENADAS DEL CONDOMINIO
-- ----------------------------------------------------------------------------
alter table tribuia.condominiums add column if not exists latitude numeric(9, 6);
alter table tribuia.condominiums add column if not exists longitude numeric(9, 6);
-- Direccion tal como la resolvio el mapa.
alter table tribuia.condominiums add column if not exists location_label text;
-- true si no se encontro la direccion exacta y se uso la ciudad.
alter table tribuia.condominiums add column if not exists location_approximate boolean not null default false;
-- Texto de direccion que se geocodifico: si la direccion cambia, se vuelve a ubicar.
alter table tribuia.condominiums add column if not exists location_source text;
alter table tribuia.condominiums add column if not exists places_updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- B. LUGARES CERCANOS
-- ----------------------------------------------------------------------------
create table if not exists tribuia.condominium_places (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  osm_id          text not null,
  name            text not null,
  category        text not null,
  latitude        numeric(9, 6) not null,
  longitude       numeric(9, 6) not null,
  distance_m      integer not null,
  address         text,
  created_at      timestamptz not null default now(),
  unique (condominium_id, osm_id)
);

create index if not exists idx_condominium_places_condominium
  on tribuia.condominium_places (condominium_id, distance_m);

alter table tribuia.condominium_places enable row level security;

drop policy if exists condominium_places_select on tribuia.condominium_places;
create policy condominium_places_select on tribuia.condominium_places for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));

-- Sin politicas de escritura: solo se escribe con `replace_condominium_location`.
grant select on tribuia.condominium_places to authenticated;
grant all on tribuia.condominium_places to service_role;

-- ----------------------------------------------------------------------------
-- C. GUARDAR UBICACION Y LUGARES (atomico)
-- ----------------------------------------------------------------------------
-- p_location: { latitude, longitude, label, approximate, source } o null si no
--             cambio la ubicacion (solo se refrescan los lugares).
-- p_places:   [{ osm_id, name, category, latitude, longitude, distance_m, address }]
create or replace function tribuia.replace_condominium_location(
  p_condominium uuid,
  p_location jsonb,
  p_places jsonb
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'Solo la administracion del conjunto puede actualizar su ubicacion'
      using errcode = '42501';
  end if;

  if p_location is not null then
    update tribuia.condominiums
       set latitude = (p_location ->> 'latitude')::numeric,
           longitude = (p_location ->> 'longitude')::numeric,
           location_label = p_location ->> 'label',
           location_approximate = coalesce((p_location ->> 'approximate')::boolean, false),
           location_source = p_location ->> 'source'
     where id = p_condominium;
  end if;

  delete from tribuia.condominium_places where condominium_id = p_condominium;

  insert into tribuia.condominium_places
    (condominium_id, osm_id, name, category, latitude, longitude, distance_m, address)
  select p_condominium,
         p.osm_id, left(p.name, 200), p.category, p.latitude, p.longitude, p.distance_m,
         left(p.address, 300)
    from jsonb_to_recordset(coalesce(p_places, '[]'::jsonb)) as p(
      osm_id text, name text, category text, latitude numeric, longitude numeric,
      distance_m integer, address text
    )
   where p.osm_id is not null and p.name is not null
  on conflict (condominium_id, osm_id) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums set places_updated_at = now() where id = p_condominium;

  return v_count;
end;
$$;

revoke all on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) from public, anon;
grant execute on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) to authenticated;

-- ============================================================================
-- 14. ALCANCE POR CONDOMINIO (migracion 20261014120000_admin_scope_fixes)
-- ============================================================================

-- A. Columnas de tenant inmutables para usuarios finales --------------------
-- tg_argv = columnas que no pueden cambiar en un UPDATE. auth.uid() nulo es la
-- service role, el SQL Editor o un trigger de sistema: no se restringe.
create or replace function tribuia.tg_lock_tenant_columns()
returns trigger
language plpgsql
set search_path = tribuia, public, pg_temp
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_col text;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Primero se comparan las columnas (barato); is_super_admin solo si cambiaron.
  foreach v_col in array tg_argv loop
    if (v_new -> v_col) is distinct from (v_old -> v_col) and not tribuia.is_super_admin() then
      raise exception 'No se puede cambiar % de un registro de %', v_col, tg_table_name
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('condominium_members',       'condominium_id'),
      ('buildings',                 'condominium_id'),
      ('apartments',                'condominium_id'),
      ('residents',                 'condominium_id'),
      ('vehicles',                  'condominium_id'),
      ('pets',                      'condominium_id'),
      ('visitors',                  'condominium_id'),
      ('alerts',                    'condominium_id'),
      ('announcements',             'condominium_id'),
      ('notifications',             'condominium_id'),
      ('conversations',             'condominium_id'),
      ('messages',                  'condominium_id,conversation_id'),
      ('requests',                  'condominium_id'),
      ('incidents',                 'condominium_id'),
      ('expense_categories',        'condominium_id'),
      ('expenses',                  'condominium_id'),
      ('purchases',                 'condominium_id'),
      ('fines',                     'condominium_id'),
      ('document_categories',       'condominium_id'),
      ('documents',                 'condominium_id'),
      ('audit_logs',                'condominium_id'),
      ('meetings',                  'condominium_id'),
      ('reports',                   'condominium_id'),
      ('registration_requests',     'condominium_id'),
      ('condominium_invitations',   'condominium_id'),
      ('admin_fees',                'condominium_id'),
      ('conversation_participants', 'conversation_id'),
      ('request_comments',          'request_id'),
      ('meeting_signatures',        'meeting_id'),
      ('report_images',             'report_id'),
      ('purchase_items',            'purchase_id')
    ) as t(tbl, cols)
  loop
    execute format('drop trigger if exists trg_%1$s_lock_tenant on tribuia.%1$I', spec.tbl);
    execute format(
      'create trigger trg_%1$s_lock_tenant before update on tribuia.%1$I
       for each row execute function tribuia.tg_lock_tenant_columns(%2$s)',
      spec.tbl,
      (select string_agg(quote_literal(c), ', ') from unnest(string_to_array(spec.cols, ',')) c));
  end loop;
end
$$;

-- B. Roles globales fuera de membresias e invitaciones ---------------------
create or replace function tribuia.tg_reject_global_role()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if exists (select 1 from tribuia.roles r where r.id = new.role_id and r.is_global) then
    raise exception 'Un rol global (SUPER_ADMIN) no se asigna por condominio'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_condominium_members_global_role on tribuia.condominium_members;
create trigger trg_condominium_members_global_role
  before insert or update of role_id on tribuia.condominium_members
  for each row execute function tribuia.tg_reject_global_role();

drop trigger if exists trg_invitations_global_role on tribuia.condominium_invitations;
create trigger trg_invitations_global_role
  before insert or update of role_id on tribuia.condominium_invitations
  for each row execute function tribuia.tg_reject_global_role();

-- C. profiles: correo y estado no los cambia el propio usuario --------------
-- `claim_my_invitations` y `add_member_by_email` confian en profiles.email: si
-- el usuario pudiera cambiarlo, reclamaria invitaciones de otra persona (por
-- ejemplo, una de ADMINISTRATOR en otro conjunto).
create or replace function tribuia.tg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if auth.uid() is null or tribuia.is_super_admin() then
    return new;
  end if;

  if lower(new.email) is distinct from lower(old.email)
     and lower(new.email) is distinct from (select lower(u.email) from auth.users u where u.id = new.id) then
    raise exception 'El correo se cambia desde la cuenta de acceso, no desde el perfil'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Solo un super administrador cambia el estado de un perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on tribuia.profiles;
create trigger trg_profiles_guard
  before update on tribuia.profiles
  for each row execute function tribuia.tg_profiles_guard();

-- Funciones de trigger: no se invocan por RPC.
revoke execute on function tribuia.tg_lock_tenant_columns() from public, anon, authenticated;
revoke execute on function tribuia.tg_reject_global_role() from public, anon, authenticated;
revoke execute on function tribuia.tg_profiles_guard() from public, anon, authenticated;

-- ============================================================================
-- 15. RESUMENES Y PANEL DE PLATAFORMA (migracion 20261015000000_resumenes_y_plataforma)
-- ============================================================================
-- Totales de las tarjetas de multas, cuotas y gastos calculados en el servidor
-- con los mismos filtros de los listados, y platform_overview para SUPER_ADMIN.

-- ----------------------------------------------------------------------------
-- 1. Indices para los resumenes (filtro por condominio + rango de fechas)
-- ----------------------------------------------------------------------------
create index if not exists idx_fines_condominium_date on tribuia.fines (condominium_id, fine_date desc);
create index if not exists idx_admin_fees_condominium_due on tribuia.admin_fees (condominium_id, due_date desc);
-- expenses ya tiene idx_expenses_condominium (condominium_id, expense_date desc).
-- Ultimo pago aprobado por condominio (platform_overview).
create index if not exists idx_payments_condominium_paid on tribuia.payments (condominium_id, paid_at desc)
  where status = 'APPROVED';

-- ----------------------------------------------------------------------------
-- 2. Patron de busqueda equivalente al del frontend
-- ----------------------------------------------------------------------------
-- Devuelve null si no hay termino util (sin filtro de busqueda).
create or replace function tribuia.list_search_pattern(p_search text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select case when t = '' then null else '%' || replace(t, '*', '%') || '%' end
  from (
    select regexp_replace(regexp_replace(coalesce(p_search, ''), '[,()%]', ' ', 'g'), '^\s+|\s+$', '', 'g') as t
  ) s;
$$;

-- ----------------------------------------------------------------------------
-- 3. Resumen de multas
-- ----------------------------------------------------------------------------
-- Visibilidad igual a la politica fines_select: administracion y vocero ven el
-- conjunto completo; el resto solo las multas de sus apartamentos.
create or replace function tribuia.fines_summary(
  p_condominium uuid,
  p_status      text default null,
  p_apartment   uuid default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_all     boolean;
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  v_all := tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SPOKESPERSON'], v_uid);

  if not v_all and not (
    tribuia.user_can_access_condominium(p_condominium, v_uid)
    or exists (
      select 1 from tribuia.apartments a
       where a.condominium_id = p_condominium
         and a.id in (select tribuia.user_apartment_ids(v_uid))
    )
  ) then
    raise exception 'No tienes acceso a este condominio' using errcode = '42501';
  end if;

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'fines', v_uid) then
    raise exception 'El modulo de multas no esta habilitado para tu rol' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'pending_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING'), 0),
           'pending_count',  count(*) filter (where f.status = 'PENDING'),
           'paid_amount',    coalesce(sum(f.amount) filter (where f.status = 'PAID'), 0),
           'paid_count',     count(*) filter (where f.status = 'PAID'),
           'appealed_count', count(*) filter (where f.status = 'APPEALED'),
           'total_count',    count(*)
         )
    into v_result
    from tribuia.fines f
   where f.condominium_id = p_condominium
     and (v_all or f.apartment_id in (select tribuia.user_apartment_ids(v_uid)))
     and (p_status is null or f.status::text = p_status)
     and (p_apartment is null or f.apartment_id = p_apartment)
     and (p_from is null or f.fine_date >= p_from)
     and (p_to is null or f.fine_date <= p_to)
     and (v_pattern is null
          or f.reason ilike v_pattern
          or f.description ilike v_pattern
          or f.notes ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Resumen de cuotas de administracion (solo administracion)
-- ----------------------------------------------------------------------------
-- Vencida = PENDING con due_date anterior a hoy (hora de Colombia, igual que el
-- navegador del usuario). pending_* incluye las vencidas.
create or replace function tribuia.admin_fees_summary(
  p_condominium uuid,
  p_status      text default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_today   date := (now() at time zone 'America/Bogota')::date;
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  if not tribuia.is_condominium_admin(p_condominium, (select auth.uid())) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'admin_fees', (select auth.uid())) then
    raise exception 'El modulo de cuotas de administracion no esta habilitado para tu rol'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
           'paid_amount',    coalesce(sum(f.amount) filter (where f.status = 'PAID'), 0),
           'paid_count',     count(*) filter (where f.status = 'PAID'),
           'pending_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING'), 0),
           'pending_count',  count(*) filter (where f.status = 'PENDING'),
           'overdue_count',  count(*) filter (where f.status = 'PENDING' and f.due_date < v_today),
           'overdue_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING' and f.due_date < v_today), 0)
         )
    into v_result
    from tribuia.admin_fees f
   where f.condominium_id = p_condominium
     and (p_status is null or f.status::text = p_status)
     and (p_from is null or f.due_date >= p_from)
     and (p_to is null or f.due_date <= p_to)
     and (v_pattern is null or f.notes ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Resumen de gastos
-- ----------------------------------------------------------------------------
-- Acceso igual a la politica expenses_select (can_view_finance).
-- total_amount suma todas las filas filtradas (cualquier estado).
create or replace function tribuia.expenses_summary(
  p_condominium uuid,
  p_status      text default null,
  p_category    uuid default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  if not tribuia.can_view_finance(p_condominium, (select auth.uid())) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'expenses', (select auth.uid())) then
    raise exception 'El modulo de gastos no esta habilitado para tu rol' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'total_amount',   coalesce(sum(e.amount), 0),
           'pending_amount', coalesce(sum(e.amount) filter (where e.status = 'PENDING'), 0),
           'count',          count(*)
         )
    into v_result
    from tribuia.expenses e
   where e.condominium_id = p_condominium
     and (p_status is null or e.status::text = p_status)
     and (p_category is null or e.category_id = p_category)
     and (p_from is null or e.expense_date >= p_from)
     and (p_to is null or e.expense_date <= p_to)
     and (v_pattern is null
          or e.concept ilike v_pattern
          or e.provider ilike v_pattern
          or e.invoice_number ilike v_pattern
          or e.description ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Panel de plataforma (solo SUPER_ADMIN)
-- ----------------------------------------------------------------------------
-- plan: ultimo periodo pagado (mayor ends_at); activo si ends_at >= hoy, igual
-- que PlansPage. last_payment_at: ultimo pago APROBADO del conjunto (cuotas,
-- multas o plan). Agregados con GROUP BY (sin subconsultas por fila).
create or replace function tribuia.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_today  date := (now() at time zone 'America/Bogota')::date;
  v_result jsonb;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede ver el panel de plataforma'
      using errcode = '42501';
  end if;

  with
  apts as (
    select a.condominium_id, count(*) as n
      from tribuia.apartments a
     group by a.condominium_id
  ),
  mem as (
    select m.condominium_id, count(distinct m.user_id) as n
      from tribuia.condominium_members m
     where m.status = 'ACTIVE'
     group by m.condominium_id
  ),
  own as (
    select a.condominium_id, count(distinct o.profile_id) as n
      from tribuia.apartment_owners o
      join tribuia.apartments a on a.id = o.apartment_id
     where o.is_active
     group by a.condominium_id
  ),
  adm as (
    select x.condominium_id,
           jsonb_agg(jsonb_build_object('full_name', x.full_name, 'email', x.email)
                     order by x.full_name, x.email) as list
      from (
        select distinct m.condominium_id, p.full_name, p.email
          from tribuia.condominium_members m
          join tribuia.roles r on r.id = m.role_id
          join tribuia.profiles p on p.id = m.user_id
         where m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR'
      ) x
     group by x.condominium_id
  ),
  sub as (
    select distinct on (s.condominium_id)
           s.condominium_id, s.plan_period, s.ends_at
      from tribuia.subscriptions s
     order by s.condominium_id, s.ends_at desc, s.created_at desc
  ),
  pay as (
    select p.condominium_id, max(p.paid_at) as last_paid
      from tribuia.payments p
     where p.status = 'APPROVED'
     group by p.condominium_id
  ),
  cr as (
    select c.id, c.name, c.city, c.status, c.created_at,
           coalesce(apts.n, 0) as apartments,
           coalesce(mem.n, 0)  as members,
           coalesce(own.n, 0)  as owners,
           coalesce(adm.list, '[]'::jsonb) as admins,
           sub.plan_period, sub.ends_at,
           (sub.ends_at is not null and sub.ends_at >= v_today) as plan_active,
           pay.last_paid
      from tribuia.condominiums c
      left join apts on apts.condominium_id = c.id
      left join mem  on mem.condominium_id  = c.id
      left join own  on own.condominium_id  = c.id
      left join adm  on adm.condominium_id  = c.id
      left join sub  on sub.condominium_id  = c.id
      left join pay  on pay.condominium_id  = c.id
  )
  select jsonb_build_object(
           'totals', jsonb_build_object(
             'condominiums',         (select count(*) from cr),
             'active_condominiums',  (select count(*) from cr where status = 'ACTIVE'),
             'apartments',           (select count(*) from tribuia.apartments),
             'users',                (select count(*) from tribuia.profiles),
             'active_subscriptions', (select count(*) from cr where plan_active),
             'expired_or_none',      (select count(*) from cr where not plan_active)
           ),
           'condominiums', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id',         r.id,
                      'name',       r.name,
                      'city',       r.city,
                      'status',     r.status,
                      'created_at', r.created_at,
                      'apartments', r.apartments,
                      'members',    r.members,
                      'owners',     r.owners,
                      'admins',     r.admins,
                      'plan',       case when r.ends_at is null then null else jsonb_build_object(
                                      'period',  r.plan_period,
                                      'ends_at', r.ends_at,
                                      'active',  r.plan_active) end,
                      'last_payment_at', r.last_paid
                    ) order by r.name, r.id)
               from cr r
           ), '[]'::jsonb)
         )
    into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Permisos: solo usuarios autenticados (el esquema concede a anon por defecto)
-- ----------------------------------------------------------------------------
revoke execute on function tribuia.fines_summary(uuid, text, uuid, date, date, text) from public, anon;
revoke execute on function tribuia.admin_fees_summary(uuid, text, date, date, text) from public, anon;
revoke execute on function tribuia.expenses_summary(uuid, text, uuid, date, date, text) from public, anon;
revoke execute on function tribuia.platform_overview() from public, anon;
grant execute on function tribuia.fines_summary(uuid, text, uuid, date, date, text) to authenticated;
grant execute on function tribuia.admin_fees_summary(uuid, text, date, date, text) to authenticated;
grant execute on function tribuia.expenses_summary(uuid, text, uuid, date, date, text) to authenticated;
grant execute on function tribuia.platform_overview() to authenticated;

-- ----------------------------------------------------------------------------
-- Refresca el cache de esquema de PostgREST.
-- Sin esto, las funciones recien creadas pueden seguir respondiendo PGRST202
-- ("Falta una funcion en la base de datos") hasta que la API se reinicie sola.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
-- 16. ENDURECIMIENTO Y RENDIMIENTO
-- ----------------------------------------------------------------------------
-- Replica de `supabase/patches/11-endurecimiento-y-rendimiento.sql`.
--
-- ALCANCE: UNICAMENTE el esquema `tribuia`. Ninguna sentencia de este bloque
-- toca el esquema `public` ni el esquema `storage`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 16.1 Funciones auxiliares de conjunto
-- ----------------------------------------------------------------------------
-- Las funciones originales (has_role, user_can_access_condominium, ...) reciben
-- el id de la fila evaluada, asi que PostgreSQL las ejecutaba una vez POR FILA.
-- Estas devuelven el CONJUNTO de ids accesibles: la politica se resuelve con un
-- subplan evaluado una sola vez por consulta.
-- ----------------------------------------------------------------------------
create or replace function tribuia.condominium_ids_with_role(
  p_codes text[],
  p_user  uuid default auth.uid()
)
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select m.condominium_id
  from tribuia.condominium_members m
  join tribuia.roles r on r.id = m.role_id
  where m.user_id = p_user
    and m.status = 'ACTIVE'
    and r.code = any (p_codes);
$$;

create or replace function tribuia.shared_profile_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select distinct b.user_id
  from tribuia.condominium_members a
  join tribuia.condominium_members b on b.condominium_id = a.condominium_id
  where a.user_id = p_user
    and a.status = 'ACTIVE'
    and b.status = 'ACTIVE';
$$;

grant execute on function tribuia.condominium_ids_with_role(text[], uuid)
  to authenticated, service_role;
grant execute on function tribuia.shared_profile_ids(uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 16.2 Optimizacion de las politicas RLS (InitPlan por consulta)
-- ----------------------------------------------------------------------------
-- Transformacion de TEXTO equivalente (no cambia la logica):
--   auth.uid()                             -> (select auth.uid())
--   tribuia.is_super_admin()               -> (select tribuia.is_super_admin())
--   tribuia.has_role(X, ARRAY[...])        -> ((select ...) or X in (select ...condominium_ids_with_role(ARRAY[...])))
--   tribuia.is_condominium_admin(X)        -> ((select ...) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR'])))
--   tribuia.user_can_access_condominium(X) -> ((select ...) or X in (select ...user_condominium_ids()))
--   tribuia.can_view_finance(X)            -> ((select ...) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR','SPOKESPERSON','OWNER'])))
--   tribuia.can_manage_finance(X)          -> ((select ...) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR'])))
--   tribuia.shares_condominium(X)          -> ((select ...) or X in (select ...shared_profile_ids()))
--
-- Si el argumento es una llamada anidada
-- (is_condominium_admin(apartment_condominium(x))) la sustitucion NO se aplica:
-- sin poder comprobar el parentesis de cierre seria arriesgado.
-- ----------------------------------------------------------------------------
create or replace function tribuia._opt_policy_expr(p_expr text)
returns text
language plpgsql
immutable
as $$
declare
  v text := p_expr;
begin
  if v is null then
    return null;
  end if;

  if position('tribuia.is_super_admin()' in v) > 0
     and position('SELECT tribuia.is_super_admin() AS is_super_admin' in v) = 0 then
    v := replace(v, 'tribuia.is_super_admin()', '(select tribuia.is_super_admin())');
  end if;

  v := regexp_replace(
         v,
         'tribuia\.is_condominium_admin\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR''])))',
         'g');

  v := regexp_replace(
         v,
         'tribuia\.has_role\(([a-z_]+), (ARRAY\[[^]]*\])\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(\2)))',
         'g');

  v := regexp_replace(
         v,
         'tribuia\.user_can_access_condominium\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.user_condominium_ids()))',
         'g');

  v := regexp_replace(
         v,
         'tribuia\.can_view_finance\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR'', ''SPOKESPERSON'', ''OWNER''])))',
         'g');

  v := regexp_replace(
         v,
         'tribuia\.can_manage_finance\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR''])))',
         'g');

  v := regexp_replace(
         v,
         'tribuia\.shares_condominium\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.shared_profile_ids()))',
         'g');

  if position('auth.uid()' in v) > 0
     and position('SELECT auth.uid() AS uid' in v) = 0 then
    v := replace(v, 'auth.uid()', '(select auth.uid())');
  end if;

  return v;
end;
$$;

do $opt$
declare
  pol      record;
  v_claves text[];
  i        int;
  v_total  int := 0;
  v_cambio int := 0;
begin
  for pol in
    select c.relname as tabla, p.polname,
           pg_get_expr(p.polqual, p.polrelid) as q_using,
           pg_get_expr(p.polwithcheck, p.polrelid) as q_check
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'tribuia'
  loop
    v_total := v_total + 1;
    v_claves := array[pol.q_using, pol.q_check];

    for i in 1..2 loop
      if v_claves[i] is not null then
        v_claves[i] := tribuia._opt_policy_expr(v_claves[i]);
      end if;
    end loop;

    if v_claves[1] is distinct from pol.q_using
       or v_claves[2] is distinct from pol.q_check then
      execute format(
        'alter policy %I on tribuia.%I%s%s',
        pol.polname,
        pol.tabla,
        case when v_claves[1] is not null then ' using (' || v_claves[1] || ')' else '' end,
        case when v_claves[2] is not null then ' with check (' || v_claves[2] || ')' else '' end
      );
      v_cambio := v_cambio + 1;
    end if;
  end loop;

  raise notice 'politicas optimizadas: % de % (esquema tribuia)', v_cambio, v_total;
end
$opt$;

-- La funcion de apoyo ya cumplio: no se queda en el esquema.
drop function if exists tribuia._opt_policy_expr(text);

-- ----------------------------------------------------------------------------
-- 16.3 Cierre de la superficie RPC
-- ----------------------------------------------------------------------------
-- Antes, 24 de las 25 funciones RPC que usa el frontend eran invocables por el
-- rol `anon` (sin sesion). Ahora solo quedan abiertas a `anon` las 4 que el flujo
-- de registro necesita; el resto exige `authenticated`.
--
-- NOTA: en `revoke ... from public` el termino `public` es el ROL implicito de
-- PostgreSQL, no el esquema: ningun objeto del esquema `public` se modifica.
-- ----------------------------------------------------------------------------
do $rpc$
declare
  f record;
  v_anon_ok text[] := array[
    'registration_catalog',
    'registration_buildings',
    'registration_apartments',
    'complete_self_registration'
  ];
  v_cerradas int := 0;
begin
  for f in
    select p.proname,
           format('tribuia.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'tribuia'
      and p.prokind = 'f'
  loop
    if f.proname = any (v_anon_ok) then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.firma);
      continue;
    end if;

    execute format('revoke all on function %s from public, anon', f.firma);

    if f.proname = 'apply_payment_result' then
      execute format('revoke all on function %s from authenticated', f.firma);
      execute format('grant execute on function %s to service_role', f.firma);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.firma);
    end if;

    v_cerradas := v_cerradas + 1;
  end loop;

  raise notice 'funciones cerradas a anon: %', v_cerradas;
end
$rpc$;

-- ----------------------------------------------------------------------------
-- 16.4 Indices trigram para las busquedas de la UI
-- ----------------------------------------------------------------------------
-- `applyListParams` genera `columna.ilike.%termino%`. Un patron con `%` a la
-- izquierda no puede usar un indice B-tree, asi que PostgreSQL hacia un
-- sequential scan. pg_trgm resuelve eso con un indice GIN.
--
-- Un indice GIN multicolumna sirve para una condicion sobre CUALQUIER
-- subconjunto de sus columnas, por eso se agrupa una tabla por indice. Las
-- columnas son exactamente las que declara `searchColumns` en cada servicio.
-- ----------------------------------------------------------------------------
create extension if not exists "pg_trgm" with schema extensions;

create index if not exists idx_condominiums_search on tribuia.condominiums
  using gin (name gin_trgm_ops, nit gin_trgm_ops, city gin_trgm_ops,
             address gin_trgm_ops, email gin_trgm_ops);
create index if not exists idx_buildings_search on tribuia.buildings
  using gin (name gin_trgm_ops, number gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_apartments_search on tribuia.apartments
  using gin (number gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_residents_search on tribuia.residents
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops,
             email gin_trgm_ops, phone gin_trgm_ops);
create index if not exists idx_vehicles_search on tribuia.vehicles
  using gin (plate gin_trgm_ops, brand gin_trgm_ops, model gin_trgm_ops,
             color gin_trgm_ops, parking_spot gin_trgm_ops);
create index if not exists idx_pets_search on tribuia.pets
  using gin (name gin_trgm_ops, breed gin_trgm_ops, color gin_trgm_ops);
create index if not exists idx_visitors_search on tribuia.visitors
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops,
             phone gin_trgm_ops, plate gin_trgm_ops, company gin_trgm_ops);
create index if not exists idx_requests_search on tribuia.requests
  using gin (title gin_trgm_ops, description gin_trgm_ops, code gin_trgm_ops);
create index if not exists idx_incidents_search on tribuia.incidents
  using gin (title gin_trgm_ops, description gin_trgm_ops, location gin_trgm_ops,
             code gin_trgm_ops);
create index if not exists idx_announcements_search on tribuia.announcements
  using gin (title gin_trgm_ops, content gin_trgm_ops);
create index if not exists idx_alerts_search on tribuia.alerts
  using gin (title gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_expenses_search on tribuia.expenses
  using gin (concept gin_trgm_ops, provider gin_trgm_ops,
             invoice_number gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_purchases_search on tribuia.purchases
  using gin (provider gin_trgm_ops, code gin_trgm_ops,
             invoice_number gin_trgm_ops, notes gin_trgm_ops);
create index if not exists idx_fines_search on tribuia.fines
  using gin (reason gin_trgm_ops, description gin_trgm_ops, notes gin_trgm_ops);
create index if not exists idx_admin_fees_search on tribuia.admin_fees
  using gin (notes gin_trgm_ops);
create index if not exists idx_documents_search on tribuia.documents
  using gin (title gin_trgm_ops, description gin_trgm_ops, file_name gin_trgm_ops);
create index if not exists idx_audit_logs_search on tribuia.audit_logs
  using gin (entity gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 16.5 Indices de cobertura para las claves foraneas
-- ----------------------------------------------------------------------------
-- Sin indice, un UPDATE/DELETE sobre la tabla padre obliga a un sequential scan
-- de la hija para validar la clave foranea, y los join por esas columnas no se
-- pueden optimizar.
--
-- La lista se DERIVA del catalogo: cubre tambien las claves foraneas que se
-- anadan en el futuro. El nombre se toma del constraint para ser estable.
-- ----------------------------------------------------------------------------
do $fk$
declare
  fk record;
  v_creados int := 0;
begin
  for fk in
    select n.nspname as esquema,
           c.relname as tabla,
           'idx_' || c.relname || '_' || substr(con.conname, 1, length(con.conname) - 5) || '_fk'
             as idx_nombre,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
            from unnest(con.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columnas
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f'
      and n.nspname = 'tribuia'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and i.indisvalid
          and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
  loop
    if not exists (
      select 1 from pg_class ic
      join pg_namespace inn on inn.oid = ic.relnamespace
      where inn.nspname = fk.esquema and ic.relname = fk.idx_nombre
    ) then
      execute format('create index %I on %I.%I (%s)',
                     fk.idx_nombre, fk.esquema, fk.tabla, fk.columnas);
      v_creados := v_creados + 1;
    end if;
  end loop;

  raise notice 'indices de clave foranea creados: %', v_creados;
end
$fk$;

-- ----------------------------------------------------------------------------
-- 16.6 Indices redundantes y parciales
-- ----------------------------------------------------------------------------
-- Baja de indices NO unicos (y que no respaldan un constraint) cuyas columnas
-- lideres ya estan cubiertas por otro indice TOTAL y btree. Uno parcial (con
-- WHERE) NO cubre, y un GIN de busqueda trigram tampoco queda cubierto por un
-- btree aunque coincida la columna lider.
-- ----------------------------------------------------------------------------
do $redundantes$
declare
  r record;
  v_bajados int := 0;
begin
  for r in
    select n.nspname as esquema, ic.relname as idx
    from pg_index a
    join pg_class c on c.oid = a.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class ic on ic.oid = a.indexrelid
    where n.nspname = 'tribuia'
      and a.indisvalid
      and a.indisunique = false
      and a.indisprimary = false
      and a.indpred is null
      and not exists (select 1 from pg_constraint ce where ce.conindid = a.indexrelid)
      -- Solo se comparan indices btree. Un indice GIN (busqueda trigram por
      -- ILIKE '%...%') NO queda cubierto por un btree aunque coincida la
      -- columna lider: un btree no puede resolver ese patron.
      and (select am.amname
             from pg_am am
             join pg_class ia on ia.relam = am.oid
            where ia.oid = a.indexrelid) = 'btree'
      and exists (
        select 1 from pg_index b
        join pg_class ib on ib.oid = b.indexrelid
        join pg_am amb on amb.oid = ib.relam
        where b.indrelid = a.indrelid
          and b.indexrelid <> a.indexrelid
          and b.indisvalid
          and amb.amname = 'btree'
          and b.indpred is null
          and b.indnkeyatts >= a.indnkeyatts
          and (b.indkey::int2[])[0:array_length(a.indkey::int2[], 1) - 1]
              = (a.indkey::int2[])[0:array_length(a.indkey::int2[], 1) - 1]
      )
  loop
    execute format('drop index if exists %I.%I', r.esquema, r.idx);
    raise notice 'indice redundante eliminado: %.%', r.esquema, r.idx;
    v_bajados := v_bajados + 1;
  end loop;

  raise notice 'indices redundantes eliminados: %', v_bajados;
end
$redundantes$;

-- La UI filtra por registros activos; un indice parcial es mas pequeno y sirve
-- igual para esas consultas.
create index if not exists idx_residents_active
  on tribuia.residents (condominium_id, full_name) where is_active;
create index if not exists idx_owners_active
  on tribuia.apartment_owners (profile_id, apartment_id) where is_active;
create index if not exists idx_tenants_active
  on tribuia.apartment_tenants (profile_id, apartment_id) where is_active;

-- ----------------------------------------------------------------------------
-- 16.7 Vista con el conteo de apartamentos por bloque
-- ----------------------------------------------------------------------------
-- `buildingService.listWithCounts` descargaba TODOS los apartamentos para
-- contarlos en JavaScript; si el condominio superaba el `max_rows` de PostgREST
-- (1000 por defecto) el conteo salia mal sin error.
--
-- `security_invoker = true` hace que la vista respete las politicas RLS de quien
-- consulta (PostgreSQL 15+).
-- ----------------------------------------------------------------------------
create or replace view tribuia.buildings_with_counts
with (security_invoker = true)
as
select
  b.*,
  (select count(*) from tribuia.apartments a where a.building_id = b.id) as apartment_count
from tribuia.buildings b;

grant select on tribuia.buildings_with_counts to authenticated, service_role;

-- Refresca el cache de esquema de PostgREST.
notify pgrst, 'reload schema';

-- ============================================================================
-- 17. MODULOS POR ROL (migracion 20261018000000_modulos_por_rol)
-- ----------------------------------------------------------------------------
-- El SUPER_ADMIN decide, por conjunto, que modulos ve y puede usar cada rol.
--   * Tabla tribuia.role_modules (3.28) e indices (4). condominium_id null =
--     plantilla por defecto. enabled = coalesce(conjunto, plantilla, true):
--     sin filas todo queda habilitado.
--   * Todas las politicas de las tablas de cada modulo (seccion 7 y admin_fees
--     en el bloque de pagos) agregan con AND
--       <condominio> not in (select tribuia.module_blocked_condominiums('<modulo>'))
--     equivalente a tribuia.module_enabled (5.12) pero evaluado una vez por
--     consulta (subplan hasheado) en lugar de una vez por fila:
--       residents -> residents, vehicles, pets       visitors -> visitors
--       alerts -> alerts            announcements -> announcements
--       messages -> conversations, conversation_participants, messages
--       requests -> requests, request_comments       incidents -> incidents
--       fines -> fines              admin_fees -> admin_fees
--       expenses -> expenses, expense_categories
--       purchases -> purchases, purchase_items
--       documents -> documents, document_categories  reports -> solo interfaz
--   * fines_summary, admin_fees_summary, expenses_summary (15) y
--     generate_admin_fees responden 42501 si el modulo esta deshabilitado.
--   * Service role / auth.uid() null: module_enabled devuelve true;
--     apply_payment_result y los triggers son SECURITY DEFINER (sin RLS).
-- ============================================================================

drop trigger if exists trg_role_modules_updated_at on tribuia.role_modules;
create trigger trg_role_modules_updated_at before update on tribuia.role_modules
  for each row execute function tribuia.set_updated_at();

-- Modulos deshabilitados para el usuario actual en el conjunto (orden del
-- catalogo). SUPER_ADMIN o usuario sin membresia: arreglo vacio.
create or replace function tribuia.my_disabled_modules(p_condominium uuid)
returns text[]
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(
           array_agg(u.module order by u.ord)
             filter (where not tribuia.module_enabled(p_condominium, u.module, (select auth.uid()))),
           '{}'::text[])
    from unnest(tribuia.role_module_codes()) with ordinality as u(module, ord);
$$;

-- Matriz completa roles x modulos. p_condominium null = plantilla.
-- source: 'condominium' (fila del conjunto), 'default' (fila de la plantilla),
-- 'system' (sin fila: habilitado).
create or replace function tribuia.role_modules_matrix(p_condominium uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_condominium is not null
     and not exists (select 1 from tribuia.condominiums c where c.id = p_condominium) then
    raise exception 'El condominio % no existe', p_condominium using errcode = 'P0002';
  end if;

  select jsonb_build_object(
           'condominium_id', p_condominium,
           'cells', coalesce(jsonb_agg(
             jsonb_build_object(
               'role',    r.code,
               'module',  m.code,
               'enabled', coalesce(rc.enabled, rt.enabled, true),
               'source',  case
                            when rc.id is not null then 'condominium'
                            when rt.id is not null then 'default'
                            else 'system'
                          end
             ) order by r.ord, m.ord), '[]'::jsonb)
         )
    into v_result
    from unnest(tribuia.role_module_roles()) with ordinality as r(code, ord)
   cross join unnest(tribuia.role_module_codes()) with ordinality as m(code, ord)
    left join tribuia.role_modules rc
           on p_condominium is not null
          and rc.condominium_id = p_condominium
          and rc.role_code = r.code
          and rc.module = m.code
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = m.code;

  return v_result;
end;
$$;

-- Crea o actualiza una celda. p_condominium null = plantilla.
create or replace function tribuia.set_role_module(
  p_condominium uuid,
  p_role        text,
  p_module      text,
  p_enabled     boolean
)
returns void
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_role is null or not (p_role = any (tribuia.role_module_roles())) then
    raise exception 'Rol no configurable: %', coalesce(p_role, 'null') using errcode = '22023';
  end if;
  if p_module is null or not (p_module = any (tribuia.role_module_codes())) then
    raise exception 'Modulo desconocido: %', coalesce(p_module, 'null') using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'enabled no puede ser null' using errcode = '22023';
  end if;

  if p_condominium is not null
     and not exists (select 1 from tribuia.condominiums c where c.id = p_condominium) then
    raise exception 'El condominio % no existe', p_condominium using errcode = 'P0002';
  end if;

  insert into tribuia.role_modules (condominium_id, role_code, module, enabled, updated_by, updated_at)
  values (p_condominium, p_role, p_module, p_enabled, (select auth.uid()), now())
  on conflict on constraint role_modules_scope_key do update
     set enabled    = excluded.enabled,
         updated_by = excluded.updated_by,
         updated_at = now();
end;
$$;

-- Borra la configuracion propia del conjunto (vuelve a la plantilla).
-- p_condominium null borra la plantilla (vuelve a "todo habilitado").
create or replace function tribuia.reset_role_modules(p_condominium uuid)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_condominium is null then
    delete from tribuia.role_modules where condominium_id is null;
  else
    delete from tribuia.role_modules where condominium_id = p_condominium;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- RLS de role_modules: lectura para SUPER_ADMIN y para miembros (filas de su
-- conjunto y la plantilla). Sin politicas de escritura: solo via RPC.
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules enable row level security;

drop policy if exists role_modules_select on tribuia.role_modules;
create policy role_modules_select on tribuia.role_modules for select to authenticated
  using (
    (select tribuia.is_super_admin())
    or condominium_id in (select tribuia.user_condominium_ids())
    or (condominium_id is null and (select exists (select 1 from tribuia.user_condominium_ids())))
  );

revoke all on tribuia.role_modules from anon;
revoke insert, update, delete, truncate on tribuia.role_modules from authenticated;
grant select on tribuia.role_modules to authenticated;
grant all on tribuia.role_modules to service_role;

-- ----------------------------------------------------------------------------
-- Permisos: nada para anon (el esquema concede execute a anon por defecto).
-- ----------------------------------------------------------------------------
revoke all on function tribuia.role_module_roles() from public, anon;
revoke all on function tribuia.role_module_codes() from public, anon;
revoke all on function tribuia.module_enabled(uuid, text, uuid) from public, anon;
revoke all on function tribuia.module_blocked_condominiums(text, uuid) from public, anon;
revoke all on function tribuia.my_disabled_modules(uuid) from public, anon;
revoke all on function tribuia.role_modules_matrix(uuid) from public, anon;
revoke all on function tribuia.set_role_module(uuid, text, text, boolean) from public, anon;
revoke all on function tribuia.reset_role_modules(uuid) from public, anon;

grant execute on function tribuia.role_module_roles() to authenticated, service_role;
grant execute on function tribuia.role_module_codes() to authenticated, service_role;
-- authenticated: resumenes y frontend. service_role: la Edge Function de pagos
-- puede validarlo con p_user.
grant execute on function tribuia.module_enabled(uuid, text, uuid) to authenticated, service_role;
-- authenticated: lo evaluan las politicas RLS.
grant execute on function tribuia.module_blocked_condominiums(text, uuid) to authenticated, service_role;
grant execute on function tribuia.my_disabled_modules(uuid) to authenticated, service_role;
grant execute on function tribuia.role_modules_matrix(uuid) to authenticated, service_role;
grant execute on function tribuia.set_role_module(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function tribuia.reset_role_modules(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- 18. FEED, EMERGENCIAS Y MARKETPLACE (migracion 20261018100000_feed_emergencias_marketplace)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. FEED
-- ----------------------------------------------------------------------------
alter table tribuia.announcements
  add column if not exists pinned boolean not null default false;

-- Paginacion del feed: fijadas primero y luego las mas recientes.
create index if not exists idx_announcements_feed
  on tribuia.announcements (condominium_id, pinned desc, published_at desc)
  where status = 'PUBLISHED';


-- ----------------------------------------------------------------------------
-- B. TELEFONO Y SITIO WEB EN LOS LUGARES CERCANOS
-- ----------------------------------------------------------------------------
alter table tribuia.condominium_places add column if not exists phone text;
alter table tribuia.condominium_places add column if not exists website text;

create or replace function tribuia.replace_condominium_location(
  p_condominium uuid,
  p_location jsonb,
  p_places jsonb
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'Solo la administracion del conjunto puede actualizar su ubicacion'
      using errcode = '42501';
  end if;

  if p_location is not null then
    update tribuia.condominiums
       set latitude = (p_location ->> 'latitude')::numeric,
           longitude = (p_location ->> 'longitude')::numeric,
           location_label = p_location ->> 'label',
           location_approximate = coalesce((p_location ->> 'approximate')::boolean, false),
           location_source = p_location ->> 'source'
     where id = p_condominium;
  end if;

  delete from tribuia.condominium_places where condominium_id = p_condominium;

  insert into tribuia.condominium_places
    (condominium_id, osm_id, name, category, latitude, longitude, distance_m, address,
     phone, website)
  select p_condominium,
         p.osm_id, left(p.name, 200), p.category, p.latitude, p.longitude, p.distance_m,
         left(p.address, 300), left(p.phone, 60), left(p.website, 300)
    from jsonb_to_recordset(coalesce(p_places, '[]'::jsonb)) as p(
      osm_id text, name text, category text, latitude numeric, longitude numeric,
      distance_m integer, address text, phone text, website text
    )
   where p.osm_id is not null and p.name is not null
  on conflict (condominium_id, osm_id) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums set places_updated_at = now() where id = p_condominium;

  return v_count;
end;
$$;

revoke all on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) from public, anon;
grant execute on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) to authenticated;


-- ----------------------------------------------------------------------------
-- C. DIRECTORIO DEL CONJUNTO
-- ----------------------------------------------------------------------------
create table if not exists tribuia.community_contacts (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  kind           text not null,
  category       text not null,
  name           text not null,
  phone          text,
  whatsapp       text,
  description    text,
  address        text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint community_contacts_kind_check check (kind in ('EMERGENCY', 'SERVICE')),
  constraint community_contacts_name_check check (length(btrim(name)) between 2 and 120),
  constraint community_contacts_category_check check (length(category) between 2 and 40),
  constraint community_contacts_reachable_check check (
    nullif(btrim(coalesce(phone, '')), '') is not null
    or nullif(btrim(coalesce(whatsapp, '')), '') is not null
  ),
  constraint community_contacts_lengths_check check (
    coalesce(length(phone), 0) <= 30
    and coalesce(length(whatsapp), 0) <= 30
    and coalesce(length(description), 0) <= 500
    and coalesce(length(address), 0) <= 200
  )
);

comment on table tribuia.community_contacts is
  'Directorio del conjunto: numeros de emergencia propios (cuadrante, porteria) y servicios recomendados (marketplace). Lo administra el ADMINISTRATOR.';

create index if not exists idx_community_contacts_condominium
  on tribuia.community_contacts (condominium_id, kind, sort_order);
create index if not exists idx_community_contacts_created_by
  on tribuia.community_contacts (created_by);

drop trigger if exists trg_community_contacts_updated_at on tribuia.community_contacts;
create trigger trg_community_contacts_updated_at before update on tribuia.community_contacts
  for each row execute function tribuia.set_updated_at();

-- El conjunto de un contacto no se puede cambiar despues de creado.
drop trigger if exists trg_community_contacts_lock_tenant on tribuia.community_contacts;
create trigger trg_community_contacts_lock_tenant before update on tribuia.community_contacts
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');

drop trigger if exists trg_audit_community_contacts on tribuia.community_contacts;
create trigger trg_audit_community_contacts
  after insert or update or delete on tribuia.community_contacts
  for each row execute function tribuia.fn_audit('CREATE');

alter table tribuia.community_contacts enable row level security;

-- Lectura: cualquier miembro del conjunto. Los SERVICE dependen del modulo
-- 'marketplace'; los numeros de emergencia se ven siempre.
drop policy if exists community_contacts_select on tribuia.community_contacts;
create policy community_contacts_select on tribuia.community_contacts for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (is_active or tribuia.is_condominium_admin(condominium_id))
    and (
      kind = 'EMERGENCY'
      or condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
    )
  );

drop policy if exists community_contacts_insert on tribuia.community_contacts;
create policy community_contacts_insert on tribuia.community_contacts for insert to authenticated
  with check (tribuia.is_condominium_admin(condominium_id));

drop policy if exists community_contacts_update on tribuia.community_contacts;
create policy community_contacts_update on tribuia.community_contacts for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

drop policy if exists community_contacts_delete on tribuia.community_contacts;
create policy community_contacts_delete on tribuia.community_contacts for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

revoke all on tribuia.community_contacts from anon;
grant select, insert, update, delete on tribuia.community_contacts to authenticated;
grant all on tribuia.community_contacts to service_role;


-- ----------------------------------------------------------------------------
-- D. MODULO 'marketplace'
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules drop constraint if exists role_modules_module_check;
alter table tribuia.role_modules add constraint role_modules_module_check check (module in (
  'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
  'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
  'marketplace', 'reservations'
));

create or replace function tribuia.role_module_codes()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array[
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
    'marketplace', 'reservations'
  ]::text[];
$$;

-- ============================================================================
-- 19. ALTA DE CONJUNTOS DESDE EL RUT (migracion 20261018110000_alta_conjunto_por_rut)
-- ============================================================================

create or replace function tribuia.provision_condominium(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_kind      text    := upper(coalesce(p_payload ->> 'kind', ''));
  v_name      text    := btrim(coalesce(p_payload ->> 'name', ''));
  v_nit       text    := nullif(btrim(coalesce(p_payload ->> 'nit', '')), '');
  v_houses    integer := coalesce((p_payload ->> 'houses')::integer, 0);
  v_towers    integer := coalesce((p_payload ->> 'towers')::integer, 0);
  v_floors    integer := coalesce((p_payload ->> 'floors')::integer, 0);
  v_per_floor integer := coalesce((p_payload ->> 'units_per_floor')::integer, 0);
  v_total     integer;
  v_width     integer;
  v_condo     uuid;
  v_building  uuid;
  v_units     jsonb := '[]'::jsonb;
  v_apartment uuid;
  v_number    text;
  t integer; f integer; n integer;
begin
  if not tribuia.is_super_admin() then
    raise exception 'Solo el super administrador puede dar de alta conjuntos' using errcode = '42501';
  end if;

  if length(v_name) < 3 then
    raise exception 'El nombre del conjunto es obligatorio' using errcode = '22023';
  end if;

  if v_kind = 'HOUSES' then
    if v_houses not between 1 and 2000 then
      raise exception 'El numero de casas debe estar entre 1 y 2000' using errcode = '22023';
    end if;
    v_total := v_houses;
  elsif v_kind = 'TOWERS' then
    if v_towers not between 1 and 60 or v_floors not between 1 and 60 or v_per_floor not between 1 and 30 then
      raise exception 'Revisa torres (1-60), pisos (1-60) y apartamentos por piso (1-30)' using errcode = '22023';
    end if;
    v_total := v_towers * v_floors * v_per_floor;
  else
    raise exception 'Tipo de conjunto invalido: usa TOWERS o HOUSES' using errcode = '22023';
  end if;

  if v_total > 3000 then
    raise exception 'Maximo 3000 unidades por alta (se pidieron %)', v_total using errcode = '22023';
  end if;

  if v_nit is not null and exists (
    select 1 from tribuia.condominiums
     where regexp_replace(coalesce(nit, ''), '\D', '', 'g') = regexp_replace(v_nit, '\D', '', 'g')
  ) then
    raise exception 'Ya existe un conjunto con el NIT %', v_nit using errcode = '23505';
  end if;

  insert into tribuia.condominiums
    (name, nit, address, city, country, phone, email, description, status, settings, created_by)
  values (
    left(v_name, 150),
    v_nit,
    nullif(btrim(coalesce(p_payload ->> 'address', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'city', '')), ''),
    'Colombia',
    nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''),
    nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), ''),
    nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
    'ACTIVE',
    jsonb_strip_nulls(jsonb_build_object(
      'department', nullif(btrim(coalesce(p_payload ->> 'department', '')), ''),
      'createdFromRut', true
    )),
    auth.uid()
  )
  returning id into v_condo;

  if v_kind = 'HOUSES' then
    v_width := greatest(2, length(v_houses::text));

    insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
    values (v_condo, 'Casas', 'C', v_houses || ' casas', 1, 'ACTIVE')
    returning id into v_building;

    for n in 1..v_houses loop
      v_number := lpad(n::text, v_width, '0');
      insert into tribuia.apartments
        (condominium_id, building_id, number, floor, coefficient, status, description)
      values (v_condo, v_building, v_number, 1, round(100.0 / v_total, 5), 'OCCUPIED', 'Casa ' || v_number)
      returning id into v_apartment;

      v_units := v_units || jsonb_build_object(
        'apartment_id', v_apartment, 'tower', null, 'number', v_number, 'label', 'Casa ' || v_number);
    end loop;
  else
    for t in 1..v_towers loop
      insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
      values (v_condo, 'Torre ' || t, t::text, v_floors || ' pisos, ' || v_per_floor || ' apartamentos por piso',
              v_floors, 'ACTIVE')
      returning id into v_building;

      for f in 1..v_floors loop
        for n in 1..v_per_floor loop
          v_number := f::text || lpad(n::text, 2, '0');
          insert into tribuia.apartments
            (condominium_id, building_id, number, floor, coefficient, status, description)
          values (v_condo, v_building, v_number, f, round(100.0 / v_total, 5), 'OCCUPIED',
                  'Torre ' || t || ' · Apto ' || v_number)
          returning id into v_apartment;

          v_units := v_units || jsonb_build_object(
            'apartment_id', v_apartment, 'tower', t, 'number', v_number,
            'label', 'Torre ' || t || ' · Apto ' || v_number);
        end loop;
      end loop;
    end loop;
  end if;

  return jsonb_build_object('condominium_id', v_condo, 'units', v_units);
end;
$$;


-- p_owners: [{ "apartment_id": uuid, "profile_id": uuid }]
create or replace function tribuia.attach_provisioned_accounts(
  p_condominium uuid,
  p_admin       uuid,
  p_owners      jsonb
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_role_admin uuid;
  v_role_owner uuid;
  v_count      integer := 0;
  v_row        record;
begin
  if not tribuia.is_super_admin() then
    raise exception 'Solo el super administrador puede vincular cuentas' using errcode = '42501';
  end if;

  if not exists (select 1 from tribuia.condominiums where id = p_condominium) then
    raise exception 'El conjunto no existe' using errcode = 'P0002';
  end if;

  select id into v_role_admin from tribuia.roles where code = 'ADMINISTRATOR';
  select id into v_role_owner from tribuia.roles where code = 'OWNER';

  if p_admin is not null then
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position)
    values (p_condominium, p_admin, v_role_admin, 'ACTIVE', 'Representante legal')
    on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';
  end if;

  for v_row in
    select o.apartment_id, o.profile_id, p.full_name, p.email
      from jsonb_to_recordset(coalesce(p_owners, '[]'::jsonb)) as o(apartment_id uuid, profile_id uuid)
      join tribuia.apartments a on a.id = o.apartment_id and a.condominium_id = p_condominium
      join tribuia.profiles p on p.id = o.profile_id
  loop
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
    values (p_condominium, v_row.profile_id, v_role_owner, 'ACTIVE')
    on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';

    insert into tribuia.apartment_owners
      (apartment_id, profile_id, ownership_percentage, is_primary, is_active)
    values (v_row.apartment_id, v_row.profile_id, 100, true, true)
    on conflict (apartment_id, profile_id) do update set is_active = true;

    insert into tribuia.residents
      (condominium_id, apartment_id, profile_id, full_name, relationship, email, is_active)
    values (p_condominium, v_row.apartment_id, v_row.profile_id, v_row.full_name, 'OWNER',
            v_row.email, true)
    on conflict (apartment_id, profile_id) do update set is_active = true;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function tribuia.provision_condominium(jsonb) from public, anon;
revoke all on function tribuia.attach_provisioned_accounts(uuid, uuid, jsonb) from public, anon;
grant execute on function tribuia.provision_condominium(jsonb) to authenticated, service_role;
grant execute on function tribuia.attach_provisioned_accounts(uuid, uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- 20. RESERVAS DE ZONAS COMUNES (migracion 20261019000000_reservas_zonas_comunes)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ZONAS COMUNES
-- ----------------------------------------------------------------------------
create table if not exists tribuia.common_areas (
  id                uuid primary key default gen_random_uuid(),
  condominium_id    uuid not null references tribuia.condominiums (id) on delete cascade,
  name              text not null,
  description       text,
  rules             text,
  price             numeric(14, 2) not null default 0,
  capacity          integer,
  open_time         time not null default '08:00',
  close_time        time not null default '22:00',
  max_hours         integer not null default 4,
  requires_approval boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint common_areas_name_key unique (condominium_id, name),
  constraint common_areas_name_check check (length(btrim(name)) between 2 and 80),
  constraint common_areas_price_check check (price >= 0 and price <= 50000000),
  constraint common_areas_capacity_check check (capacity is null or capacity between 1 and 5000),
  constraint common_areas_hours_check check (close_time > open_time),
  constraint common_areas_max_hours_check check (max_hours between 1 and 24),
  constraint common_areas_lengths_check check (
    coalesce(length(description), 0) <= 500 and coalesce(length(rules), 0) <= 2000
  )
);

comment on table tribuia.common_areas is
  'Zonas comunes reservables. Horarios en hora de Colombia (America/Bogota).';

drop trigger if exists trg_common_areas_updated_at on tribuia.common_areas;
create trigger trg_common_areas_updated_at before update on tribuia.common_areas
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_common_areas_lock_tenant on tribuia.common_areas;
create trigger trg_common_areas_lock_tenant before update on tribuia.common_areas
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');
drop trigger if exists trg_audit_common_areas on tribuia.common_areas;
create trigger trg_audit_common_areas after insert or update or delete on tribuia.common_areas
  for each row execute function tribuia.fn_audit('CREATE');


-- ----------------------------------------------------------------------------
-- B. RESERVAS
-- ----------------------------------------------------------------------------
create table if not exists tribuia.reservations (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  -- Sin cascada: una zona con reservas no se borra (se desactiva).
  common_area_id  uuid not null references tribuia.common_areas (id),
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  guests          integer,
  notes           text,
  status          text not null default 'PENDING_APPROVAL',
  amount          numeric(14, 2) not null default 0,
  payment_method  text,
  paid_at         timestamptz,
  payment_id      uuid references tribuia.payments (id) on delete set null,
  admin_notes     text,
  reviewed_by     uuid references tribuia.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_by      uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reservations_range_check check (ends_at > starts_at),
  constraint reservations_status_check check (status in (
    'PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'REJECTED', 'CANCELLED'
  )),
  constraint reservations_payment_method_check check (
    payment_method is null or payment_method in ('ONLINE', 'ON_SITE')
  ),
  constraint reservations_guests_check check (guests is null or guests between 0 and 5000),
  constraint reservations_lengths_check check (
    coalesce(length(notes), 0) <= 500 and coalesce(length(admin_notes), 0) <= 500
  )
);

create index if not exists idx_reservations_area_time
  on tribuia.reservations (common_area_id, starts_at);
create index if not exists idx_reservations_condominium
  on tribuia.reservations (condominium_id, starts_at desc);
create index if not exists idx_reservations_apartment on tribuia.reservations (apartment_id);
create index if not exists idx_reservations_created_by on tribuia.reservations (created_by);
create index if not exists idx_reservations_reviewed_by on tribuia.reservations (reviewed_by);
create index if not exists idx_reservations_payment on tribuia.reservations (payment_id);

drop trigger if exists trg_reservations_updated_at on tribuia.reservations;
create trigger trg_reservations_updated_at before update on tribuia.reservations
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_reservations_lock_tenant on tribuia.reservations;
create trigger trg_reservations_lock_tenant before update on tribuia.reservations
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id', 'apartment_id', 'common_area_id');
drop trigger if exists trg_reservations_tenant_ref on tribuia.reservations;
create trigger trg_reservations_tenant_ref before insert or update on tribuia.reservations
  for each row execute function tribuia.tg_assert_tenant_reference();
drop trigger if exists trg_audit_reservations on tribuia.reservations;
create trigger trg_audit_reservations after insert or update or delete on tribuia.reservations
  for each row execute function tribuia.fn_audit('CREATE');

-- Estados que ocupan el horario.
create or replace function tribuia.reservation_blocks_slot(p_status text)
returns boolean
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select p_status in ('PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED');
$$;

-- Valida y completa la reserva al crearla.
create or replace function tribuia.tg_reservation_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_area        tribuia.common_areas%rowtype;
  v_local_start timestamp;
  v_local_end   timestamp;
begin
  -- Serializa las reservas de la misma zona para que dos personas no tomen el
  -- mismo horario al mismo tiempo.
  perform pg_advisory_xact_lock(hashtextextended('reservation:' || new.common_area_id::text, 0));

  select * into v_area from tribuia.common_areas where id = new.common_area_id;
  if v_area.id is null or v_area.condominium_id <> new.condominium_id then
    raise exception 'La zona comun no pertenece a este conjunto' using errcode = '23503';
  end if;
  if not v_area.is_active then
    raise exception 'La zona "%" no esta disponible para reservas', v_area.name using errcode = 'P0001';
  end if;

  if new.starts_at <= now() then
    raise exception 'La reserva debe ser para una fecha futura' using errcode = '22023';
  end if;
  if new.starts_at > now() + interval '180 days' then
    raise exception 'Solo se puede reservar con hasta 6 meses de anticipacion' using errcode = '22023';
  end if;
  if new.ends_at - new.starts_at > make_interval(hours => v_area.max_hours) then
    raise exception 'La zona "%" se reserva maximo % hora(s)', v_area.name, v_area.max_hours
      using errcode = '22023';
  end if;

  v_local_start := new.starts_at at time zone 'America/Bogota';
  v_local_end := new.ends_at at time zone 'America/Bogota';
  if v_local_start::date <> v_local_end::date
     or v_local_start::time < v_area.open_time
     or v_local_end::time > v_area.close_time then
    raise exception 'El horario de "%" es de % a %', v_area.name,
      to_char(v_area.open_time, 'HH24:MI'), to_char(v_area.close_time, 'HH24:MI')
      using errcode = '22023';
  end if;

  if v_area.capacity is not null and coalesce(new.guests, 0) > v_area.capacity then
    raise exception 'La zona "%" tiene un aforo de % personas', v_area.name, v_area.capacity
      using errcode = '22023';
  end if;

  if exists (
    select 1 from tribuia.reservations r
     where r.common_area_id = new.common_area_id
       and tribuia.reservation_blocks_slot(r.status)
       and r.starts_at < new.ends_at
       and r.ends_at > new.starts_at
  ) then
    raise exception 'Ese horario ya esta reservado. Elige otro.' using errcode = '23P01';
  end if;

  -- Valor y estado los fija la base, no el navegador.
  new.amount := v_area.price;
  new.status := case
    when v_area.requires_approval then 'PENDING_APPROVAL'
    when v_area.price > 0 then 'PENDING_PAYMENT'
    else 'CONFIRMED'
  end;
  new.payment_method := null;
  new.paid_at := null;
  new.payment_id := null;
  new.admin_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_reservations_before_insert on tribuia.reservations;
create trigger trg_reservations_before_insert before insert on tribuia.reservations
  for each row execute function tribuia.tg_reservation_before_insert();

revoke execute on function tribuia.tg_reservation_before_insert() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- C. RLS Y RPC
-- ----------------------------------------------------------------------------
alter table tribuia.common_areas enable row level security;
alter table tribuia.reservations enable row level security;

drop policy if exists common_areas_select on tribuia.common_areas;
create policy common_areas_select on tribuia.common_areas for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (is_active or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );
drop policy if exists common_areas_insert on tribuia.common_areas;
create policy common_areas_insert on tribuia.common_areas for insert to authenticated
  with check (tribuia.is_condominium_admin(condominium_id));
drop policy if exists common_areas_update on tribuia.common_areas;
create policy common_areas_update on tribuia.common_areas for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));
drop policy if exists common_areas_delete on tribuia.common_areas;
create policy common_areas_delete on tribuia.common_areas for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- Ven la reserva: la administracion, voceros y seguridad (control de acceso),
-- y quienes viven en el apartamento.
drop policy if exists reservations_select on tribuia.reservations;
create policy reservations_select on tribuia.reservations for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );

-- Reservan quienes viven en el apartamento, o la administracion a nombre de uno.
drop policy if exists reservations_insert on tribuia.reservations;
create policy reservations_insert on tribuia.reservations for insert to authenticated
  with check (
    (
      apartment_id in (select tribuia.user_apartment_ids())
      or tribuia.is_condominium_admin(condominium_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );
-- Sin politicas de update/delete: los cambios de estado van por las RPC.

revoke all on tribuia.common_areas, tribuia.reservations from anon;
grant select, insert, update, delete on tribuia.common_areas to authenticated;
grant select, insert on tribuia.reservations to authenticated;
grant all on tribuia.common_areas, tribuia.reservations to service_role;


-- Horarios ocupados de una zona (sin datos de quien reservo).
create or replace function tribuia.common_area_busy_slots(
  p_area uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_condo uuid;
begin
  select condominium_id into v_condo from tribuia.common_areas where id = p_area;
  if v_condo is null
     or not tribuia.user_can_access_condominium(v_condo)
     or not tribuia.module_enabled(v_condo, 'reservations') then
    raise exception 'No tienes acceso a esta zona comun' using errcode = '42501';
  end if;
  if p_to - p_from > interval '62 days' then
    raise exception 'Consulta maximo 62 dias' using errcode = '22023';
  end if;

  return query
    select r.starts_at, r.ends_at, r.status
      from tribuia.reservations r
     where r.common_area_id = p_area
       and tribuia.reservation_blocks_slot(r.status)
       and r.starts_at < p_to
       and r.ends_at > p_from
     order by r.starts_at;
end;
$$;


-- Aprobar o rechazar (administracion).
create or replace function tribuia.review_reservation(
  p_reservation uuid,
  p_approve     boolean,
  p_notes       text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res tribuia.reservations%rowtype;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_res.condominium_id) then
    raise exception 'Solo la administracion puede revisar reservas' using errcode = '42501';
  end if;
  if v_res.status <> 'PENDING_APPROVAL' then
    raise exception 'Esta reserva ya fue revisada' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = case
           when not p_approve then 'REJECTED'
           when amount > 0 then 'PENDING_PAYMENT'
           else 'CONFIRMED'
         end,
         admin_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_reservation
  returning status into v_res.status;

  return v_res.status;
end;
$$;


-- Pago recibido en la administracion (efectivo o transferencia).
create or replace function tribuia.register_reservation_payment(p_reservation uuid)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res tribuia.reservations%rowtype;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_res.condominium_id) then
    raise exception 'Solo la administracion registra pagos' using errcode = '42501';
  end if;
  if v_res.status <> 'PENDING_PAYMENT' then
    raise exception 'Esta reserva no tiene un pago pendiente' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = 'CONFIRMED', payment_method = 'ON_SITE', paid_at = now()
   where id = p_reservation;
  return 'CONFIRMED';
end;
$$;


-- Cancelar: residentes antes de pagar; la administracion en cualquier estado activo.
create or replace function tribuia.cancel_reservation(
  p_reservation uuid,
  p_reason      text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res   tribuia.reservations%rowtype;
  v_admin boolean;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;

  v_admin := tribuia.is_condominium_admin(v_res.condominium_id);
  if not v_admin and not (v_res.apartment_id in (select tribuia.user_apartment_ids())) then
    raise exception 'No puedes cancelar esta reserva' using errcode = '42501';
  end if;
  if not tribuia.reservation_blocks_slot(v_res.status) then
    raise exception 'Esta reserva ya no esta activa' using errcode = 'P0001';
  end if;
  if not v_admin and v_res.paid_at is not null then
    raise exception 'La reserva ya esta pagada: pide la cancelacion a la administracion'
      using errcode = 'P0001';
  end if;
  if not v_admin and v_res.starts_at <= now() then
    raise exception 'La reserva ya empezo' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = 'CANCELLED',
         admin_notes = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), admin_notes)
   where id = p_reservation;
  return 'CANCELLED';
end;
$$;

revoke all on function tribuia.common_area_busy_slots(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function tribuia.review_reservation(uuid, boolean, text) from public, anon;
revoke all on function tribuia.register_reservation_payment(uuid) from public, anon;
revoke all on function tribuia.cancel_reservation(uuid, text) from public, anon;
grant execute on function tribuia.reservation_blocks_slot(text) to authenticated, service_role;
grant execute on function tribuia.common_area_busy_slots(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function tribuia.review_reservation(uuid, boolean, text) to authenticated, service_role;
grant execute on function tribuia.register_reservation_payment(uuid) to authenticated, service_role;
grant execute on function tribuia.cancel_reservation(uuid, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- D. PAGO EN LINEA
-- ----------------------------------------------------------------------------
alter type tribuia.payment_kind add value if not exists 'RESERVATION';

alter table tribuia.payments
  add column if not exists reservation_id uuid references tribuia.reservations (id) on delete set null;
create index if not exists idx_payments_reservation on tribuia.payments (reservation_id);

-- 'RESERVATION' se compara como texto: se agrega al enum en esta misma transaccion.
alter table tribuia.payments drop constraint if exists payments_target_check;
alter table tribuia.payments add constraint payments_target_check check (
  (kind::text = 'ADMIN_FEE' and admin_fee_id is not null)
  or (kind::text = 'SUBSCRIPTION' and plan_period is not null)
  or (kind::text = 'FINE' and fine_id is not null)
  or (kind::text = 'RESERVATION' and reservation_id is not null)
);

create or replace function tribuia.apply_payment_result(
  p_reference       text,
  p_transaction_id  text,
  p_status          text,
  p_amount_in_cents bigint,
  p_currency        text,
  p_method          text,
  p_message         text,
  p_payload         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_payment tribuia.payments%rowtype;
  v_status  tribuia.payment_status;
  v_start   date;
  v_months  integer;
begin
  select * into v_payment from tribuia.payments where reference = p_reference for update;
  if not found then
    raise exception 'Pago no encontrado: %', p_reference;
  end if;

  if v_payment.status = 'APPROVED' then
    return jsonb_build_object('id', v_payment.id, 'status', v_payment.status, 'kind', v_payment.kind);
  end if;

  v_status := case p_status
    when 'APPROVED' then 'APPROVED'
    when 'DECLINED' then 'DECLINED'
    when 'VOIDED'   then 'VOIDED'
    when 'ERROR'    then 'ERROR'
    else 'PENDING'
  end::tribuia.payment_status;

  -- Proteccion contra montos manipulados: lo cobrado debe ser lo registrado.
  if v_status = 'APPROVED'
     and (p_amount_in_cents <> round(v_payment.amount * 100) or coalesce(p_currency, 'COP') <> v_payment.currency) then
    v_status := 'ERROR';
    p_message := 'El monto cobrado no coincide con el valor del pago';
  end if;

  update tribuia.payments
     set status = v_status,
         wompi_transaction_id = coalesce(p_transaction_id, wompi_transaction_id),
         payment_method = coalesce(p_method, payment_method),
         status_message = p_message,
         paid_at = case when v_status = 'APPROVED' then now() else paid_at end,
         raw = coalesce(p_payload, '{}'::jsonb)
   where id = v_payment.id;

  if v_status = 'APPROVED' then
    if v_payment.kind::text = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    elsif v_payment.kind::text = 'FINE' then
      update tribuia.fines
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.fine_id;
    elsif v_payment.kind::text = 'RESERVATION' then
      -- Si la reserva se cancelo mientras se pagaba, queda el pago aprobado para
      -- que la administracion lo devuelva; la reserva no se reactiva.
      update tribuia.reservations
         set status = case when status = 'PENDING_PAYMENT' then 'CONFIRMED' else status end,
             paid_at = now(), payment_method = 'ONLINE', payment_id = v_payment.id
       where id = v_payment.reservation_id;
    else
      -- El nuevo periodo empieza hoy o cuando termine el plan vigente.
      select greatest(current_date, coalesce(max(ends_at), current_date)) into v_start
        from tribuia.subscriptions where condominium_id = v_payment.condominium_id;

      v_months := case v_payment.plan_period
        when 'MONTHLY' then 1 when 'SEMIANNUAL' then 6 else 12 end;

      insert into tribuia.subscriptions
        (condominium_id, plan_period, apartments_count, unit_price, amount, starts_at, ends_at, payment_id)
      values
        (v_payment.condominium_id, v_payment.plan_period, v_payment.apartments_count,
         v_payment.unit_price, v_payment.amount, v_start,
         (v_start + make_interval(months => v_months))::date, v_payment.id);
    end if;
  end if;

  return jsonb_build_object('id', v_payment.id, 'status', v_status, 'kind', v_payment.kind);
end;
$$;

revoke all on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) to service_role;


-- ----------------------------------------------------------------------------
-- E. MODULO 'reservations'
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules drop constraint if exists role_modules_module_check;
alter table tribuia.role_modules add constraint role_modules_module_check check (module in (
  'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
  'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
  'marketplace', 'reservations'
));

create or replace function tribuia.role_module_codes()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array[
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
    'marketplace', 'reservations'
  ]::text[];
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- 21. CLASIFICADOS DEL MARKETPLACE (migracion 20261019100000_clasificados_marketplace)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. TABLA
-- ----------------------------------------------------------------------------
create table if not exists tribuia.marketplace_listings (
  id               uuid primary key default gen_random_uuid(),
  condominium_id   uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id     uuid references tribuia.apartments (id) on delete set null,
  category         text not null,
  title            text not null,
  description      text not null,
  price            numeric(14, 2),
  price_type       text not null default 'FIXED',
  item_condition   text,
  details          jsonb not null default '{}'::jsonb,
  images           jsonb not null default '[]'::jsonb,
  contact_phone    text,
  contact_whatsapp text,
  status           text not null default 'PENDING',
  review_notes     text,
  reviewed_by      uuid references tribuia.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  published_at     timestamptz,
  expires_at       timestamptz,
  created_by       uuid not null default auth.uid() references tribuia.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint marketplace_listings_category_check check (category in (
    'PRODUCTS', 'PROPERTY_RENT', 'PROPERTY_SALE', 'FOOD', 'ACCESSORIES', 'CLASSES', 'SERVICES', 'OTHER'
  )),
  constraint marketplace_listings_price_type_check check (price_type in (
    'FIXED', 'NEGOTIABLE', 'FREE', 'PER_HOUR', 'PER_MONTH', 'PER_UNIT'
  )),
  constraint marketplace_listings_condition_check check (
    item_condition is null or item_condition in ('NEW', 'USED')
  ),
  constraint marketplace_listings_status_check check (status in (
    'PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'ARCHIVED'
  )),
  constraint marketplace_listings_title_check check (length(btrim(title)) between 3 and 120),
  constraint marketplace_listings_description_check check (length(btrim(description)) between 10 and 3000),
  constraint marketplace_listings_price_check check (price is null or price between 0 and 99999999999),
  constraint marketplace_listings_details_check check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4000
  ),
  constraint marketplace_listings_images_check check (
    jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 6
  ),
  constraint marketplace_listings_lengths_check check (
    coalesce(length(contact_phone), 0) <= 30
    and coalesce(length(contact_whatsapp), 0) <= 30
    and coalesce(length(review_notes), 0) <= 500
  )
);

comment on table tribuia.marketplace_listings is
  'Clasificados de los miembros del conjunto. Solo se ven aprobados y vigentes (o los propios). Moderados por la administracion.';

create index if not exists idx_marketplace_listings_feed
  on tribuia.marketplace_listings (condominium_id, status, published_at desc);
create index if not exists idx_marketplace_listings_created_by
  on tribuia.marketplace_listings (created_by);
create index if not exists idx_marketplace_listings_apartment
  on tribuia.marketplace_listings (apartment_id);
create index if not exists idx_marketplace_listings_reviewed_by
  on tribuia.marketplace_listings (reviewed_by);

drop trigger if exists trg_marketplace_listings_updated_at on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_updated_at before update on tribuia.marketplace_listings
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_marketplace_listings_lock_tenant on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_lock_tenant before update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id', 'created_by');
drop trigger if exists trg_marketplace_listings_tenant_ref on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_tenant_ref before insert or update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_assert_tenant_reference();
drop trigger if exists trg_audit_marketplace_listings on tribuia.marketplace_listings;
create trigger trg_audit_marketplace_listings
  after insert or update or delete on tribuia.marketplace_listings
  for each row execute function tribuia.fn_audit('CREATE');


-- ----------------------------------------------------------------------------
-- B. REGLAS (triggers) Y MODERACION
-- ----------------------------------------------------------------------------
-- Las fotos deben estar en la carpeta del autor dentro del conjunto.
create or replace function tribuia.marketplace_images_valid(
  p_images      jsonb,
  p_condominium uuid,
  p_author      uuid
)
returns boolean
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(bool_and(
           jsonb_typeof(value) = 'string'
           and (value #>> '{}') like p_condominium::text || '/listings/' || p_author::text || '/%'
           and length(value #>> '{}') <= 300
         ), true)
    from jsonb_array_elements(coalesce(p_images, '[]'::jsonb));
$$;

create or replace function tribuia.tg_marketplace_listing_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_admin boolean;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  v_admin := tribuia.is_condominium_admin(new.condominium_id, new.created_by);

  if new.apartment_id is not null and not v_admin
     and new.apartment_id not in (select tribuia.user_apartment_ids(new.created_by)) then
    raise exception 'Solo puedes publicar a nombre de tu propio apartamento' using errcode = '42501';
  end if;

  if not tribuia.marketplace_images_valid(new.images, new.condominium_id, new.created_by) then
    raise exception 'Las fotos no pertenecen a esta publicacion' using errcode = '22023';
  end if;

  -- Antispam: maximo 10 publicaciones activas por persona en el conjunto.
  if not v_admin and (
    select count(*) from tribuia.marketplace_listings
     where condominium_id = new.condominium_id
       and created_by = new.created_by
       and status in ('PENDING', 'APPROVED')
  ) >= 10 then
    raise exception 'Tienes 10 publicaciones activas. Marca alguna como vendida o archivala.'
      using errcode = 'P0001';
  end if;

  -- La administracion publica directo; el resto espera aprobacion.
  new.review_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  if v_admin then
    new.status := 'APPROVED';
    new.published_at := now();
    new.expires_at := now() + interval '60 days';
  else
    new.status := 'PENDING';
    new.published_at := null;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_before_insert on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_before_insert before insert on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_before_insert();

create or replace function tribuia.tg_marketplace_listing_before_update()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_content_changed boolean;
begin
  -- Service role / SQL Editor: sin restricciones. (La RPC de moderacion corre
  -- con el JWT del administrador y pasa por la rama de administracion.)
  if auth.uid() is null then
    return new;
  end if;

  if not tribuia.marketplace_images_valid(new.images, new.condominium_id, new.created_by) then
    raise exception 'Las fotos no pertenecen a esta publicacion' using errcode = '22023';
  end if;

  if tribuia.is_condominium_admin(new.condominium_id) then
    return new;
  end if;

  -- El autor no se aprueba ni se modera a si mismo.
  if new.status is distinct from old.status and new.status not in ('SOLD', 'ARCHIVED', 'PENDING') then
    raise exception 'Solo la administracion aprueba publicaciones' using errcode = '42501';
  end if;
  new.review_notes := old.review_notes;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.published_at := old.published_at;
  new.expires_at := old.expires_at;

  if new.apartment_id is distinct from old.apartment_id and new.apartment_id is not null
     and new.apartment_id not in (select tribuia.user_apartment_ids()) then
    raise exception 'Solo puedes publicar a nombre de tu propio apartamento' using errcode = '42501';
  end if;

  v_content_changed :=
    (new.category, new.title, new.description, new.price, new.price_type, new.item_condition,
     new.details, new.images, new.contact_phone, new.contact_whatsapp, new.apartment_id)
    is distinct from
    (old.category, old.title, old.description, old.price, old.price_type, old.item_condition,
     old.details, old.images, old.contact_phone, old.contact_whatsapp, old.apartment_id);

  -- Contenido nuevo (o republicar algo vendido/archivado) vuelve a revision.
  if (v_content_changed and new.status not in ('SOLD', 'ARCHIVED'))
     or (new.status = 'PENDING' and old.status <> 'PENDING') then
    new.status := 'PENDING';
    new.review_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.published_at := null;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_before_update on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_before_update before update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_before_update();

revoke execute on function tribuia.tg_marketplace_listing_before_insert() from public, anon, authenticated;
revoke execute on function tribuia.tg_marketplace_listing_before_update() from public, anon, authenticated;

-- Aprobar o rechazar (administracion). Avisa al autor.
create or replace function tribuia.review_marketplace_listing(
  p_listing uuid,
  p_approve boolean,
  p_notes   text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.marketplace_listings%rowtype;
  v_status text;
begin
  select * into v_row from tribuia.marketplace_listings where id = p_listing for update;
  if v_row.id is null then
    raise exception 'La publicacion no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_row.condominium_id) then
    raise exception 'Solo la administracion modera el marketplace' using errcode = '42501';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Esta publicacion ya fue revisada' using errcode = 'P0001';
  end if;

  v_status := case when p_approve then 'APPROVED' else 'REJECTED' end;
  update tribuia.marketplace_listings
     set status = v_status,
         review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         published_at = case when p_approve then now() else null end,
         expires_at = case when p_approve then now() + interval '60 days' else null end
   where id = p_listing;

  insert into tribuia.notifications
    (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  values (
    v_row.condominium_id, v_row.created_by,
    case when p_approve then 'Tu publicacion fue aprobada' else 'Tu publicacion no fue aprobada' end,
    left(v_row.title || coalesce(' — ' || nullif(btrim(coalesce(p_notes, '')), ''), ''), 240),
    'SYSTEM', 'LOW', 'marketplace_listings', v_row.id, '/marketplace?tab=mias'
  );
  return v_status;
end;
$$;

-- Aviso a la administracion cuando llega algo por aprobar.
create or replace function tribuia.tg_marketplace_listing_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status = 'PENDING' and (tg_op = 'INSERT' or old.status is distinct from 'PENDING') then
    insert into tribuia.notifications
      (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select new.condominium_id, m.user_id, 'Publicacion por aprobar en el marketplace',
           left(new.title, 240), 'SYSTEM', 'LOW', 'marketplace_listings', new.id,
           '/marketplace?tab=revisar'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id and r.code = 'ADMINISTRATOR'
     where m.condominium_id = new.condominium_id
       and m.status = 'ACTIVE'
       and m.user_id <> new.created_by;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_marketplace_listings_notify on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_notify
  after insert or update of status on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_notify();

revoke execute on function tribuia.tg_marketplace_listing_notify() from public, anon, authenticated;
revoke all on function tribuia.review_marketplace_listing(uuid, boolean, text) from public, anon;
grant execute on function tribuia.review_marketplace_listing(uuid, boolean, text) to authenticated, service_role;
grant execute on function tribuia.marketplace_images_valid(jsonb, uuid, uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table tribuia.marketplace_listings enable row level security;

drop policy if exists marketplace_listings_select on tribuia.marketplace_listings;
create policy marketplace_listings_select on tribuia.marketplace_listings for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
    and (
      (status = 'APPROVED' and (expires_at is null or expires_at > now()))
      or created_by = (select auth.uid())
      or tribuia.is_condominium_admin(condominium_id)
    )
  );

drop policy if exists marketplace_listings_insert on tribuia.marketplace_listings;
create policy marketplace_listings_insert on tribuia.marketplace_listings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
  );

drop policy if exists marketplace_listings_update on tribuia.marketplace_listings;
create policy marketplace_listings_update on tribuia.marketplace_listings for update to authenticated
  using (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id))
  with check (
    (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
  );

drop policy if exists marketplace_listings_delete on tribuia.marketplace_listings;
create policy marketplace_listings_delete on tribuia.marketplace_listings for delete to authenticated
  using (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id));

revoke all on tribuia.marketplace_listings from anon;
grant select, insert, update, delete on tribuia.marketplace_listings to authenticated;
grant all on tribuia.marketplace_listings to service_role;


-- ----------------------------------------------------------------------------
-- D. STORAGE: fotos de las publicaciones
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  drop policy if exists edifeasy_marketplace_read on storage.objects;
  drop policy if exists edifeasy_marketplace_write on storage.objects;
  drop policy if exists edifeasy_marketplace_delete on storage.objects;

  -- Ruta: <condominium_id>/listings/<user_id>/<archivo>
  execute $pol$
    create policy edifeasy_marketplace_read on storage.objects for select to authenticated
    using (
      bucket_id = 'marketplace'
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_marketplace_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'marketplace'
      and (storage.foldername(name))[2] = 'listings'
      and (storage.foldername(name))[3] = (select auth.uid())::text
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_marketplace_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'marketplace'
      and (
        (storage.foldername(name))[3] = (select auth.uid())::text
        or tribuia.is_condominium_admin(tribuia.safe_uuid((storage.foldername(name))[1]))
      )
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- 22. CUMPLIMIENTO LEGAL (migracion 20261019200000_cumplimiento_legal)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. DATOS LEGALES DEL OPERADOR
-- ----------------------------------------------------------------------------
create table if not exists tribuia.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references tribuia.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_check check (key in ('legal_entity')),
  constraint platform_settings_value_check check (
    jsonb_typeof(value) = 'object' and pg_column_size(value) <= 8000
  )
);

comment on table tribuia.platform_settings is
  'Configuracion global de la plataforma. legal_entity: datos del operador para terminos y politica de datos.';

create index if not exists idx_platform_settings_updated_by on tribuia.platform_settings (updated_by);

drop trigger if exists trg_platform_settings_updated_at on tribuia.platform_settings;
create trigger trg_platform_settings_updated_at before update on tribuia.platform_settings
  for each row execute function tribuia.set_updated_at();

insert into tribuia.platform_settings (key, value)
values ('legal_entity', '{}'::jsonb)
on conflict (key) do nothing;

alter table tribuia.platform_settings enable row level security;

drop policy if exists platform_settings_select on tribuia.platform_settings;
create policy platform_settings_select on tribuia.platform_settings for select to anon, authenticated
  using (key = 'legal_entity');
drop policy if exists platform_settings_update on tribuia.platform_settings;
create policy platform_settings_update on tribuia.platform_settings for update to authenticated
  using (tribuia.is_super_admin())
  with check (tribuia.is_super_admin());

revoke all on tribuia.platform_settings from anon, authenticated;
grant select on tribuia.platform_settings to anon, authenticated;
grant update on tribuia.platform_settings to authenticated;
grant all on tribuia.platform_settings to service_role;


-- ----------------------------------------------------------------------------
-- B. PRUEBA DE LA AUTORIZACION
-- ----------------------------------------------------------------------------
create table if not exists tribuia.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  -- La prueba se conserva aunque se borre la cuenta (se guarda el correo).
  user_id     uuid references tribuia.profiles (id) on delete set null,
  email       text not null,
  document    text not null,
  version     text not null,
  source      text not null default 'APP',
  user_agent  text,
  accepted_at timestamptz not null default now(),
  constraint legal_acceptances_document_check check (document in ('TERMS', 'PRIVACY', 'MARKETPLACE_RULES')),
  constraint legal_acceptances_source_check check (source in ('SIGNUP', 'LOGIN', 'APP')),
  constraint legal_acceptances_version_check check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint legal_acceptances_ua_check check (coalesce(length(user_agent), 0) <= 400)
);

create unique index if not exists uq_legal_acceptances_user_doc_version
  on tribuia.legal_acceptances (user_id, document, version);

alter table tribuia.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_select on tribuia.legal_acceptances;
create policy legal_acceptances_select on tribuia.legal_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or tribuia.is_super_admin());
-- Sin insert/update/delete directos: solo accept_legal_documents y el alta.

revoke all on tribuia.legal_acceptances from anon, authenticated;
grant select on tribuia.legal_acceptances to authenticated;
grant all on tribuia.legal_acceptances to service_role;

create or replace function tribuia.accept_legal_documents(
  p_documents  text[],
  p_version    text,
  p_user_agent text default null
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_documents is null or cardinality(p_documents) = 0
     or not (p_documents <@ array['TERMS', 'PRIVACY', 'MARKETPLACE_RULES']) then
    raise exception 'Documentos invalidos' using errcode = '22023';
  end if;

  select email into v_email from tribuia.profiles where id = v_user;

  insert into tribuia.legal_acceptances (user_id, email, document, version, source, user_agent)
  select v_user, coalesce(v_email, ''), d, p_version, 'LOGIN', left(p_user_agent, 400)
    from unnest(p_documents) as d
  on conflict (user_id, document, version) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function tribuia.accept_legal_documents(text[], text, text) from public, anon;
grant execute on function tribuia.accept_legal_documents(text[], text, text) to authenticated;

-- El alta guarda la aceptacion que el usuario dio en el formulario de registro
-- (metadato legal_version). Reemplaza handle_new_user conservando su logica.
create or replace function tribuia.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_requested_role text;
  v_legal_version  text;
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

  v_legal_version := new.raw_user_meta_data ->> 'legal_version';
  if v_legal_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    insert into tribuia.legal_acceptances (user_id, email, document, version, source, user_agent)
    select new.id, coalesce(new.email, ''), d, v_legal_version, 'SIGNUP',
           left(new.raw_user_meta_data ->> 'user_agent', 400)
      from unnest(array['TERMS', 'PRIVACY']) as d
    on conflict (user_id, document, version) do nothing;
  end if;

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- C. CONSULTAS Y RECLAMOS DE TITULARES
-- ----------------------------------------------------------------------------
-- Suma dias habiles (lunes a viernes). No descuenta festivos: el plazo real
-- puede ser uno o dos dias mayor, nunca menor.
create or replace function tribuia.add_business_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
immutable
set search_path = tribuia, public, pg_temp
as $$
declare
  v_date  timestamptz := p_from;
  v_added integer := 0;
begin
  while v_added < p_days loop
    v_date := v_date + interval '1 day';
    if extract(isodow from v_date at time zone 'America/Bogota') < 6 then
      v_added := v_added + 1;
    end if;
  end loop;
  return v_date;
end;
$$;

create table if not exists tribuia.data_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references tribuia.profiles (id) on delete set null,
  email       text not null,
  type        text not null,
  details     text,
  status      text not null default 'OPEN',
  response    text,
  due_at      timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid references tribuia.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint data_requests_type_check check (type in ('ACCESS', 'RECTIFY', 'DELETE', 'REVOKE', 'COMPLAINT')),
  constraint data_requests_status_check check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
  constraint data_requests_lengths_check check (
    coalesce(length(details), 0) <= 2000 and coalesce(length(response), 0) <= 4000
  )
);

create index if not exists idx_data_requests_user on tribuia.data_requests (user_id);
create index if not exists idx_data_requests_status on tribuia.data_requests (status, due_at);
create index if not exists idx_data_requests_resolved_by on tribuia.data_requests (resolved_by);

drop trigger if exists trg_data_requests_updated_at on tribuia.data_requests;
create trigger trg_data_requests_updated_at before update on tribuia.data_requests
  for each row execute function tribuia.set_updated_at();

alter table tribuia.data_requests enable row level security;

drop policy if exists data_requests_select on tribuia.data_requests;
create policy data_requests_select on tribuia.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or tribuia.is_super_admin());

revoke all on tribuia.data_requests from anon, authenticated;
grant select on tribuia.data_requests to authenticated;
grant all on tribuia.data_requests to service_role;

-- Consultas (conocer sus datos): 10 dias habiles. Reclamos: 15 dias habiles.
create or replace function tribuia.create_data_request(p_type text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_type not in ('ACCESS', 'RECTIFY', 'DELETE', 'REVOKE', 'COMPLAINT') then
    raise exception 'Tipo de solicitud invalido' using errcode = '22023';
  end if;
  if (select count(*) from tribuia.data_requests
       where user_id = v_user and status in ('OPEN', 'IN_PROGRESS')) >= 5 then
    raise exception 'Ya tienes 5 solicitudes abiertas. Espera la respuesta.' using errcode = 'P0001';
  end if;

  select email into v_email from tribuia.profiles where id = v_user;

  insert into tribuia.data_requests (user_id, email, type, details, due_at)
  values (v_user, coalesce(v_email, ''), p_type, nullif(left(btrim(coalesce(p_details, '')), 2000), ''),
          tribuia.add_business_days(now(), case when p_type = 'ACCESS' then 10 else 15 end))
  returning id into v_id;
  return v_id;
end;
$$;

-- Respuesta del operador (SUPER_ADMIN). Avisa al titular.
create or replace function tribuia.resolve_data_request(
  p_request  uuid,
  p_status   text,
  p_response text
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.data_requests%rowtype;
begin
  if not tribuia.is_super_admin() then
    raise exception 'Solo el operador de la plataforma responde solicitudes de datos' using errcode = '42501';
  end if;
  if p_status not in ('IN_PROGRESS', 'RESOLVED', 'REJECTED') then
    raise exception 'Estado invalido' using errcode = '22023';
  end if;
  if p_status in ('RESOLVED', 'REJECTED') and length(btrim(coalesce(p_response, ''))) < 10 then
    raise exception 'Escribe la respuesta al titular (minimo 10 caracteres)' using errcode = '22023';
  end if;

  update tribuia.data_requests
     set status = p_status,
         response = coalesce(nullif(btrim(coalesce(p_response, '')), ''), response),
         resolved_at = case when p_status in ('RESOLVED', 'REJECTED') then now() else null end,
         resolved_by = case when p_status in ('RESOLVED', 'REJECTED') then auth.uid() else null end
   where id = p_request
  returning * into v_row;

  if v_row.id is null then
    raise exception 'La solicitud no existe' using errcode = 'P0002';
  end if;

  if v_row.user_id is not null and p_status in ('RESOLVED', 'REJECTED') then
    insert into tribuia.notifications (user_id, title, body, type, priority, entity, entity_id, link)
    values (v_row.user_id, 'Respuesta a tu solicitud sobre tus datos personales',
            left(v_row.response, 240), 'SYSTEM', 'MEDIUM', 'data_requests', v_row.id,
            '/settings?tab=privacidad');
  end if;
  return v_row.status;
end;
$$;

revoke all on function tribuia.create_data_request(text, text) from public, anon;
revoke all on function tribuia.resolve_data_request(uuid, text, text) from public, anon;
grant execute on function tribuia.create_data_request(text, text) to authenticated;
grant execute on function tribuia.resolve_data_request(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- D. DESCARGA DE MIS DATOS
-- ----------------------------------------------------------------------------
create or replace function tribuia.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'profile', (select to_jsonb(p) - 'metadata' from tribuia.profiles p where p.id = v_user),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
               'condominium', c.name, 'role', r.name, 'status', m.status, 'since', m.joined_at))
        from tribuia.condominium_members m
        join tribuia.condominiums c on c.id = m.condominium_id
        join tribuia.roles r on r.id = m.role_id
       where m.user_id = v_user), '[]'::jsonb),
    'apartments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'condominium', c.name, 'building', b.name, 'apartment', a.number,
               'relation', x.relation, 'active', x.is_active))
        from (
          select apartment_id, 'OWNER' as relation, is_active from tribuia.apartment_owners where profile_id = v_user
          union all
          select apartment_id, 'TENANT', is_active from tribuia.apartment_tenants where profile_id = v_user
        ) x
        join tribuia.apartments a on a.id = x.apartment_id
        join tribuia.buildings b on b.id = a.building_id
        join tribuia.condominiums c on c.id = a.condominium_id), '[]'::jsonb),
    'resident_records', coalesce((
      select jsonb_agg(to_jsonb(r) - 'condominium_id' - 'apartment_id' - 'profile_id')
        from tribuia.residents r where r.profile_id = v_user), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('code', q.code, 'title', q.title, 'status', q.status, 'created_at', q.created_at))
        from tribuia.requests q where q.created_by = v_user), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object('area', ca.name, 'starts_at', rv.starts_at, 'ends_at', rv.ends_at,
                                          'status', rv.status, 'amount', rv.amount))
        from tribuia.reservations rv join tribuia.common_areas ca on ca.id = rv.common_area_id
       where rv.created_by = v_user), '[]'::jsonb),
    'marketplace_listings', coalesce((
      select jsonb_agg(jsonb_build_object('title', l.title, 'category', l.category, 'status', l.status,
                                          'price', l.price, 'created_at', l.created_at))
        from tribuia.marketplace_listings l where l.created_by = v_user), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('reference', p.reference, 'kind', p.kind, 'amount', p.amount,
                                          'status', p.status, 'paid_at', p.paid_at))
        from tribuia.payments p where p.payer_id = v_user), '[]'::jsonb),
    'legal_acceptances', coalesce((
      select jsonb_agg(jsonb_build_object('document', a.document, 'version', a.version,
                                          'accepted_at', a.accepted_at, 'source', a.source))
        from tribuia.legal_acceptances a where a.user_id = v_user), '[]'::jsonb),
    'data_requests', coalesce((
      select jsonb_agg(jsonb_build_object('type', d.type, 'status', d.status, 'created_at', d.created_at,
                                          'response', d.response))
        from tribuia.data_requests d where d.user_id = v_user), '[]'::jsonb)
  );
end;
$$;

revoke all on function tribuia.export_my_data() from public, anon;
grant execute on function tribuia.export_my_data() to authenticated;


-- ----------------------------------------------------------------------------
-- E. REGISTRO DE VENDEDORES DEL MARKETPLACE (Ley 1480 de 2011, art. 53)
-- ----------------------------------------------------------------------------
create table if not exists tribuia.marketplace_seller_registry (
  listing_id      uuid primary key references tribuia.marketplace_listings (id) on delete cascade,
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  seller_id       uuid references tribuia.profiles (id) on delete set null,
  full_name       text not null,
  document_type   text,
  document_number text not null,
  address         text not null,
  phone           text,
  email           text,
  created_at      timestamptz not null default now()
);

comment on table tribuia.marketplace_seller_registry is
  'Registro de oferentes del portal de contacto (Ley 1480 art. 53). Solo lo ven la administracion del conjunto, el operador y el propio vendedor.';

create index if not exists idx_seller_registry_condominium on tribuia.marketplace_seller_registry (condominium_id);
create index if not exists idx_seller_registry_seller on tribuia.marketplace_seller_registry (seller_id);

alter table tribuia.marketplace_seller_registry enable row level security;

drop policy if exists seller_registry_select on tribuia.marketplace_seller_registry;
create policy seller_registry_select on tribuia.marketplace_seller_registry for select to authenticated
  using (seller_id = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id));

revoke all on tribuia.marketplace_seller_registry from anon, authenticated;
grant select on tribuia.marketplace_seller_registry to authenticated;
grant all on tribuia.marketplace_seller_registry to service_role;

-- Antes de publicar: documento del vendedor y reglas aceptadas.
create or replace function tribuia.tg_marketplace_listing_requirements()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_profile tribuia.profiles%rowtype;
begin
  if auth.uid() is null then
    return new;
  end if;
  select * into v_profile from tribuia.profiles where id = new.created_by;
  if nullif(btrim(coalesce(v_profile.document_number, '')), '') is null then
    raise exception 'Para publicar registra tu documento de identidad (Ley 1480 de 2011, art. 53)'
      using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from tribuia.legal_acceptances
     where user_id = new.created_by and document = 'MARKETPLACE_RULES'
  ) then
    raise exception 'Acepta las reglas del marketplace para publicar' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_requirements on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_requirements before insert on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_requirements();

-- Al publicar se guarda el registro del oferente con los datos de ese momento.
create or replace function tribuia.tg_marketplace_listing_registry()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  insert into tribuia.marketplace_seller_registry
    (listing_id, condominium_id, seller_id, full_name, document_type, document_number, address, phone, email)
  select new.id, new.condominium_id, p.id, p.full_name, p.document_type,
         coalesce(nullif(btrim(p.document_number), ''), 'NO REGISTRADO'),
         concat_ws(', ',
           nullif(concat_ws(' ', b.name, case when a.number is not null then 'Apto ' || a.number end), ''),
           c.name, c.address, c.city),
         coalesce(new.contact_phone, new.contact_whatsapp, p.phone),
         p.email
    from tribuia.profiles p
    join tribuia.condominiums c on c.id = new.condominium_id
    left join tribuia.apartments a on a.id = new.apartment_id
    left join tribuia.buildings b on b.id = a.building_id
   where p.id = new.created_by
  on conflict (listing_id) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_marketplace_listings_registry on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_registry after insert on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_registry();

revoke execute on function tribuia.tg_marketplace_listing_requirements() from public, anon, authenticated;
revoke execute on function tribuia.tg_marketplace_listing_registry() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================

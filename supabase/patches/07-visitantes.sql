-- ============================================================================
-- PARCHE 07 :: Modulo de Celaduria - Visitantes
-- ----------------------------------------------------------------------------
-- Registro de personas externas (visitas, domicilios, proveedores) ligadas
-- siempre a un apartamento, con ciclo de entrada/salida.
--
-- Que hace:
--   A. Crea los tipos enum `visitor_type` y `visitor_status` si no existen.
--   B. Crea la tabla `tribuia.visitors`, sus indices y el trigger updated_at.
--   C. Activa RLS y crea las politicas de acceso:
--        * Celaduria, Administracion y Voceria: acceso completo al condominio.
--        * Propietario / Arrendatario: solo los visitantes de su apartamento.
--   D. Anade la tabla al publication supabase_realtime (para el tablero).
--
-- Seguro de re-ejecutar desde el SQL Editor (todo es idempotente).
-- ----------------------------------------------------------------------------
-- Orden recomendado:
--   1) supabase/schema.sql      (o el parche 07 si el esquema ya aplico 00-06)
--   2) este parche
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- A. TIPOS ENUM
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'visitor_type') then
    create type tribuia.visitor_type as enum ('VISIT', 'DELIVERY', 'PROVIDER', 'OTHER');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'visitor_status') then
    create type tribuia.visitor_status as enum ('EXPECTED', 'INSIDE', 'LEFT', 'CANCELLED');
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- B. TABLA
-- ----------------------------------------------------------------------------
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

create index if not exists idx_visitors_condominium on tribuia.visitors (condominium_id, status, scheduled_at desc);
create index if not exists idx_visitors_apartment on tribuia.visitors (apartment_id);
create index if not exists idx_visitors_scheduled_at on tribuia.visitors (scheduled_at desc);
create index if not exists idx_visitors_created_at on tribuia.visitors (created_at desc);

drop trigger if exists trg_visitors_updated_at on tribuia.visitors;
create trigger trg_visitors_updated_at
  before update on tribuia.visitors
  for each row execute function tribuia.set_updated_at();

-- ----------------------------------------------------------------------------
-- C. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table tribuia.visitors enable row level security;

drop policy if exists visitors_select on tribuia.visitors;
drop policy if exists visitors_write on tribuia.visitors;

create policy visitors_select on tribuia.visitors for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
    or tribuia.user_is_tenant(apartment_id)
  );

create policy visitors_write on tribuia.visitors for all to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.has_role(condominium_id, array['SECURITY'])
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  )
  with check (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.has_role(condominium_id, array['SECURITY'])
    or tribuia.user_owns_apartment(apartment_id)
    or tribuia.user_is_tenant(apartment_id)
  );

-- Permisos de tabla (la app entra como `anon`/`authenticated` con publishable key)
grant select, insert, update, delete on tribuia.visitors to authenticated;

-- ----------------------------------------------------------------------------
-- D. REALTIME (tablero de celaduria)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'tribuia' and tablename = 'visitors'
  ) then
    alter publication supabase_realtime add table tribuia.visitors;
  end if;
  alter table tribuia.visitors replica identity full;
end
$$;

-- Verificacion rapida ---------------------------------------------------------
select tablename from pg_tables where schemaname = 'tribuia' and tablename = 'visitors';
select typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'tribuia' and typname in ('visitor_type', 'visitor_status');
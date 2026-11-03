-- ============================================================================
-- EdiFeasy :: Inmobiliarias
-- ----------------------------------------------------------------------------
-- Una inmobiliaria es un espacio de trabajo (tabla condominiums) con
-- kind = 'AGENCY'. Reutiliza membresias, roles, RLS, marca, planes y prueba
-- gratis. Roles dentro de una inmobiliaria:
--   ADMINISTRATOR  administra la inmobiliaria.
--   OWNER          propietario (dueno) de una o varias propiedades.
--   TENANT         arrendatario: paga canon y administracion desde la app.
--
-- A. Tipo de espacio y enlace publico (slug) de la tienda.
-- B. Propiedades (casa, apartamento, local, oficina, bodega, lote, finca...).
-- C. Contratos de arriendo y cobros mensuales (canon y administracion).
-- D. Cuenta Wompi propia por espacio: el dinero llega directo a la
--    inmobiliaria (o al conjunto). Las llaves secretas solo las lee el servidor.
-- E. Pagos en linea del arriendo (payments.kind = 'LEASE').
-- F. Tienda publica (sin sesion) e interesados.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. TIPO DE ESPACIO Y ENLACE PUBLICO
-- ============================================================================
alter table tribuia.condominiums add column if not exists kind text not null default 'CONDOMINIUM';
alter table tribuia.condominiums drop constraint if exists condominiums_kind_check;
alter table tribuia.condominiums add constraint condominiums_kind_check check (kind in ('CONDOMINIUM', 'AGENCY'));

alter table tribuia.condominiums add column if not exists slug text;
alter table tribuia.condominiums drop constraint if exists condominiums_slug_check;
alter table tribuia.condominiums add constraint condominiums_slug_check check (
  slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60)
);
create unique index if not exists idx_condominiums_slug on tribuia.condominiums (slug) where slug is not null;

-- El tipo lo fija quien crea el espacio; despues solo lo cambia el SUPER_ADMIN.
create or replace function tribuia.tg_condominiums_kind_locked()
returns trigger
language plpgsql
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.kind is distinct from old.kind and not tribuia.is_super_admin() and auth.role() <> 'service_role' then
    raise exception 'El tipo de espacio no se puede cambiar' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_condominiums_kind_locked on tribuia.condominiums;
create trigger trg_condominiums_kind_locked before update on tribuia.condominiums
  for each row execute function tribuia.tg_condominiums_kind_locked();

create or replace function tribuia.is_agency(p_condominium uuid)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (select 1 from tribuia.condominiums where id = p_condominium and kind = 'AGENCY');
$$;

grant execute on function tribuia.is_agency(uuid) to anon, authenticated, service_role;

-- Contexto de sesion: el tipo de cada espacio (la app arma el menu con el).
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
        'condominium_kind', c.kind,
        'trial_ends_at', c.trial_ends_at,
        'has_access', c.id not in (select tribuia.expired_condominium_ids()),
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

-- ============================================================================
-- B. PROPIEDADES
-- ============================================================================
create table if not exists tribuia.agency_properties (
  id                  uuid primary key default gen_random_uuid(),
  condominium_id      uuid not null references tribuia.condominiums (id) on delete cascade,
  code                text,
  title               text not null,
  property_type       text not null,
  operation           text not null default 'RENT',
  status              text not null default 'AVAILABLE',
  is_published        boolean not null default false,
  rent_price          numeric(14, 2),
  admin_fee           numeric(14, 2) not null default 0,
  sale_price          numeric(14, 2),
  address             text,
  neighborhood        text,
  city                text,
  stratum             integer,
  area_m2             numeric(10, 2),
  bedrooms            integer,
  bathrooms           integer,
  parking             integer,
  floor               integer,
  furnished           boolean not null default false,
  pets_allowed        boolean not null default false,
  amenities           text[] not null default '{}',
  description         text,
  images              text[] not null default '{}',
  owner_profile_id    uuid references tribuia.profiles (id) on delete set null,
  owner_name          text,
  owner_phone         text,
  linked_apartment_id uuid references tribuia.apartments (id) on delete set null,
  published_at        timestamptz,
  created_by          uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint agency_properties_title_check check (length(btrim(title)) between 3 and 140),
  constraint agency_properties_type_check check (property_type in (
    'CASA', 'APARTAMENTO', 'APARTAESTUDIO', 'LOCAL', 'OFICINA', 'BODEGA', 'LOTE', 'FINCA', 'OTRO'
  )),
  constraint agency_properties_operation_check check (operation in ('RENT', 'SALE', 'BOTH')),
  constraint agency_properties_status_check check (status in ('AVAILABLE', 'RESERVED', 'RENTED', 'SOLD', 'INACTIVE')),
  constraint agency_properties_prices_check check (
    (operation = 'SALE' or rent_price is not null)
    and (operation = 'RENT' or sale_price is not null)
    and coalesce(rent_price, 0) >= 0 and coalesce(sale_price, 0) >= 0 and admin_fee >= 0
  ),
  constraint agency_properties_stratum_check check (stratum is null or stratum between 1 and 6),
  constraint agency_properties_counts_check check (
    coalesce(bedrooms, 0) between 0 and 50 and coalesce(bathrooms, 0) between 0 and 50
    and coalesce(parking, 0) between 0 and 50 and coalesce(area_m2, 0) >= 0
  ),
  constraint agency_properties_images_check check (cardinality(images) <= 15),
  constraint agency_properties_description_check check (description is null or length(description) <= 5000)
);

create index if not exists idx_agency_properties_condominium on tribuia.agency_properties (condominium_id, status);
create index if not exists idx_agency_properties_owner on tribuia.agency_properties (owner_profile_id);
create index if not exists idx_agency_properties_linked on tribuia.agency_properties (linked_apartment_id);
create index if not exists idx_agency_properties_created_by on tribuia.agency_properties (created_by);
create index if not exists idx_agency_properties_store on tribuia.agency_properties (condominium_id)
  where is_published and status in ('AVAILABLE', 'RESERVED');

-- Solo en espacios tipo inmobiliaria; el dueno debe ser miembro con rol OWNER.
create or replace function tribuia.tg_agency_properties_before()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and not tribuia.is_agency(new.condominium_id) then
    raise exception 'Las propiedades solo existen en espacios de inmobiliaria' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.condominium_id is distinct from old.condominium_id then
    raise exception 'No se puede mover una propiedad a otro espacio' using errcode = '42501';
  end if;
  if new.owner_profile_id is not null and not tribuia.has_role(new.condominium_id, array['OWNER'], new.owner_profile_id) then
    raise exception 'El propietario debe estar registrado en la inmobiliaria con rol Propietario' using errcode = 'P0001';
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agency_properties_before on tribuia.agency_properties;
create trigger trg_agency_properties_before before insert or update on tribuia.agency_properties
  for each row execute function tribuia.tg_agency_properties_before();

drop trigger if exists trg_agency_properties_updated_at on tribuia.agency_properties;
create trigger trg_agency_properties_updated_at before update on tribuia.agency_properties
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_audit_agency_properties on tribuia.agency_properties;
create trigger trg_audit_agency_properties after insert or update or delete on tribuia.agency_properties
  for each row execute function tribuia.fn_audit();

-- ============================================================================
-- C. CONTRATOS Y COBROS
-- ============================================================================
create table if not exists tribuia.property_leases (
  id                uuid primary key default gen_random_uuid(),
  condominium_id    uuid not null references tribuia.condominiums (id) on delete cascade,
  property_id       uuid not null references tribuia.agency_properties (id) on delete cascade,
  tenant_profile_id uuid references tribuia.profiles (id) on delete set null,
  tenant_name       text not null,
  tenant_document   text,
  tenant_email      text,
  tenant_phone      text,
  start_date        date not null,
  end_date          date,
  monthly_rent      numeric(14, 2) not null,
  admin_fee         numeric(14, 2) not null default 0,
  due_day           integer not null default 5,
  deposit           numeric(14, 2),
  status            text not null default 'ACTIVE',
  notes             text,
  created_by        uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint property_leases_status_check check (status in ('ACTIVE', 'ENDED', 'CANCELLED')),
  constraint property_leases_amounts_check check (monthly_rent > 0 and admin_fee >= 0 and coalesce(deposit, 0) >= 0),
  constraint property_leases_due_day_check check (due_day between 1 and 28),
  constraint property_leases_dates_check check (end_date is null or end_date >= start_date),
  constraint property_leases_tenant_check check (length(btrim(tenant_name)) between 3 and 140)
);

create unique index if not exists idx_property_leases_one_active on tribuia.property_leases (property_id) where status = 'ACTIVE';
create index if not exists idx_property_leases_condominium on tribuia.property_leases (condominium_id, status);
create index if not exists idx_property_leases_tenant on tribuia.property_leases (tenant_profile_id);
create index if not exists idx_property_leases_created_by on tribuia.property_leases (created_by);

create or replace function tribuia.tg_property_leases_before()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not exists (select 1 from tribuia.agency_properties p where p.id = new.property_id and p.condominium_id = new.condominium_id) then
    raise exception 'La propiedad no pertenece a esta inmobiliaria' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.condominium_id is distinct from old.condominium_id then
    raise exception 'No se puede mover un contrato a otro espacio' using errcode = '42501';
  end if;
  if new.tenant_profile_id is not null and not tribuia.has_role(new.condominium_id, array['TENANT'], new.tenant_profile_id) then
    raise exception 'El arrendatario debe estar registrado en la inmobiliaria con rol Arrendatario' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_property_leases_before on tribuia.property_leases;
create trigger trg_property_leases_before before insert or update on tribuia.property_leases
  for each row execute function tribuia.tg_property_leases_before();

-- El estado de la propiedad sigue al contrato.
create or replace function tribuia.tg_property_leases_sync()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status = 'ACTIVE' then
    update tribuia.agency_properties set status = 'RENTED' where id = new.property_id and status <> 'RENTED';
  elsif tg_op = 'UPDATE' and old.status = 'ACTIVE' then
    update tribuia.agency_properties set status = 'AVAILABLE'
     where id = new.property_id and status = 'RENTED'
       and not exists (select 1 from tribuia.property_leases l where l.property_id = new.property_id and l.status = 'ACTIVE');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_property_leases_sync on tribuia.property_leases;
create trigger trg_property_leases_sync after insert or update on tribuia.property_leases
  for each row execute function tribuia.tg_property_leases_sync();

drop trigger if exists trg_property_leases_updated_at on tribuia.property_leases;
create trigger trg_property_leases_updated_at before update on tribuia.property_leases
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_audit_property_leases on tribuia.property_leases;
create trigger trg_audit_property_leases after insert or update or delete on tribuia.property_leases
  for each row execute function tribuia.fn_audit();

create table if not exists tribuia.lease_charges (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  lease_id       uuid not null references tribuia.property_leases (id) on delete cascade,
  property_id    uuid not null references tribuia.agency_properties (id) on delete cascade,
  period         date not null,
  concept        text not null,
  description    text,
  amount         numeric(14, 2) not null,
  due_date       date not null,
  status         text not null default 'PENDING',
  paid_at        timestamptz,
  payment_method text,
  payment_id     uuid references tribuia.payments (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint lease_charges_concept_check check (concept in ('RENT', 'ADMIN_FEE', 'UTILITIES', 'OTHER')),
  constraint lease_charges_status_check check (status in ('PENDING', 'PAID', 'VOID')),
  constraint lease_charges_amount_check check (amount > 0),
  constraint lease_charges_method_check check (payment_method is null or payment_method in ('ONLINE', 'CASH', 'TRANSFER'))
);

create unique index if not exists idx_lease_charges_monthly on tribuia.lease_charges (lease_id, period, concept)
  where concept in ('RENT', 'ADMIN_FEE');
create index if not exists idx_lease_charges_condominium on tribuia.lease_charges (condominium_id, period desc, status);
create index if not exists idx_lease_charges_property on tribuia.lease_charges (property_id);
create index if not exists idx_lease_charges_payment on tribuia.lease_charges (payment_id);

-- Quien arrienda o es dueno: ids para las politicas (una consulta por sesion).
create or replace function tribuia.user_leased_property_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select l.property_id from tribuia.property_leases l
   where l.tenant_profile_id = p_user and l.status = 'ACTIVE';
$$;

create or replace function tribuia.user_owned_property_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select p.id from tribuia.agency_properties p where p.owner_profile_id = p_user;
$$;

grant execute on function tribuia.user_leased_property_ids(uuid) to authenticated, service_role;
grant execute on function tribuia.user_owned_property_ids(uuid) to authenticated, service_role;

-- Cobros del mes para todos los contratos activos. La administracion no se
-- cobra si la propiedad esta vinculada a un conjunto en EdiFeasy (el conjunto
-- la cobra directamente).
create or replace function tribuia.generate_lease_charges(p_condominium uuid, p_period date)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_end    date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_count  integer := 0;
  v_rows   integer;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'Solo la administracion de la inmobiliaria puede generar cobros' using errcode = '42501';
  end if;

  insert into tribuia.lease_charges (condominium_id, lease_id, property_id, period, concept, description, amount, due_date)
  select l.condominium_id, l.id, l.property_id, v_period, 'RENT',
         'Canon de arrendamiento ' || to_char(v_period, 'MM/YYYY'),
         l.monthly_rent, make_date(extract(year from v_period)::int, extract(month from v_period)::int, l.due_day)
    from tribuia.property_leases l
   where l.condominium_id = p_condominium and l.status = 'ACTIVE'
     and l.start_date <= v_end and (l.end_date is null or l.end_date >= v_period)
  on conflict (lease_id, period, concept) where concept in ('RENT', 'ADMIN_FEE') do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into tribuia.lease_charges (condominium_id, lease_id, property_id, period, concept, description, amount, due_date)
  select l.condominium_id, l.id, l.property_id, v_period, 'ADMIN_FEE',
         'Cuota de administracion ' || to_char(v_period, 'MM/YYYY'),
         l.admin_fee, make_date(extract(year from v_period)::int, extract(month from v_period)::int, l.due_day)
    from tribuia.property_leases l
    join tribuia.agency_properties p on p.id = l.property_id
   where l.condominium_id = p_condominium and l.status = 'ACTIVE' and l.admin_fee > 0
     and p.linked_apartment_id is null
     and l.start_date <= v_end and (l.end_date is null or l.end_date >= v_period)
  on conflict (lease_id, period, concept) where concept in ('RENT', 'ADMIN_FEE') do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Aviso a cada arrendatario con cuenta.
  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, link)
  select distinct l.condominium_id, l.tenant_profile_id,
         'Tu arriendo de ' || to_char(v_period, 'MM/YYYY') || ' ya se puede pagar',
         'Paga el canon y la administracion desde la app.',
         'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level, 'lease_charges', '/agency/my-lease'
    from tribuia.property_leases l
   where l.condominium_id = p_condominium and l.status = 'ACTIVE' and l.tenant_profile_id is not null
     and v_count > 0
     and exists (select 1 from tribuia.lease_charges c where c.lease_id = l.id and c.period = v_period and c.status = 'PENDING');

  return v_count;
end;
$$;

-- Pago recibido por fuera de la app (efectivo o transferencia).
create or replace function tribuia.register_lease_payment(p_charges uuid[], p_method text)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_method not in ('CASH', 'TRANSFER') then
    raise exception 'Metodo no valido' using errcode = '22023';
  end if;
  if exists (
    select 1 from tribuia.lease_charges c
     where c.id = any(p_charges) and not tribuia.is_condominium_admin(c.condominium_id)
  ) then
    raise exception 'Solo la administracion de la inmobiliaria registra pagos' using errcode = '42501';
  end if;
  update tribuia.lease_charges
     set status = 'PAID', paid_at = now(), payment_method = p_method
   where id = any(p_charges) and status = 'PENDING';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function tribuia.void_lease_charge(p_charge uuid)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not exists (select 1 from tribuia.lease_charges c where c.id = p_charge and tribuia.is_condominium_admin(c.condominium_id)) then
    raise exception 'Solo la administracion de la inmobiliaria anula cobros' using errcode = '42501';
  end if;
  update tribuia.lease_charges set status = 'VOID' where id = p_charge and status = 'PENDING';
  return p_charge;
end;
$$;

revoke all on function tribuia.generate_lease_charges(uuid, date) from public, anon;
revoke all on function tribuia.register_lease_payment(uuid[], text) from public, anon;
revoke all on function tribuia.void_lease_charge(uuid) from public, anon;
grant execute on function tribuia.generate_lease_charges(uuid, date) to authenticated, service_role;
grant execute on function tribuia.register_lease_payment(uuid[], text) to authenticated, service_role;
grant execute on function tribuia.void_lease_charge(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table tribuia.agency_properties enable row level security;
alter table tribuia.property_leases enable row level security;
alter table tribuia.lease_charges enable row level security;

drop policy if exists agency_properties_select on tribuia.agency_properties;
create policy agency_properties_select on tribuia.agency_properties for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or owner_profile_id = (select auth.uid())
    or id in (select tribuia.user_leased_property_ids())
  );
drop policy if exists agency_properties_write on tribuia.agency_properties;
create policy agency_properties_write on tribuia.agency_properties for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

drop policy if exists property_leases_select on tribuia.property_leases;
create policy property_leases_select on tribuia.property_leases for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tenant_profile_id = (select auth.uid())
    or property_id in (select tribuia.user_owned_property_ids())
  );
drop policy if exists property_leases_write on tribuia.property_leases;
create policy property_leases_write on tribuia.property_leases for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- Cobros: solo lectura desde la app; se escriben por RPC o al aplicar el pago.
drop policy if exists lease_charges_select on tribuia.lease_charges;
create policy lease_charges_select on tribuia.lease_charges for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or lease_id in (select l.id from tribuia.property_leases l where l.tenant_profile_id = (select auth.uid()))
    or property_id in (select tribuia.user_owned_property_ids())
  );

grant select, insert, update, delete on tribuia.agency_properties, tribuia.property_leases to authenticated;
grant select on tribuia.lease_charges to authenticated;
grant all on tribuia.agency_properties, tribuia.property_leases, tribuia.lease_charges to service_role;

-- ============================================================================
-- D. CUENTA WOMPI PROPIA POR ESPACIO
-- ============================================================================
create table if not exists tribuia.payment_accounts (
  condominium_id uuid primary key references tribuia.condominiums (id) on delete cascade,
  provider       text not null default 'WOMPI',
  public_key     text not null,
  environment    text not null,
  connected_by   uuid references tribuia.profiles (id) on delete set null,
  connected_at   timestamptz not null default now(),
  constraint payment_accounts_provider_check check (provider = 'WOMPI'),
  constraint payment_accounts_environment_check check (environment in ('SANDBOX', 'PRODUCTION')),
  constraint payment_accounts_key_check check (public_key ~ '^pub_(test|prod)_[A-Za-z0-9]+$')
);

create table if not exists tribuia.payment_account_secrets (
  condominium_id   uuid primary key references tribuia.payment_accounts (condominium_id) on delete cascade,
  integrity_secret text not null,
  events_secret    text not null,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_payment_accounts_connected_by on tribuia.payment_accounts (connected_by);

alter table tribuia.payment_accounts enable row level security;
alter table tribuia.payment_account_secrets enable row level security;

drop policy if exists payment_accounts_select on tribuia.payment_accounts;
create policy payment_accounts_select on tribuia.payment_accounts for select to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

revoke all on tribuia.payment_accounts from anon, authenticated;
revoke all on tribuia.payment_account_secrets from anon, authenticated;
grant select on tribuia.payment_accounts to authenticated;
grant all on tribuia.payment_accounts, tribuia.payment_account_secrets to service_role;

-- ============================================================================
-- E. PAGOS EN LINEA DEL ARRIENDO
-- ============================================================================
alter type tribuia.payment_kind add value if not exists 'LEASE';

alter table tribuia.payments add column if not exists lease_charge_ids uuid[];

-- 'LEASE' se compara como texto: se agrega al enum en esta misma transaccion.
alter table tribuia.payments drop constraint if exists payments_target_check;
alter table tribuia.payments add constraint payments_target_check check (
  (kind::text = 'ADMIN_FEE' and admin_fee_id is not null)
  or (kind::text = 'SUBSCRIPTION' and plan_period is not null)
  or (kind::text = 'FINE' and fine_id is not null)
  or (kind::text = 'RESERVATION' and reservation_id is not null)
  or (kind::text = 'LEASE' and coalesce(cardinality(lease_charge_ids), 0) > 0)
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
    elsif v_payment.kind::text = 'LEASE' then
      update tribuia.lease_charges
         set status = 'PAID', paid_at = now(), payment_method = 'ONLINE', payment_id = v_payment.id
       where id = any(v_payment.lease_charge_ids) and status = 'PENDING';
      -- Aviso a la administracion de la inmobiliaria.
      insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
      select distinct v_payment.condominium_id, m.user_id, 'Pago de arriendo recibido',
             'Se recibio un pago en linea por ' || to_char(v_payment.amount, 'FM999G999G999') || ' COP.',
             'SYSTEM'::tribuia.notification_type, 'LOW'::tribuia.priority_level, 'payments', v_payment.id, '/agency/charges'
        from tribuia.condominium_members m
        join tribuia.roles r on r.id = m.role_id
       where m.condominium_id = v_payment.condominium_id and m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR';
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

-- Plan de EdiFeasy para inmobiliarias: se cotiza por propiedad activa.
create or replace function tribuia.subscription_quote(p_condominium uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count  integer;
  v_range  integer;
  v_unit   numeric;
  v_active jsonb;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  if tribuia.is_agency(p_condominium) then
    select count(*) into v_count from tribuia.agency_properties
     where condominium_id = p_condominium and status <> 'INACTIVE';
  else
    select count(*) into v_count from tribuia.apartments where condominium_id = p_condominium;
  end if;

  -- Sin unidades cargadas: el rango declarado al registrarse ("50-100" -> 50).
  if v_count = 0 then
    select nullif(substring(c.settings ->> 'unitsRange' from '^\s*(\d+)'), '')::integer
      into v_range
      from tribuia.condominiums c
     where c.id = p_condominium;
    v_count := greatest(coalesce(v_range, 0), 1);
  end if;

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

-- ============================================================================
-- F. TIENDA PUBLICA E INTERESADOS
-- ============================================================================
create table if not exists tribuia.agency_leads (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  property_id    uuid references tribuia.agency_properties (id) on delete set null,
  name           text not null,
  phone          text not null,
  email          text,
  message        text,
  status         text not null default 'NEW',
  consent_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  constraint agency_leads_status_check check (status in ('NEW', 'CONTACTED', 'CLOSED')),
  constraint agency_leads_name_check check (length(btrim(name)) between 2 and 120),
  constraint agency_leads_phone_check check (length(regexp_replace(phone, '\D', '', 'g')) between 7 and 15),
  constraint agency_leads_message_check check (message is null or length(message) <= 1000)
);

create index if not exists idx_agency_leads_condominium on tribuia.agency_leads (condominium_id, created_at desc);
create index if not exists idx_agency_leads_property on tribuia.agency_leads (property_id);

alter table tribuia.agency_leads enable row level security;
drop policy if exists agency_leads_admin on tribuia.agency_leads;
create policy agency_leads_admin on tribuia.agency_leads for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));
grant select, update, delete on tribuia.agency_leads to authenticated;
grant all on tribuia.agency_leads to service_role;

-- Inmobiliaria visible en la tienda: activa, con enlace y con acceso vigente.
create or replace function tribuia.storefront_agency_id(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select c.id from tribuia.condominiums c
   where c.slug = lower(btrim(p_slug)) and c.kind = 'AGENCY' and c.status = 'ACTIVE'
     and c.id not in (select tribuia.expired_condominium_ids());
$$;

create or replace function tribuia.storefront_property_json(p tribuia.agency_properties)
returns jsonb
language sql
stable
set search_path = tribuia, public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'property_type', p.property_type,
    'operation', p.operation, 'status', p.status,
    'rent_price', p.rent_price, 'admin_fee', p.admin_fee, 'sale_price', p.sale_price,
    'neighborhood', p.neighborhood, 'city', p.city, 'stratum', p.stratum,
    'area_m2', p.area_m2, 'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms,
    'parking', p.parking, 'floor', p.floor, 'furnished', p.furnished,
    'pets_allowed', p.pets_allowed, 'amenities', p.amenities,
    'description', p.description, 'images', p.images, 'published_at', p.published_at
  );
$$;

-- Tienda: datos publicos de la inmobiliaria y sus propiedades publicadas.
-- No expone direccion exacta, dueno ni datos de contratos.
create or replace function tribuia.storefront(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_id uuid := tribuia.storefront_agency_id(p_slug);
begin
  if v_id is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'agency', jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'logo_url', c.logo_url,
        'city', c.city, 'phone', c.phone, 'email', c.email, 'description', c.description,
        'whatsapp', c.settings ->> 'whatsapp', 'primary_color', c.settings ->> 'primaryColor'
      ),
      'properties', coalesce((
        select jsonb_agg(tribuia.storefront_property_json(p) order by p.published_at desc)
          from tribuia.agency_properties p
         where p.condominium_id = c.id and p.is_published and p.status in ('AVAILABLE', 'RESERVED')
      ), '[]'::jsonb)
    )
    from tribuia.condominiums c where c.id = v_id
  );
end;
$$;

create or replace function tribuia.submit_agency_lead(
  p_slug text,
  p_property uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_agency uuid := tribuia.storefront_agency_id(p_slug);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id     uuid;
  v_title  text;
begin
  if v_agency is null then
    raise exception 'La inmobiliaria no esta disponible' using errcode = 'P0002';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Debes autorizar el tratamiento de tus datos para que te contacten' using errcode = 'P0001';
  end if;
  if p_property is not null and not exists (
    select 1 from tribuia.agency_properties p
     where p.id = p_property and p.condominium_id = v_agency and p.is_published
       and p.status in ('AVAILABLE', 'RESERVED')
  ) then
    raise exception 'La propiedad no esta disponible' using errcode = 'P0002';
  end if;
  -- Limite contra abuso: 3 solicitudes por telefono al dia en cada inmobiliaria.
  if (select count(*) from tribuia.agency_leads l
       where l.condominium_id = v_agency and regexp_replace(l.phone, '\D', '', 'g') = v_digits
         and l.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya recibimos tus datos; la inmobiliaria te contactara pronto' using errcode = 'P0001';
  end if;

  insert into tribuia.agency_leads (condominium_id, property_id, name, phone, email, message, consent_at)
  values (v_agency, p_property, btrim(p_name), btrim(p_phone), nullif(btrim(coalesce(p_email, '')), ''),
          nullif(left(btrim(coalesce(p_message, '')), 1000), ''), now())
  returning id into v_id;

  select title into v_title from tribuia.agency_properties where id = p_property;
  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select distinct v_agency, m.user_id, 'Nuevo interesado: ' || btrim(p_name),
         coalesce('Por ' || v_title || '. ', '') || 'Telefono ' || btrim(p_phone),
         'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level, 'agency_leads', v_id, '/agency/leads'
    from tribuia.condominium_members m
    join tribuia.roles r on r.id = m.role_id
   where m.condominium_id = v_agency and m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR';

  return v_id;
end;
$$;

revoke all on function tribuia.storefront_agency_id(text) from public;
revoke all on function tribuia.storefront(text) from public;
revoke all on function tribuia.submit_agency_lead(text, uuid, text, text, text, text, boolean) from public;
grant execute on function tribuia.storefront_agency_id(text) to anon, authenticated, service_role;
grant execute on function tribuia.storefront_property_json(tribuia.agency_properties) to anon, authenticated, service_role;
grant execute on function tribuia.storefront(text) to anon, authenticated, service_role;
grant execute on function tribuia.submit_agency_lead(text, uuid, text, text, text, text, boolean) to anon, authenticated, service_role;

-- Fotos de las propiedades en el bucket publico `media`: <espacio>/properties/...
do $$
begin
  drop policy if exists edifeasy_media_write on storage.objects;
  execute $pol$
    create policy edifeasy_media_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[2] in ('announcements', 'logo', 'properties')
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                           array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

-- ============================================================================
-- G. REALTIME Y PRUEBA GRATIS
-- ============================================================================
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['lease_charges', 'agency_leads']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'tribuia' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table tribuia.%I', t);
    end if;
  end loop;
end
$$;

do $$
declare
  t text;
begin
  if to_regprocedure('tribuia.expired_condominium_ids()') is null then
    return;
  end if;
  foreach t in array array['agency_properties', 'property_leases', 'lease_charges', 'agency_leads', 'payment_accounts']
  loop
    execute format('drop policy if exists %1$s_trial_access on tribuia.%1$I', t);
    execute format(
      'create policy %1$s_trial_access on tribuia.%1$I as restrictive for all to authenticated
         using (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))
         with check (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))', t);
  end loop;
end
$$;

notify pgrst, 'reload schema';

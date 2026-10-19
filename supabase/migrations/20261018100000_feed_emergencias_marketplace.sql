-- ============================================================================
-- EdiFeasy :: Feed, numeros de emergencia y marketplace de servicios
-- ----------------------------------------------------------------------------
--   A. Feed: los comunicados son las publicaciones del feed. Se agrega
--      `pinned` (publicacion fijada arriba) y un indice para paginar el feed.
--   B. Lugares de OpenStreetMap con telefono y sitio web, para llamar desde
--      el marketplace y desde la tarjeta de emergencias.
--   C. Directorio del conjunto (`community_contacts`): numeros que agrega la
--      administracion. EMERGENCY = cuadrante de policia, porteria, brigada...
--      SERVICE = aseo, carpinteros, plomeros, taxis... (marketplace).
--   D. Modulo configurable 'marketplace' en la matriz de modulos por rol.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
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
  'marketplace'
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
    'marketplace'
  ]::text[];
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- EdiFeasy :: Cumplimiento legal (Ley 1581 de 2012, Decreto 1377 de 2013,
--             Ley 1480 de 2011 art. 53)
-- ----------------------------------------------------------------------------
--   A. platform_settings: datos legales del operador (razon social, NIT,
--      contacto de proteccion de datos...). Lectura publica (paginas legales),
--      escritura solo SUPER_ADMIN.
--   B. legal_acceptances: prueba de la autorizacion (quien, que documento,
--      que version, cuando). El registro la guarda desde los metadatos del
--      alta; el resto de cuentas la dan al ingresar (accept_legal_documents).
--   C. data_requests: consultas y reclamos de titulares (conocer, actualizar,
--      suprimir, revocar) con plazo legal en dias habiles.
--   D. export_my_data: el titular descarga sus datos.
--   E. Registro de vendedores del marketplace (Ley 1480 art. 53): nombre,
--      documento, direccion y telefono de quien publica, visible solo para la
--      administracion y el operador. Publicar exige documento y aceptar las
--      reglas del marketplace.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
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

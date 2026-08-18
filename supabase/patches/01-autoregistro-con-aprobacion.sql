-- ============================================================================
-- PARCHE 01 :: Autoregistro con aprobacion del administrador (esquema tribuia)
-- ----------------------------------------------------------------------------
-- Qué hace:
--   A. Reconcilia el constraint unique que falta en tribuia.residents.
--   B. Crea la tabla tribuia.registration_requests (solicitudes de inscripcion).
--   C. Catalogos de solo-lectura para /register: condominios, edificios y
--      APARTAMENTOS existentes (el usuario elige de una lista, no escribe texto).
--   D. complete_self_registration ahora NO otorga acceso: crea una solicitud
--      PENDING. El acceso lo concede el administrador.
--   E. approve_registration_request / reject_registration_request.
--   F. RLS, permisos y auditoria.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Es idempotente: puedes ejecutarlo varias veces.
--
-- Verificar despues con:  npm run check
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Reconciliar constraints faltantes
-- ----------------------------------------------------------------------------
-- `create table if not exists` NO agrega constraints a tablas que ya existian.
-- tribuia.residents se creo antes de que el esquema declarara
-- `unique (apartment_id, profile_id)`, asi que la base quedo sin el y los
-- ON CONFLICT sobre esa tabla fallaban con 42P10.
-- ----------------------------------------------------------------------------
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

-- @@BEGIN-CORE@@
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
-- @@END-CORE@@

-- Refresca el cache de esquema de PostgREST para que los cambios se vean ya.
notify pgrst, 'reload schema';

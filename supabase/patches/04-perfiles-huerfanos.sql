-- ============================================================================
-- PARCHE 04 :: Cuentas de auth.users sin fila en tribuia.profiles
-- ----------------------------------------------------------------------------
-- Sintoma:
--   al iniciar sesion con una cuenta que ya existia, la app falla con
--     23503  insert or update on table "registration_requests" violates
--            foreign key constraint "registration_requests_profile_id_fkey"
--     Key (profile_id)=(...) is not present in table "profiles".
--
-- Causa:
--   tribuia.profiles se llena con el trigger on_auth_user_created sobre
--   auth.users. Una cuenta creada ANTES de instalar ese trigger (por ejemplo
--   mientras el esquema estaba a medias) quedo en auth.users y nunca tuvo
--   perfil. Todo lo que referencia profiles falla para esa cuenta.
--
-- Que hace este parche:
--   A. Reconstruye los perfiles que falten, leyendo auth.users.
--   B. Reinstala el trigger para que no vuelva a pasar con cuentas nuevas.
--   C. Deja complete_self_registration a prueba de este caso: si el perfil no
--      existe, lo crea en vez de morir con una violacion de clave ajena.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Es idempotente: puedes ejecutarlo varias veces.
--
-- Verificar despues con: npm run check
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Reconstruir los perfiles que faltan
-- ----------------------------------------------------------------------------
do $backfill$
declare
  v_faltantes integer;
  v_creados   integer;
begin
  select count(*) into v_faltantes
  from auth.users u
  where u.email is not null
    and not exists (select 1 from tribuia.profiles p where p.id = u.id);

  raise notice 'Cuentas sin perfil antes del parche: %', v_faltantes;

  insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type, metadata)
  select u.id,
         u.email,
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
         u.raw_user_meta_data ->> 'phone',
         u.raw_user_meta_data ->> 'document_number',
         coalesce(u.raw_user_meta_data ->> 'document_type', 'CC'),
         jsonb_build_object('requested_role', nullif(u.raw_user_meta_data ->> 'requested_role', ''))
  from auth.users u
  where u.email is not null
    and not exists (select 1 from tribuia.profiles p where p.id = u.id)
  -- Sin objetivo: cubre el id repetido y tambien el indice unico de email,
  -- que salta si dos cuentas de auth comparten el mismo correo.
  on conflict do nothing;

  get diagnostics v_creados = row_count;
  raise notice 'Perfiles creados: %', v_creados;

  if v_creados < v_faltantes then
    raise notice 'Quedan % cuenta(s) sin perfil: revisa si tienen el correo repetido con la consulta del final.',
      v_faltantes - v_creados;
  end if;
end
$backfill$;

-- ----------------------------------------------------------------------------
-- B. Reinstalar el trigger que crea el perfil al registrarse
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- C. complete_self_registration a prueba de perfiles ausentes
-- ----------------------------------------------------------------------------
-- Identica a la del parche 01 mas el bloque que reconstruye el perfil. Si una
-- cuenta llega sin perfil (por ejemplo creada por la Admin API sin pasar por el
-- trigger), lo crea en el momento en lugar de devolver un 23503 que el usuario
-- no puede interpretar ni resolver.
-- ----------------------------------------------------------------------------
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

  if exists (
    select 1 from tribuia.condominium_members m
    where m.condominium_id = p_condominium and m.user_id = v_user and m.status = 'ACTIVE'
  ) then
    raise exception 'Ya tienes acceso activo a este condominio' using errcode = 'P0001';
  end if;

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

  if exists (
    select 1 from tribuia.registration_requests r
    where r.apartment_id = p_apartment
      and r.status = 'PENDING'
      and r.profile_id <> v_user
  ) then
    raise exception 'Ese apartamento tiene una solicitud pendiente de aprobacion' using errcode = 'P0001';
  end if;

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
    and r.code in ('ADMINISTRATOR', 'SPOKESPERSON');

  return jsonb_build_object('ok', true, 'request_id', v_request);
end;
$$;

grant execute on function tribuia.complete_self_registration(uuid, uuid, uuid, text, jsonb, text)
  to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- Comprobacion: no debe devolver ninguna fila.
-- Si devuelve alguna, esa cuenta sigue sin perfil (mira si el correo esta
-- repetido en auth.users, que es el unico caso que el parche no puede resolver
-- solo: hay que decidir cual de las dos cuentas se queda).
-- ============================================================================
select u.id,
       u.email,
       u.created_at,
       (select count(*) from auth.users d where lower(d.email) = lower(u.email)) as cuentas_con_ese_correo
from auth.users u
where u.email is not null
  and not exists (select 1 from tribuia.profiles p where p.id = u.id)
order by u.created_at;

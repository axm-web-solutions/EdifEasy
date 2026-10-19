-- ============================================================================
-- EdiFeasy :: Imagenes subidas, mas informacion en el mapa y cuentas de
--             propietarios para conjuntos existentes
-- ----------------------------------------------------------------------------
--   A. Bucket publico `media` para imagenes que se muestran a toda la
--      comunidad (comunicados del feed, logo del conjunto). Lectura publica,
--      escritura solo de la administracion del conjunto.
--      Ruta: <condominium_id>/<entidad>/<archivo>
--   B. condominium_places: WhatsApp y horario de atencion (OpenStreetMap).
--   C. units_without_owner + attach_provisioned_accounts: crear las cuentas
--      de propietarios de un conjunto ya creado (p. ej. Angeles del Bosque).
--      Si la unidad tenia un residente de referencia sin cuenta
--      ("Propietario Casa 07"), se vincula ese mismo registro.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. IMAGENES
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  drop policy if exists edifeasy_media_read on storage.objects;
  drop policy if exists edifeasy_media_write on storage.objects;
  drop policy if exists edifeasy_media_delete on storage.objects;

  execute $pol$
    create policy edifeasy_media_read on storage.objects for select to public
    using (bucket_id = 'media')
  $pol$;

  execute $pol$
    create policy edifeasy_media_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[2] in ('announcements', 'logo')
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                           array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;

  execute $pol$
    create policy edifeasy_media_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'media'
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                           array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;


-- ----------------------------------------------------------------------------
-- B. MAS INFORMACION DE LOS LUGARES
-- ----------------------------------------------------------------------------
alter table tribuia.condominium_places add column if not exists whatsapp text;
alter table tribuia.condominium_places add column if not exists opening_hours text;

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
     phone, website, whatsapp, opening_hours)
  select p_condominium,
         p.osm_id, left(p.name, 200), p.category, p.latitude, p.longitude, p.distance_m,
         left(p.address, 300), left(p.phone, 60), left(p.website, 300),
         left(p.whatsapp, 60), left(p.opening_hours, 200)
    from jsonb_to_recordset(coalesce(p_places, '[]'::jsonb)) as p(
      osm_id text, name text, category text, latitude numeric, longitude numeric,
      distance_m integer, address text, phone text, website text, whatsapp text,
      opening_hours text
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
-- C. CUENTAS DE PROPIETARIOS PARA CONJUNTOS EXISTENTES
-- ----------------------------------------------------------------------------
-- Unidades sin propietario activo. `tower` va solo si el conjunto tiene mas de
-- un bloque (para que el correo distinga t1-101 de t2-101).
create or replace function tribuia.units_without_owner(p_condominium uuid)
returns table (apartment_id uuid, tower text, number text, label text)
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_multi boolean;
begin
  if not tribuia.is_super_admin() then
    raise exception 'Solo el super administrador puede crear cuentas de propietarios' using errcode = '42501';
  end if;

  select count(*) > 1 into v_multi from tribuia.buildings where condominium_id = p_condominium;

  return query
    select a.id,
           case when v_multi then lower(regexp_replace(b.number, '[^A-Za-z0-9]', '', 'g')) end,
           a.number,
           coalesce(nullif(a.description, ''), b.name || ' · ' || a.number)
      from tribuia.apartments a
      join tribuia.buildings b on b.id = a.building_id
     where a.condominium_id = p_condominium
       and not exists (
         select 1 from tribuia.apartment_owners o where o.apartment_id = a.id and o.is_active
       )
     order by b.number, a.number;
end;
$$;

revoke all on function tribuia.units_without_owner(uuid) from public, anon;
grant execute on function tribuia.units_without_owner(uuid) to authenticated, service_role;

-- Igual que antes, pero si la unidad tiene un residente de referencia sin
-- cuenta (relacion OWNER, sin profile_id), se le asigna la cuenta en lugar de
-- crear un residente duplicado.
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
  v_placeholder uuid;
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

    select r.id into v_placeholder
      from tribuia.residents r
     where r.apartment_id = v_row.apartment_id
       and r.profile_id is null
       and r.relationship = 'OWNER'
     order by r.created_at
     limit 1;

    if v_placeholder is not null and not exists (
      select 1 from tribuia.residents
       where apartment_id = v_row.apartment_id and profile_id = v_row.profile_id
    ) then
      update tribuia.residents
         set profile_id = v_row.profile_id, email = v_row.email, is_active = true
       where id = v_placeholder;
    else
      insert into tribuia.residents
        (condominium_id, apartment_id, profile_id, full_name, relationship, email, is_active)
      values (p_condominium, v_row.apartment_id, v_row.profile_id, v_row.full_name, 'OWNER',
              v_row.email, true)
      on conflict (apartment_id, profile_id) do update set is_active = true;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function tribuia.attach_provisioned_accounts(uuid, uuid, jsonb) from public, anon;
grant execute on function tribuia.attach_provisioned_accounts(uuid, uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ============================================================================
-- EdiFeasy :: Alta de conjuntos desde el RUT (solo SUPER_ADMIN)
-- ----------------------------------------------------------------------------
-- La Edge Function `provision-condominium` orquesta el alta:
--   1. provision_condominium(payload)   -> conjunto + torres/casas + unidades.
--   2. Crea las cuentas en Supabase Auth (administrador y una por unidad).
--   3. attach_provisioned_accounts(...) -> membresias, propietarios y residentes.
--
-- Ambas funciones se llaman con el JWT del SUPER_ADMIN y lo verifican aqui;
-- nadie mas puede ejecutarlas aunque tenga EXECUTE.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
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
